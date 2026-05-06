import https from 'https';
import { URL } from 'url';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';
const VER = '2025-10';

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${STORE}/admin/api/${VER}${path}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) { resolve({ status: res.statusCode, raw: data.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Shopify API 权限审计 ===\n');

  // 测试各种 REST 端点
  const endpoints = [
    ['GET', '/shop.json', '读取店铺'],
    ['PUT', '/shop.json', '更新店铺'],
    ['GET', '/products.json?limit=1', '读取商品'],
    ['POST', '/products.json', '创建商品'],
    ['GET', '/orders.json?limit=1', '读取订单'],
    ['GET', '/customers.json?limit=1', '读取客户'],
    ['GET', '/themes.json', '读取主题'],
    ['GET', '/policies.json', '读取政策'],
    ['POST', '/policies.json', '创建政策'],
    ['GET', '/locations.json', '读取位置'],
    ['GET', '/collects.json?limit=1', '读取分类'],
    ['GET', '/pages.json?limit=1', '读取页面'],
    ['POST', '/pages.json', '创建页面'],
    ['GET', '/blogs.json', '读取博客'],
    ['GET', '/redirects.json?limit=1', '读取重定向'],
    ['GET', '/price_rules.json?limit=1', '读取折扣'],
    ['GET', '/webhooks.json', '读取Webhook'],
  ];

  for (const [method, path, desc] of endpoints) {
    try {
      const r = await rest(method, path, method === 'POST' ? { product: { title: 'test', status: 'draft' } } : null);
      const ok = r.status < 400;
      console.log(`   ${ok ? '✅' : '❌'} ${method} ${path}`);
      console.log(`      ${desc}: ${ok ? '可用' : `拒绝 (${r.status})`}`);
      if (r.body?.errors) console.log(`      错误: ${JSON.stringify(r.body.errors).slice(0, 100)}`);
    } catch (e) {
      console.log(`   ❌ ${method} ${path}: 异常 - ${e.message}`);
    }
  }

  // 测试 GraphQL
  console.log('\n--- GraphQL 测试 ---');
  try {
    const q = `{
      shop { name email contactEmail myshopifyDomain }
      products(first: 1) { edges { node { id title } } }
    }`;
    const r = await rest('POST', '/graphql.json', { query: q });
    if (r.data) {
      console.log(`   ✅ GraphQL 查询可用`);
      console.log(`   店铺: ${r.data.shop?.name}`);
    } else {
      console.log(`   ❌ GraphQL 失败:`, JSON.stringify(r.errors).slice(0, 200));
    }
  } catch (e) {
    console.log(`   ❌ GraphQL 异常: ${e.message}`);
  }

  console.log('\n=== 审计完成 ===');
}

main().catch(console.error);
