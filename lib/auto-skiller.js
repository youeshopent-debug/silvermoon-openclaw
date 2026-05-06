const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');
const INSTALL_LOG = path.join(PROJECT_ROOT, '.silvermoon_core', 'skill_install.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(INSTALL_LOG, line + '\n');
  } catch {}
}

function getInstalledSkills() {
  const installed = [];
  if (fs.existsSync(PLUGINS_DIR)) {
    for (const name of fs.readdirSync(PLUGINS_DIR)) {
      const dir = path.join(PLUGINS_DIR, name);
      if (fs.statSync(dir).isDirectory()) {
        const pkg = path.join(dir, 'package.json');
        const req = path.join(dir, 'requirements.txt');
        installed.push({
          name,
          path: dir,
          hasNpm: fs.existsSync(pkg),
          hasPip: fs.existsSync(req),
          size: getDirSize(dir)
        });
      }
    }
  }
  return installed;
}

function getDirSize(dir) {
  try {
    let size = 0;
    for (const f of fs.readdirSync(dir, { recursive: true })) {
      try { size += fs.statSync(path.join(dir, f)).size; } catch {}
    }
    return size;
  } catch { return 0; }
}

async function searchAndInstall(query, options = {}) {
  const {
    autoInstall = true,
    maxResults = 5,
    minStars = 10,
  } = options;

  const q = encodeURIComponent(query);
  if (!q) return { ok: false, error: 'No query provided' };

  try {
    log(`Searching GitHub for: ${query}`);
    const result = execSync(
      `curl -s -x http://127.0.0.1:7890 "https://api.github.com/search/repositories?q=${q}&sort=stars&per_page=${maxResults}"`,
      { timeout: 15000, encoding: 'utf-8' }
    );
    const data = JSON.parse(result);
    if (!data.items || data.items.length === 0) {
      return { ok: false, error: 'No results found' };
    }

    const results = data.items.map(r => ({
      full_name: r.full_name,
      stars: r.stargazers_count,
      description: r.description,
      url: r.html_url,
      clone_url: r.clone_url,
      updated: r.updated_at?.slice(0, 10),
      language: r.language,
    })).filter(r => r.stars >= minStars);

    if (results.length === 0) {
      return { ok: false, error: `No results with >= ${minStars} stars` };
    }

    if (!autoInstall) {
      return { ok: true, results, installed: false };
    }

    const best = results[0];
    const targetDir = path.join(PLUGINS_DIR, best.full_name.replace('/', '_'));

    if (fs.existsSync(targetDir)) {
      log(`Already installed: ${best.full_name} at ${targetDir}`);
      return { ok: true, results, installed: true, alreadyExists: true, path: targetDir };
    }

    log(`Installing ${best.full_name} → ${targetDir}`);
    try {
      execSync(`git clone "${best.clone_url}" "${targetDir}"`, { timeout: 120000, encoding: 'utf-8' });
      log(`Cloned successfully: ${best.full_name}`);
    } catch (e) {
      return { ok: false, error: `Git clone failed: ${e.message.slice(0, 200)}`, results };
    }

    const installSteps = [];

    const pkgJson = path.join(targetDir, 'package.json');
    const reqTxt = path.join(targetDir, 'requirements.txt');
    const setupPy = path.join(targetDir, 'setup.py');
    const pyProject = path.join(targetDir, 'pyproject.toml');

    if (fs.existsSync(pkgJson)) {
      try {
        execSync(`cd "${targetDir}" && npm install --no-audit --no-fund`, { timeout: 120000, encoding: 'utf-8' });
        installSteps.push('npm install ✅');
        log(`npm dependencies installed for ${best.full_name}`);
      } catch (e) {
        installSteps.push(`npm install ⚠️ ${e.message.slice(0, 50)}`);
      }
    }

    if (fs.existsSync(reqTxt)) {
      try {
        execSync(`cd "${targetDir}" && pip install -r requirements.txt`, { timeout: 180000, encoding: 'utf-8' });
        installSteps.push('pip install ✅');
        log(`pip dependencies installed for ${best.full_name}`);
      } catch (e) {
        installSteps.push(`pip install ⚠️ ${e.message.slice(0, 50)}`);
      }
    }

    if (fs.existsSync(setupPy) || fs.existsSync(pyProject)) {
      try {
        execSync(`cd "${targetDir}" && pip install -e .`, { timeout: 120000, encoding: 'utf-8' });
        installSteps.push('pip -e install ✅');
      } catch {}
    }

    return {
      ok: true,
      results,
      installed: true,
      path: targetDir,
      installSteps,
      best: { name: best.full_name, stars: best.stars, description: best.description }
    };
  } catch (e) {
    log(`Search failed: ${e.message}`);
    return { ok: false, error: e.message.slice(0, 300) };
  }
}

function needRefresh() {
  log('Skill registry refreshed');
  return { plugins: getInstalledSkills() };
}

module.exports = {
  searchAndInstall,
  getInstalledSkills,
  needRefresh,
};
