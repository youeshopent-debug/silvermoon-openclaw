const d = require('better-sqlite3')('C:\\Users\\User\\.openclaw\\workspace\\CASHCLAW\\ledger.sqlite', {readonly: true});

console.log('📊 Tables:', JSON.stringify(d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()));

try {
  const rows = d.prepare('SELECT id, amount, currency, status, created_at FROM payments ORDER BY created_at DESC LIMIT 3').all();
  console.log('💳 Recent payments:', JSON.stringify(rows, null, 2));
} catch(e) {
  console.log('payments table query error:', e.message);
  // try other tables
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  for (const t of tables) {
    try {
      const r = d.prepare(`SELECT * FROM "${t.name}" ORDER BY rowid DESC LIMIT 1`).all();
      console.log(`  ${t.name}:`, JSON.stringify(r));
    } catch(e2) { console.log(`  ${t.name}: error - ${e2.message}`); }
  }
}

d.close();
