const db = require('better-sqlite3')('./user_data/memory/silvermoon_memory.sqlite', { readonly: true });

// 1. Count non-seed entries
const nonSeed = db.prepare("SELECT COUNT(*) as c FROM mem WHERE uid NOT LIKE 'seed:%'").get().c;
const nonSeedVec = db.prepare("SELECT COUNT(*) as c FROM mem_vec WHERE uid NOT LIKE 'seed:%'").get().c;
console.log('non-seed mem:', nonSeed, '  non-seed vec:', nonSeedVec);

// 2. Show ALL unique UIDs
const uids = db.prepare("SELECT uid FROM mem ORDER BY uid").all();
console.log('\nAll UIDs (' + uids.length + '):');
uids.forEach(u => console.log('  ' + u.uid.substring(0, 45)));

// 3. Find entries about 李长寿 - show raw hex to detect encoding issues
const lcs = db.prepare("SELECT uid, content FROM mem WHERE content LIKE '%李长寿%'").all();
console.log('\n李长寿 entries (' + lcs.length + '):');
lcs.forEach(e => {
  const preview = e.content.substring(0, 300);
  // Check for garbled markers
  const hasSections = preview.includes('\u00a7');
  const hasReplacements = preview.includes('\ufffd');
  const hasWeirdChars = /[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\s,\.\(\)\/\-—]/.test(preview);
  console.log('  UID:', e.uid.substring(0, 40));
  console.log('  Content:', preview);
  console.log('  Garbled? sections=' + hasSections + ' replacements=' + hasReplacements + ' weird=' + hasWeirdChars);
  console.log('');
});

// 4. Find entries about Web3.0/RWA
const web3 = db.prepare("SELECT uid, content FROM mem WHERE content LIKE '%Web3%' OR content LIKE '%RWA%'").all();
console.log('Web3/RWA entries (' + web3.length + '):');
web3.forEach(e => {
  console.log('  UID:', e.uid.substring(0, 40));
  console.log('  Content:', e.content.substring(0, 200));
});

// 5. Find entries with UI/UX
const ux = db.prepare("SELECT uid, content FROM mem WHERE content LIKE '%UI/UX%'").all();
console.log('\nUI/UX entries (' + ux.length + '):');
ux.forEach(e => console.log('  UID:', e.uid.substring(0, 40), '  Content:', e.content.substring(0, 150)));

db.close();
