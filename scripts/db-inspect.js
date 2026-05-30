const db = require('better-sqlite3')('user_data/memory/silvermoon_memory.sqlite');

// 1. Check seed:rules:agents (the "14个智能体" entry)
const r1 = db.prepare("SELECT uid, content, length(content) as len FROM mem WHERE uid='seed:rules:agents'").get();
if (r1) {
  const c = r1.content;
  console.log('=== seed:rules:agents ===');
  console.log('len:', r1.len);
  console.log('has UI/UX:', c.includes('UI/UX'));
  console.log('has SEOSEO:', c.includes('SEO'));
  console.log('has shared_memory:', c.includes('shared_memory'));
  console.log('has Trae:', c.includes('Trae'));
  console.log('has OpenClaw:', c.includes('OpenClaw'));
  console.log('has 界面:', c.includes('界面'));
  console.log('content:', c);
} else {
  console.log('seed:rules:agents NOT FOUND');
}

// 2. Check seed:openclaw:overview (李长寿条目)
const r2 = db.prepare("SELECT uid, content FROM mem WHERE uid='seed:openclaw:overview'").get();
if (r2) {
  const c = r2.content;
  console.log('\n=== seed:openclaw:overview ===');
  console.log('has Next.js:', c.includes('Next.js'));
  console.log('has Web3.0:', c.includes('Web3.0'));
  console.log('has §§:', c.includes('§'));
  console.log('content:', c);
}

// 3. Check seed:openclaw:lichangshou
const r3 = db.prepare("SELECT uid, content FROM mem WHERE uid='seed:openclaw:lichangshou'").get();
if (r3) {
  const c = r3.content;
  console.log('\n=== seed:openclaw:lichangshou ===');
  console.log('has Next.js:', c.includes('Next.js'));
  console.log('has Web3.0:', c.includes('Web3.0'));
  console.log('has §§:', c.includes('§'));
  console.log('content:', c);
}

// 4. List ALL uids
const all = db.prepare('SELECT uid, length(content) as len FROM mem ORDER BY uid').all();
console.log('\n=== ALL MEMORIES ===');
all.forEach(r => console.log(r.uid, '(', r.len, 'bytes)'));

// 5. Check mem_vec uids
const vecs = db.prepare('SELECT uid FROM mem_vec ORDER BY uid').all();
console.log('\n=== ALL VECTORS ===');
vecs.forEach(r => console.log(r.uid));

db.close();
