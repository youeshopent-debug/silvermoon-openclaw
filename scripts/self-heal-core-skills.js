const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, '.silvermoon_core', 'self_heal');
const LOG_PATH = path.join(LOG_DIR, 'core_skills_heal.log');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

async function phaseRegenerate() {
  const steps = [];
  try {
    const out = execSync('node scripts/install_core_skills.js', { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
    const match = out.match(/core_skills_installed=(\d+)/);
    const count = match ? parseInt(match[1]) : 0;
    steps.push({ phase: 'regenerate', detail: `installed=${count}`, result: 'OK' });

    const dirs = fs.readdirSync(path.join(ROOT, 'tools', 'core_skills'));
    let ok = 0, missing = 0;
    for (const d of dirs) {
      const md = path.join(ROOT, 'tools', 'core_skills', d, 'SKILL.md');
      if (fs.existsSync(md)) {
        const raw = fs.readFileSync(md, 'utf8');
        if (raw.includes('source: local') && raw.includes('version:')) ok++;
        else steps.push({ phase: 'validate', detail: `${d}: missing metadata`, result: 'WARN' });
      } else {
        missing++;
      }
    }
    steps.push({ phase: 'validate', detail: `skills=${dirs.length} valid_meta=${ok} missing=${missing}`, result: missing > 0 ? 'WARN' : 'OK' });
  } catch (e) {
    steps.push({ phase: 'regenerate', detail: e.message, result: 'FAIL' });
  }
  return steps;
}

async function phaseTestImplementations() {
  const steps = [];
  const skills = ['openviking', 'self-improving-agent'];

  for (const name of skills) {
    const scriptPath = path.join(ROOT, 'scripts', `${name}.js`);
    if (!fs.existsSync(scriptPath)) {
      steps.push({ phase: 'test', skill: name, detail: 'no scripts/*.js', result: 'SKIP' });
      continue;
    }
    try {
      const mod = require(scriptPath);
      if (typeof mod.selfTest === 'function') {
        const r = await mod.selfTest();
        steps.push({ phase: 'test', skill: name, detail: `verdict=${r.verdict} passed=${r.passed}/${r.total}`, result: r.verdict === 'PASS' ? 'PASS' : 'WARN' });
      } else {
        steps.push({ phase: 'test', skill: name, detail: 'no selfTest() export', result: 'SKIP' });
      }
    } catch (e) {
      require.cache[require.resolve(scriptPath)] && delete require.cache[require.resolve(scriptPath)];
      steps.push({ phase: 'test', skill: name, detail: e.message, result: 'FAIL' });
    }
  }

  return steps;
}

async function main() {
  ensureDir(LOG_DIR);
  const startTime = Date.now();
  const steps = [];

  console.log('[self-heal] Phase 1: regenerate SKILL.md...');
  const regen = await phaseRegenerate();
  steps.push(...regen);

  console.log('[self-heal] Phase 2: test implementations...');
  const tests = await phaseTestImplementations();
  steps.push(...tests);

  const passed = steps.filter(s => s.result === 'OK' || s.result === 'PASS').length;
  const warnings = steps.filter(s => s.result === 'WARN').length;
  const failed = steps.filter(s => s.result === 'FAIL').length;
  const skips = steps.filter(s => s.result === 'SKIP').length;
  const verdict = failed > 0 ? 'ISSUES_FOUND' : 'PASS';

  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    total: steps.length,
    passed, warnings, failed, skips,
    verdict,
    steps,
  };

  fs.appendFileSync(LOG_PATH, JSON.stringify(report) + '\n', 'utf8');
  console.log(`[self-heal] done: ${passed} passed, ${warnings} warn, ${failed} failed, ${skips} skip | ${verdict}`);
  console.log(`[self-heal] log: ${LOG_PATH}`);

  return report;
}

if (require.main === module) {
  main().catch(e => { console.error('[self-heal] FATAL:', e.message); process.exit(1); });
}

module.exports = { main, phaseRegenerate, phaseTestImplementations };
