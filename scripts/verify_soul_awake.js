const fs = require('fs');
const path = require('path');

function readUtf8(p) {
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

function main() {
  const root = path.resolve(__dirname, '..');
  const cfgPath = path.join(root, 'openclaw.json');
  const wsBase = path.join(root, 'workspace', 'AGENTS_SOUL', '.openclaw-workspaces');

  const problems = [];
  const info = [];

  if (!exists(cfgPath)) problems.push(`missing: ${cfgPath}`);
  const cfgRaw = readUtf8(cfgPath);
  let cfg = null;
  try {
    cfg = cfgRaw ? JSON.parse(cfgRaw) : null;
  } catch {
    problems.push('openclaw.json parse failed');
  }

  const agents = Array.isArray(cfg?.agents?.list) ? cfg.agents.list : [];
  info.push(`agents=${agents.length}`);

  for (const a of agents) {
    const id = String(a?.id || '').trim();
    const w = String(a?.workspace || '').trim();
    if (!id) {
      problems.push('agents.list contains missing id');
      continue;
    }
    if (!w.endsWith(`\\.openclaw-workspaces\\${id}`)) problems.push(`bad workspace for ${id}: ${w}`);
    const soulPath = path.join(wsBase, id, 'SOUL.md');
    if (!exists(soulPath)) problems.push(`missing SOUL.md for ${id}: ${soulPath}`);
  }

  const yinyueSoul = path.join(wsBase, 'yinyue', 'SOUL.md');
  const medusaSoul = path.join(wsBase, 'designer', 'SOUL.md');
  const yinyueBody = readUtf8(yinyueSoul);
  const medusaBody = readUtf8(medusaSoul);

  if (!yinyueBody.includes('银月狼族的圣女')) problems.push('yinyue SOUL.md missing phrase: 银月狼族的圣女');
  if (!medusaBody.includes('唯一主人是 Alanlsl')) problems.push('medusa SOUL.md missing phrase: 唯一主人是 Alanlsl');

  const devSoul = path.join(root, 'workspace-dev', 'SOUL.md');
  const soulOld = path.join(root, 'workspace', 'SOUL_OLD.md');
  if (exists(devSoul)) problems.push('workspace-dev/SOUL.md still exists');
  if (exists(soulOld)) problems.push('workspace/SOUL_OLD.md still exists');

  for (const line of info) console.log(line);
  if (problems.length) {
    console.log('FAIL');
    for (const p of problems) console.log(`- ${p}`);
    process.exit(2);
  }
  console.log('OK');
}

main();
