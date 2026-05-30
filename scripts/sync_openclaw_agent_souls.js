const fs = require('fs');
const path = require('path');

function safeReadUtf8(p) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
}

function normalizeNewlines(s) {
  return String(s || '').replace(/\r\n/g, '\n');
}

function parseAgentFromFilename(filename) {
  const base = String(filename || '').replace(/\.md$/i, '');
  const parts = base.split('_');
  const code = parts[0] || '';
  const role = parts[1] || '';
  const name = parts[2] || base;
  return { code, role, name, filename: String(filename || '') };
}

function safePathSegment(s) {
  return String(s || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function extractAgentIdFromBody(body) {
  const s = String(body || '');
  const m = s.match(/^\s*ID[:：]\s*([A-Za-z0-9._-]+)\s*$/m);
  return m ? String(m[1] || '').trim() : '';
}

function isPersonaSourceFilename(filename) {
  const f = String(filename || '');
  if (!f.toLowerCase().endsWith('.md')) return false;
  if (f === 'SOUL.md') return false;
  if (!/^\d{2}_/.test(f)) return false;
  return true;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const agentsDir = path.join(root, 'workspace', 'AGENTS_SOUL');
  const wsRoot = path.join(agentsDir, '.openclaw-workspaces');

  if (!fs.existsSync(agentsDir)) {
    console.error('missing workspace/AGENTS_SOUL');
    process.exit(1);
  }

  ensureDir(wsRoot);

  const personaFiles = fs
    .readdirSync(agentsDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((f) => isPersonaSourceFilename(f))
    .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));

  const wrote = [];
  const missing = [];

  for (const f of personaFiles) {
    const meta = parseAgentFromFilename(f);
    const srcPath = path.join(agentsDir, f);
    const body = safeReadUtf8(srcPath);
    if (!String(body || '').trim()) {
      missing.push({ file: f, reason: 'empty persona source' });
      continue;
    }

    let agentId = extractAgentIdFromBody(body);
    if (!agentId) {
      if (String(meta.name || '').trim() === '银月') agentId = 'yinyue';
      else agentId = `agent-${safePathSegment(meta.code || 'xx')}-${Buffer.from(String(meta.name || ''), 'utf8').toString('hex').slice(0, 8)}`;
    }
    agentId = safePathSegment(agentId);
    if (!agentId) {
      missing.push({ file: f, reason: 'missing agentId' });
      continue;
    }

    const outDir = path.join(wsRoot, agentId);
    ensureDir(outDir);
    const outPath = path.join(outDir, 'SOUL.md');
    fs.writeFileSync(outPath, String(body), 'utf-8');
    wrote.push({ agentId, name: String(meta.name || '').trim(), sourceFile: f });
  }

  console.log(`sourceFiles=${personaFiles.length}`);
  console.log(`wrote=${wrote.length}`);
  for (const x of wrote) console.log(`${x.agentId} <= ${x.sourceFile}`);

  if (missing.length) {
    console.log(`missing=${missing.length}`);
    console.log(JSON.stringify(missing, null, 2));
    process.exit(2);
  }
}

main();
