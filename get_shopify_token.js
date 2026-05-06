const http = require('http');
const https = require('https');
const { URL } = require('url');

const CLIENT_ID = '0f387d278390ada713efbe9cf65db1bb';
const CLIENT_SECRET = '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';
const SHOP = 'aigenie-hub.myshopify.com';
const SCOPES = 'write_products,read_products,write_orders,read_orders,write_customers,read_customers,write_inventory,read_inventory';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

// 1. 生成安装链接
const installUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPES}&redirect_uri=${REDIRECT_URI}`;
console.log('\n=== Shopify OAuth 授权 ===\n');
console.log('请在浏览器中打开以下链接进行授权：\n');
console.log(installUrl);
console.log('\n等待回调...\n');

// 2. 启动本地服务器接收回调
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code');
    const shop = url.searchParams.get('shop');
    
    if (!code) {
      res.writeHead(400);
      res.end('Missing code');
      return;
    }

    console.log('✅ 收到授权码:', code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>授权成功！请返回终端查看 Token。</h1><p>你可以关闭这个页面了。</p>');

    // 3. 用 code 换取 access token
    const postData = JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code
    });

    const options = {
      hostname: shop,
      path: '/admin/oauth/access_token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const tokenReq = https.request(options, (tokenRes) => {
      let data = '';
      tokenRes.on('data', (chunk) => data += chunk);
      tokenRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            console.log('\n🎉 成功获取 Access Token！\n');
            console.log('SHOPIFY_TOKEN=' + result.access_token);
            console.log('\n请将此 Token 填入 .env 文件中。');
          } else {
            console.error('\n❌ 获取 Token 失败:', result);
          }
        } catch (e) {
          console.error('\n❌ 解析响应失败:', data);
        }
        process.exit(0);
      });
    });

    tokenReq.on('error', (e) => {
      console.error('\n❌ 请求失败:', e.message);
      process.exit(1);
    });

    tokenReq.write(postData);
    tokenReq.end();
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('本地回调服务器运行在 http://localhost:3000');
});
