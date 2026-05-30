const fs = require('fs');
const path = require('path');

function safeReadUtf8(p) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

function writeUtf8(p, s) {
  fs.writeFileSync(p, s, 'utf-8');
}

function normSkillName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function main() {
  const root = path.resolve(__dirname, '..');
  const cfgPath = path.join(root, 'openclaw.json');
  const raw = safeReadUtf8(cfgPath);
  if (!raw) {
    console.error('missing openclaw.json');
    process.exit(1);
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    console.error('openclaw.json parse failed');
    process.exit(1);
  }

  const core = [
    'OPENVIKING',
    'CLAUDE-MEM',
    'CLAUDE CODE',
    'SELF-IMPROVING-AGENT',
    'AUTOMATION-WORKFLOWS',
    'VIBE CODING',
    'SKILL-VETTER',
    'PROACTIVE-AGENT',
    'OPEN CLI',
    'GITHUB',
    'OFFICE-SUITE',
    'HUMANIZER',
    'FIND-SKILLS',
    'WEB_FETCH',
    'BROWSER',
  ].map(normSkillName);

  if (!cfg.agents || typeof cfg.agents !== 'object') cfg.agents = {};
  if (!cfg.agents.defaults || typeof cfg.agents.defaults !== 'object') cfg.agents.defaults = {};
  cfg.agents.defaults.skills = core;

  const list = Array.isArray(cfg.agents.list) ? cfg.agents.list : [];
  for (const a of list) {
    a.skills = core;
  }
  cfg.agents.list = list;

  writeUtf8(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

  console.log('core_skills=' + core.length);
  console.log('agents=' + list.length);
}

main();
