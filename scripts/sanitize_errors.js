const fs = require('fs');
const path = require('path');

function redact(s) {
  return String(s || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***@***')
    .replace(/\b(ch|pi|pm|cs|evt|req)_[A-Za-z0-9]+\b/g, (m) => m.slice(0, 4) + '***')
    .replace(/\b\d{5,}\b/g, '***');
}

function main() {
  const root = process.cwd();
  const inPath = path.join(root, 'workspace', 'CRON', 'errors.jsonl');
  const outDir = path.join(root, 'workspace', 'dropbox', '银月', 'Upwork', 'portfolio', 'discord-automation', 'evidence');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'errors_redacted.jsonl');

  if (!fs.existsSync(inPath)) {
    fs.writeFileSync(outPath, '', 'utf8');
    return;
  }

  const lines = fs.readFileSync(inPath, 'utf8').split(/\r?\n/).filter(Boolean).slice(-2000);
  const out = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const keep = {
        at: obj.at || null,
        kind: obj.kind || null,
        msg: redact(obj.msg || ''),
        detail: redact(obj.detail || ''),
        where: obj.where || null,
      };
      out.push(JSON.stringify(keep));
    } catch {}
  }
  fs.writeFileSync(outPath, out.join('\n') + '\n', 'utf8');
}

main();

