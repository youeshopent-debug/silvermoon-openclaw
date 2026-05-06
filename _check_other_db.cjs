const D=require('better-sqlite3');
const path = require('path');

// 1. Check silvermoon_local version
const localPath = 'silvermoon_local/silvermoon/user_data/memory/silvermoon_memory.sqlite';
try {
  const d = new D(localPath);
  const cnt = d.prepare('SELECT COUNT(*) as n FROM mem').get();
  const vec = d.prepare('SELECT COUNT(*) as n FROM mem_vec').get();
  console.log('=== silvermoon_local ===');
  console.log('mem:', cnt.n, 'mem_vec:', vec.n);
  if (cnt.n > 0) {
    const rows = d.prepare("SELECT uid, substr(content,1,200) as c FROM mem LIMIT 10").all();
    rows.forEach(r => console.log(r.uid, '=>', JSON.stringify(r.c)));
  }
  d.close();
} catch(e) {
  console.log('silvermoon_local error:', e.message);
}

// 2. Check memory/main.sqlite
console.log('\n=== memory/main.sqlite ===');
try {
  const d = new D('memory/main.sqlite');
  const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('tables:', tables.map(t => t.name));
  // Check for mem table
  if (tables.some(t => t.name === 'mem')) {
    const cnt = d.prepare('SELECT COUNT(*) as n FROM mem').get();
    console.log('mem count:', cnt.n);
  }
  d.close();
} catch(e) {
  console.log('memory/main.sqlite error:', e.message);
}

// 3. Also check: does gateway main.js use a different path?
console.log('\n=== checking main.js ===');
const fs = require('fs');
const mainContent = fs.readFileSync('main.js', 'utf8');
const matches = mainContent.match(/memory|memorySqlite|sqlite/gi);
if (matches) {
  console.log('main.js memory references:', matches.join(', '));
}

// 4. Search for any hardcoded sqlite paths in main.js or lib files
console.log('\n=== searching for sqlite paths in lib/*.js ===');
const libFiles = fs.readdirSync('lib').filter(f => f.endsWith('.js'));
libFiles.forEach(f => {
  const content = fs.readFileSync(path.join('lib', f), 'utf8');
  const pathMatches = content.match(/['"][^'"]*sqlite[^'"]*['"]/gi);
  if (pathMatches) {
    console.log(f + ':', pathMatches.join(', '));
  }
});
