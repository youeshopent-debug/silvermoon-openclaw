// 通过 ask-extension 端点获取完整 tools/list 数据
const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  const raw = await fetch('http://127.0.0.1:12306/ask-extension?action=tools/list');
  const parsed = JSON.parse(raw);
  console.log(JSON.stringify(parsed, null, 2));
})().catch(e => console.error('Error:', e.message));
