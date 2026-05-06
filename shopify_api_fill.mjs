import https from 'https';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: STORE,
      path: `/admin/api/2025-10${path}`,
      method,
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, errors: parsed.errors || parsed, raw: data.slice(0, 500) });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject({ status: res.statusCode, raw: data.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Shopify API 直接填资料 ===\n');

  // 1. 先读当前状态
  console.log('1. 当前店铺状态:');
  const shop = await rest('GET', '/shop.json');
  console.log(`   名称: ${shop.shop.name}`);
  console.log(`   邮箱: ${shop.shop.email}`);
  console.log(`   客户邮箱: ${shop.shop.customer_email}`);
  console.log(`   时区: ${shop.shop.iana_timezone}`);
  console.log(`   货币: ${shop.shop.currency}`);
  console.log(`   国家: ${shop.shop.country_code}`);
  console.log(`   店主: ${shop.shop.shop_owner}`);

  // 2. 用 REST API 更新店铺
  // Shopify REST API 的 PUT /admin/api/2025-10/shop.json 支持更新部分字段
  console.log('\n2. 更新店铺资料...');
  try {
    const result = await rest('PUT', '/shop.json', {
      shop: {
        name: 'SilverMoon Bank',
        customer_email: 'hello@silvermoon.bank',
        timezone: 'Asia/Kuala_Lumpur',
        iana_timezone: 'Asia/Kuala_Lumpur',
        weight_unit: 'kg',
        primary_locale: 'en',
      }
    });
    console.log('   ✅ 更新成功！');
    console.log(`   名称: ${result.shop.name}`);
    console.log(`   客户邮箱: ${result.shop.customer_email}`);
    console.log(`   时区: ${result.shop.iana_timezone}`);
  } catch (e) {
    console.log(`   ❌ 失败 (${e.status}):`, e.raw?.slice(0, 300) || e.errors?.message);
    
    // 如果 PUT /shop.json 不行，试试只改 customer_email
    if (e.status === 406 || e.status === 403) {
      console.log('\n   PUT /shop.json 权限不够，试试其他方式...');
      
      // 尝试用 GraphQL Admin API（shpat_ 可能支持部分 mutation）
      console.log('\n3. 尝试 GraphQL...');
      try {
        const gqlResult = await rest('POST', '/graphql.json', {
          query: `mutation {
            shopSettingsUpdate(shopSettingsInput: {
              name: "SilverMoon Bank"
              contactEmail: "hello@silvermoon.bank"
            }) {
              shop { name contactEmail }
              userErrors { field message }
            }
          }`
        });
        console.log('   GraphQL 返回:', JSON.stringify(gqlResult).slice(0, 300));
      } catch (gqlErr) {
        console.log(`   GraphQL 失败: ${gqlErr.status}`, gqlErr.raw?.slice(0, 200));
      }
    }
  }

  // 3. 最终验证
  console.log('\n4. 验证最终状态:');
  const final = await rest('GET', '/shop.json');
  console.log(`   名称: ${final.shop.name}`);
  console.log(`   客户邮箱: ${final.shop.customer_email}`);
  console.log(`   时区: ${final.shop.iana_timezone}`);
  console.log(`   货币: ${final.shop.currency}`);
  console.log(`   国家: ${final.shop.country_code}`);
  console.log(`   密码保护: ${final.shop.password_enabled}`);
}

main().catch(console.error);
