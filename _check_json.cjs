const fs = require('fs');
const s = fs.readFileSync('openclaw.json', 'utf8').replace(/^\uFEFF/, '');
try {
  JSON.parse(s);
  console.log('✅ JSON 有效');
} catch(e) {
  console.error('❌ JSON 无效:', e.message.slice(0,200));
}
