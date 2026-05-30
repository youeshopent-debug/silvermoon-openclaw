const fs = require('fs');
const path = require('path');

function safeReadUtf8(p) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function walkSkillMdFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name === 'SKILL.md') out.push(p);
    }
  }
  return out;
}

function normSkillName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function getSkillNameFromSkillMd(p) {
  const dir = path.dirname(p);
  return normSkillName(path.basename(dir));
}

function loadOpenclawConfig(root) {
  const cfgPath = path.join(root, 'openclaw.json');
  const raw = safeReadUtf8(cfgPath);
  if (!raw) return { ok: false, error: 'missing openclaw.json', cfg: null };
  try {
    return { ok: true, error: null, cfg: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'openclaw.json parse failed', cfg: null };
  }
}

function parseAgentMetaFromFilename(filename) {
  const base = String(filename || '').replace(/\.md$/i, '');
  const parts = base.split('_');
  return { code: parts[0] || '', role: parts[1] || '', name: parts[2] || base, filename: String(filename || '') };
}

function extractAgentIdFromBody(body) {
  const s = String(body || '');
  const m = s.match(/^\s*ID[:：]\s*([A-Za-z0-9._-]+)\s*$/m);
  return m ? String(m[1] || '').trim() : '';
}

function countNonWsChars(s) {
  return String(s || '').replace(/\s+/g, '').length;
}

function scoreSkill(name) {
  const n = normSkillName(name);
  let score = 0;
  if (n.includes('stripe')) score += 100;
  if (n.includes('wise')) score += 90;
  if (n.includes('gog')) score += 80;
  if (n.includes('browser') || n.includes('playwright') || n.includes('webapp')) score += 70;
  if (n.includes('file') || n.includes('fs') || n.includes('sandbox')) score += 60;
  if (n.includes('searx') || n.includes('search') || n.includes('reader') || n.includes('jina')) score += 60;
  if (n.includes('tts') || n.includes('whisper')) score += 40;
  return score;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const cfgRes = loadOpenclawConfig(root);
  if (!cfgRes.ok) {
    console.error(cfgRes.error);
    process.exit(1);
  }
  const cfg = cfgRes.cfg;

  const skillRoots = [
    path.join(process.env.USERPROFILE || 'C:\\Users\\User', '.agents', 'skills'),
    path.join(root, '.agents', 'skills'),
    path.join(root, 'workspace', '.agents', 'skills'),
  ];

  const physicalSkillMd = [];
  for (const r of skillRoots) {
    if (!isDir(r)) continue;
    physicalSkillMd.push(...walkSkillMdFiles(r));
  }

  const physicalSkills = new Map();
  for (const p of physicalSkillMd) {
    const name = getSkillNameFromSkillMd(p);
    if (!name) continue;
    if (!physicalSkills.has(name)) physicalSkills.set(name, []);
    physicalSkills.get(name).push(p);
  }

  const emptySkillDirs = [];
  for (const r of skillRoots) {
    if (!isDir(r)) continue;
    for (const d of listDirs(r)) {
      const dir = path.join(r, d);
      const hasSkill = exists(path.join(dir, 'SKILL.md'));
      const hasAnyFile = (() => {
        try {
          return fs.readdirSync(dir).length > 0;
        } catch {
          return false;
        }
      })();
      if (!hasSkill || !hasAnyFile) emptySkillDirs.push({ dir, hasSkillMd: hasSkill, hasAnyFile });
    }
  }

  const configuredSkills = new Set();
  const agentList = Array.isArray(cfg?.agents?.list) ? cfg.agents.list : [];
  for (const a of agentList) {
    for (const s of Array.isArray(a?.skills) ? a.skills : []) configuredSkills.add(normSkillName(s));
  }

  const missingConfigured = [];
  for (const s of configuredSkills) {
    if (!physicalSkills.has(s)) missingConfigured.push(s);
  }

  const unconfiguredPhysical = [];
  for (const s of physicalSkills.keys()) {
    if (!configuredSkills.has(s)) unconfiguredPhysical.push(s);
  }

  const exclude = new Set(
    [
      'open-viking',
      'cloud-mem',
      'codex',
      'codex-bridge',
      'self-improving-agent',
      'automation-workflows',
    ].map(normSkillName),
  );

  const candidateOther = [];
  for (const s of physicalSkills.keys()) {
    if (exclude.has(s)) continue;
    candidateOther.push(s);
  }
  candidateOther.sort((a, b) => scoreSkill(b) - scoreSkill(a) || a.localeCompare(b));
  const topOther = candidateOther.slice(0, 8);

  const agentsSoulDir = path.join(root, 'workspace', 'AGENTS_SOUL');
  const personaFiles = exists(agentsSoulDir)
    ? fs
        .readdirSync(agentsSoulDir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((f) => /^\d{2}_/.test(String(f || '')) && String(f).toLowerCase().endsWith('.md'))
        .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
    : [];

  const memberMap = [];
  for (const f of personaFiles) {
    const meta = parseAgentMetaFromFilename(f);
    const body = safeReadUtf8(path.join(agentsSoulDir, f));
    let id = extractAgentIdFromBody(body);
    if (!id && meta.name === '银月') id = 'yinyue';
    memberMap.push({ name: meta.name, id: normSkillName(id), file: f });
  }

  const agentById = new Map(agentList.map((a) => [normSkillName(a?.id), a]));
  const memberAssignments = [];
  for (const m of memberMap) {
    const a = agentById.get(m.id) || null;
    const skills = Array.isArray(a?.skills) ? a.skills.map(normSkillName) : [];
    const present = [];
    const missing = [];
    for (const s of skills) {
      if (physicalSkills.has(s)) present.push(s);
      else missing.push(s);
    }
    memberAssignments.push({
      name: m.name,
      id: m.id,
      skillCount: skills.length,
      present: present.slice(0, 6),
      missing,
    });
  }

  const report = {
    roots: skillRoots.filter(isDir),
    physical: { count: physicalSkills.size, names: Array.from(physicalSkills.keys()).sort() },
    configured: { count: configuredSkills.size, names: Array.from(configuredSkills).sort() },
    anomalies: {
      emptySkillDirs: emptySkillDirs,
      missingConfigured: missingConfigured.sort(),
    },
    focus: {
      foundStripe: Array.from(physicalSkills.keys()).filter((s) => s.includes('stripe')).sort(),
      foundWise: Array.from(physicalSkills.keys()).filter((s) => s.includes('wise')).sort(),
      foundGog: Array.from(physicalSkills.keys()).filter((s) => s.includes('gog')).sort(),
      foundBrowser: Array.from(physicalSkills.keys())
        .filter((s) => s.includes('browser') || s.includes('playwright') || s.includes('webapp'))
        .sort(),
      foundFiles: Array.from(physicalSkills.keys())
        .filter((s) => s.includes('file') || s.includes('fs') || s.includes('sandbox'))
        .sort(),
    },
    memberAssignments,
    topOther,
  };

  console.log(JSON.stringify(report, null, 2));
  console.log('TOP_OTHER=' + topOther.join(','));
  console.log('TOP_OTHER_COUNT=' + topOther.length);
  console.log('CHAR_COUNT_HELPER=' + countNonWsChars('a b'));
}

main();
