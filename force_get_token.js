const https = require('https');

const CLIENT_ID = '0f387d278390ada713efbe9cf65db1bb';
const CLIENT_SECRET = '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';
const SHOP = 'aigenie-hub.myshopify.com';

// 既然已经安装，我们尝试直接用 offline access token 模式获取
const postData = JSON.stringify({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET
});

const options = {
  hostname: SHOP,
  path: '/admin/oauth/access_token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('正在尝试直接获取 Token...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('状态码:', res.statusCode);
    console.log('返回结果:', data);
  });
});

req.on('error', (e) => {
  console.error('请求失败:', e.message);
});

req.write(postData);
req.end();
