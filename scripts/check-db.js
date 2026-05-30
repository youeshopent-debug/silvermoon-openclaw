const path = require('path');
const db = require('better-sqlite3')(path.join(__dirname, '..', 'user_data', 'memory', 'silvermoon_memory.sqlite'));
const rows = db.prepare("SELECT uid, substr(content,1,200) as c FROM mem WHERE uid LIKE 'seed:%' ORDER BY uid").all();
for (const r of rows) {
  console.log(r.uid);
  console.log('  =>', JSON.stringify(r.c));
}
// 检查 FTS5
try {
  const fts = db.prepare("SELECT rowid, substr(content,1,120) as c FROM mem_fts LIMIT 5").all();
  console.log('\n--- FTS5 first 5 ---');
  for (const r of fts) console.log(r.rowid, '=>', JSON.stringify(r.c));
} catch(e) { console.log('FTS5 error:', e.message); }
db.close();
