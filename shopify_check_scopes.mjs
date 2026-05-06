import https from 'https';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';

function req(method, path, body = null, apiVer = '2025-10') {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: STORE,
      path: `/admin/api/${apiVer}${path}`,
      method,
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    const r = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data.slice(0, 500), headers: res.headers });
        }
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('Timeout')); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  console.log('=== 检查 Token 权限范围 ===\n');

  // 1. 查 Token 的 scope（通过访问一个需要权限的端点看返回头）
  console.log('1. 检查 Token 权限...');
  const r = await req('GET', '/shop.json');
  console.log(`   状态: ${r.status}`);
  console.log(`   X-Shopify-Shop-Api-Call-Limit: ${r.headers['x-shopify-shop-api-call-limit']}`);
  
  // 2. 试试不同 API 版本
  console.log('\n2. 测试不同 API 版本...');
  for (const ver of ['2024-10', '2025-01', '2025-04', '2025-07', '2025-10']) {
    const r2 = await req('PUT', '/shop.json', { shop: { customer_email: 'hello@silvermoon.bank' } }, ver);
    console.log(`   ${ver}: ${r2.status} ${r2.body?.shop?.customer_email || r2.raw?.slice(0, 80) || 'ok'}`);
  }

  // 3. 试试用 access scope 端点
  console.log('\n3. 查 OAuth Access Scopes...');
  const scopes = await req('GET', '/oauth/access_scopes.json');
  console.log(`   ${scopes.status}:`, JSON.stringify(scopes.body).slice(0, 300));

  // 4. 试试用 2024-01 版本（更老但可能支持更多）
  console.log('\n4. 尝试 2024-01 版本...');
  const r3 = await req('PUT', '/shop.json', {
    shop: {
      name: 'SilverMoon Bank',
      customer_email: 'hello@silvermoon.bank',
      timezone: 'Asia/Kuala_Lumpur',
      iana_timezone: 'Asia/Kuala_Lumpur',
    }
  }, '2024-01');
  console.log(`   状态: ${r3.status}`);
  if (r3.body?.shop) {
    console.log(`   名称: ${r3.body.shop.name}`);
    console.log(`   邮箱: ${r3.body.shop.customer_email}`);
  } else {
    console.log(`   返回: ${r3.raw?.slice(0, 200)}`);
  }

  // 5. 最终验证
  console.log('\n5. 最终验证...');
  const final = await req('GET', '/shop.json');
  console.log(`   名称: ${final.body.shop.name}`);
  console.log(`   客户邮箱: ${final.body.shop.customer_email}`);
  console.log(`   时区: ${final.body.shop.iana_timezone}`);
}

main().catch(console.error);
