const { addRule, listRules, deleteRuleByPrefix, dbPaths } = require('../lib/memdb');

function usage() {
  const p = dbPaths();
  process.stdout.write(
    [
      '用法：',
      '  node scripts/memdb.js add <规则文本>',
      '  node scripts/memdb.js list [n]',
      '  node scripts/memdb.js del <id前缀>',
      '',
      `落盘：${p.file}`,
      '',
    ].join('\n'),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const sub = String(args[0] || '').toLowerCase();
  if (!sub) return usage();

  if (sub === 'add') {
    const text = args.slice(1).join(' ').trim();
    if (!text) return usage();
    const r = addRule(text, 'console', []);
    if (!r.ok) {
      process.stderr.write(`add_failed: ${r.error}\n`);
      process.exit(1);
    }
    process.stdout.write(`ok: ${r.item.id}\n`);
    return;
  }

  if (sub === 'list') {
    const n = Number(args[1] || 20) || 20;
    const rows = listRules(n);
    for (const r of rows) process.stdout.write(`${String(r.id).slice(0, 8)}\t${String(r.text).replace(/\s+/g, ' ').trim()}\n`);
    return;
  }

  if (sub === 'del') {
    const p = String(args[1] || '').trim();
    if (!p) return usage();
    const r = deleteRuleByPrefix(p);
    if (!r.ok) {
      process.stderr.write(`del_failed: ${r.error}\n`);
      process.exit(1);
    }
    process.stdout.write(`ok: removed=${r.removed}\n`);
    return;
  }

  return usage();
}

main().catch((e) => {
  process.stderr.write(`fatal: ${String(e?.message || e || '')}\n`);
  process.exit(1);
});

