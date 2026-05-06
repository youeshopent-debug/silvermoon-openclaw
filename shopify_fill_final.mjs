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
          if (res.statusCode >= 400) reject({ status: res.statusCode, errors: parsed.errors || parsed, raw: data.slice(0, 300) });
          else resolve(parsed);
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
  console.log('=== 最终店铺填写 ===\n');

  // 1. 先读当前状态
  const shop = await rest('GET', '/shop.json');
  console.log('当前店铺:');
  console.log(`  名称: ${shop.shop.name}`);
  console.log(`  邮箱: ${shop.shop.email}`);
  console.log(`  客户邮箱: ${shop.shop.customer_email}`);
  console.log(`  店主: ${shop.shop.shop_owner}`);
  console.log(`  时区: ${shop.shop.iana_timezone}`);
  console.log(`  货币: ${shop.shop.currency}`);
  console.log(`  国家: ${shop.shop.country_code}`);

  // 2. 尝试 PUT /shop.json 只改 customer_email 和时区
  console.log('\n--- 尝试更新可改字段 ---');
  try {
    const r = await rest('PUT', '/shop.json', {
      shop: {
        customer_email: 'hello@silvermoon.bank',
        timezone: 'Asia/Kuala_Lumpur',
        iana_timezone: 'Asia/Kuala_Lumpur',
        weight_unit: 'kg',
        primary_locale: 'en',
      }
    });
    console.log('✅ PUT /shop.json 成功:', JSON.stringify(r.shop).slice(0, 200));
  } catch (e) {
    console.log(`❌ PUT /shop.json 失败 (${e.status}):`, e.raw?.slice(0, 200) || e.errors?.message);
  }

  // 3. 验证更新结果
  console.log('\n--- 验证更新 ---');
  const after = await rest('GET', '/shop.json');
  console.log(`  客户邮箱: ${after.shop.customer_email}`);
  console.log(`  时区: ${after.shop.iana_timezone}`);
  console.log(`  重量单位: ${after.shop.weight_unit}`);

  // 4. 如果 REST 不行，试试用 GraphQL（虽然 shpat_ 可能不支持）
  console.log('\n--- 尝试 GraphQL 更新 ---');
  try {
    const q = `mutation {
      shopSettingsUpdate(shopSettingsInput: {
        name: "SilverMoon Bank"
        contactEmail: "hello@silvermoon.bank"
      }) { shop { name contactEmail } userErrors { field message } }
    }`;
    const r = await rest('POST', '/graphql.json', { query: q });
    console.log('GraphQL 返回:', JSON.stringify(r).slice(0, 300));
  } catch (e) {
    console.log(`GraphQL 失败: ${e.status}`, e.raw?.slice(0, 200));
  }

  // 5. 最终状态
  console.log('\n--- 最终状态 ---');
  const final = await rest('GET', '/shop.json');
  console.log(`  名称: ${final.shop.name}`);
  console.log(`  客户邮箱: ${final.shop.customer_email}`);
  console.log(`  时区: ${final.shop.iana_timezone}`);
  console.log(`  货币: ${final.shop.currency}`);
  console.log(`  国家: ${final.shop.country_code}`);
  console.log(`  密码保护: ${final.shop.password_enabled}`);
}

main().catch(console.error);
