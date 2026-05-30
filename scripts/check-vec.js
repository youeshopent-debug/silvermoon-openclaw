const path = require('path');
const db = require('better-sqlite3')(path.join(__dirname, '..', 'user_data', 'memory', 'silvermoon_memory.sqlite'));

// 查所有向量
const allVecs = db.prepare("SELECT uid FROM mem_vec ORDER BY uid").all();
console.log('=== 全部向量 (' + allVecs.length + ' 条) ===');
for (const r of allVecs) {
  console.log('  ' + r.uid);
}

console.log('');

// 查非 seed 记忆的 content
const nonSeed = db.prepare("SELECT uid, substr(content,1,500) as preview FROM mem WHERE uid NOT LIKE 'seed:%' ORDER BY rowid").all();
console.log('=== 非 seed 记忆 (' + nonSeed.length + ' 条) ===');
for (const r of nonSeed) {
  console.log('--- ' + r.uid + ' ---');
  console.log(r.preview);
  console.log('');
}

// 查 seed:rules:agents 完整内容
const seed = db.prepare("SELECT uid, content FROM mem WHERE uid = 'seed:rules:agents'").get();
console.log('=== seed:rules:agents ===');
console.log('uid:', seed?.uid);
console.log('content:', JSON.stringify(seed?.content));

db.close();
