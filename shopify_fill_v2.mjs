import https from 'https';
import { URL } from 'url';

const SHOPIFY_STORE = 'aigenie-hub.myshopify.com';
const SHOPIFY_TOKEN = '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';
const API_VERSION = '2025-10';

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${path}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject({ status: res.statusCode, errors: parsed.errors || parsed });
          else resolve(parsed);
        } catch (e) { reject({ status: res.statusCode, raw: data.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function gql(query, variables = {}) {
  return rest('POST', '/graphql.json', { query, variables });
}

async function main() {
  console.log('=== SilverMoon Bank 店铺装修 ===\n');

  // 1. 先查一下当前店铺完整信息
  console.log('1. 查询当前店铺状态...');
  const shop = await rest('GET', '/shop.json');
  console.log(`   当前名称: ${shop.shop.name}`);
  console.log(`   当前邮箱: ${shop.shop.email}`);
  console.log(`   国家: ${shop.shop.country_code}`);
  console.log(`   货币: ${shop.shop.currency}`);
  console.log(`   时区: ${shop.shop.iana_timezone}`);
  console.log(`   主题: Horizon (ID: ${140905709667})`);

  // 2. 尝试用 GraphQL 更新店铺名称和邮箱
  console.log('\n2. 更新店铺名称 → SilverMoon Bank...');
  try {
    const q = `mutation {
      shopSettingsUpdate(shopSettingsInput: {
        name: "SilverMoon Bank"
        contactEmail: "hello@silvermoon.bank"
      }) {
        shop { name email contactEmail }
        userErrors { field message }
      }
    }`;
    const r = await gql(q);
    if (r.data?.shopSettingsUpdate?.userErrors?.length > 0) {
      console.log('   ⚠️ GraphQL 错误:', r.data.shopSettingsUpdate.userErrors.map(e => `${e.field}: ${e.message}`).join('; '));
    } else {
      console.log('   ✅ 名称已更新');
    }
  } catch (e) {
    console.log('   ⚠️ GraphQL 更新失败（可能权限不够）:', e.errors?.message || e.message);
  }

  // 3. 更新店铺地址（REST API 支持）
  console.log('\n3. 更新店铺地址...');
  try {
    await rest('PUT', '/shop.json', {
      shop: {
        address1: 'Unit 23-01, Level 23, Menara Exchange',
        address2: 'Jalan Tun Razak',
        city: 'Kuala Lumpur',
        province: 'Wilayah Persekutuan',
        zip: '50400',
        country: 'MY',
        phone: '+60123456789',
        customer_email: 'hello@silvermoon.bank',
        timezone: 'Asia/Kuala_Lumpur',
        iana_timezone: 'Asia/Kuala_Lumpur',
        weight_unit: 'kg',
        primary_locale: 'en',
      }
    });
    console.log('   ✅ 地址已更新');
  } catch (e) {
    console.log('   ⚠️ 地址更新:', e.errors?.message || e.message);
  }

  // 4. 创建店铺政策（退款/隐私/服务条款）
  console.log('\n4. 创建店铺政策...');
  const policies = [
    { type: 'refund_policy', title: 'Refund Policy', body: `
## Refund Policy

At SilverMoon Bank, we stand behind our digital products and physical merchandise.

### Digital Products
Due to the nature of digital goods, all sales of digital products (templates, guides, code snippets) are final. If you experience technical issues, contact us at hello@silvermoon.bank within 14 days for assistance.

### Physical Merchandise
You may return unworn, unopened physical items within 30 days of delivery for a full refund. Return shipping costs are the responsibility of the buyer.

### Processing Time
Refunds are processed within 5-10 business days and will be credited to your original payment method.

Contact: hello@silvermoon.bank
    ` },
    { type: 'privacy_policy', title: 'Privacy Policy', body: `
## Privacy Policy

Last updated: May 2026

SilverMoon Bank ("we", "our", "us") respects your privacy.

### Information We Collect
- Name, email address, shipping address
- Payment information (processed securely by Stripe/Shopify Payments)
- Browsing behavior on our store

### How We Use Your Information
- Process orders and payments
- Send order updates and shipping confirmations
- Improve our products and store experience
- Send marketing emails (only with your consent)

### Data Protection
We implement industry-standard security measures. Your data is never sold to third parties.

### Contact
hello@silvermoon.bank
    ` },
    { type: 'terms_of_service', title: 'Terms of Service', body: `
## Terms of Service

### General
By accessing SilverMoon Bank, you agree to these terms.

### Products
- Digital products: For personal use only. Redistribution is prohibited.
- Physical products: Subject to availability. We reserve the right to cancel orders due to stock limitations.

### Pricing
All prices are in USD. We reserve the right to modify prices at any time.

### Intellectual Property
All digital products, code snippets, and guides are the intellectual property of SilverMoon Bank.

### Limitation of Liability
SilverMoon Bank is not liable for any indirect damages arising from the use of our products.

### Contact
hello@silvermoon.bank
    ` },
  ];

  for (const policy of policies) {
    try {
      await rest('POST', '/policies.json', { policy });
      console.log(`   ✅ ${policy.title} 已创建`);
    } catch (e) {
      console.log(`   ⚠️ ${policy.title} 创建失败:`, e.errors?.message || e.message);
    }
  }

  // 5. 更新主题设置（品牌色）
  console.log('\n5. 配置主题品牌色...');
  try {
    // 获取主题资源
    const assets = await rest('GET', `/themes/140905709667/assets.json?asset[key]=config/settings_data.json`);
    console.log('   ✅ 主题配置可访问');
  } catch (e) {
    console.log('   ⚠️ 主题配置访问:', e.errors?.message || e.message);
  }

  // 6. 创建导航菜单
  console.log('\n6. 创建导航菜单...');
  try {
    // 先查现有菜单
    const menus = await rest('GET', '/smart_collections.json');
    console.log(`   现有商品分类: ${menus.smart_collections?.length || 0} 个`);
  } catch (e) {
    console.log('   ⚠️ 菜单查询:', e.errors?.message || e.message);
  }

  // 7. 最终状态
  console.log('\n7. 验证最终状态...');
  const finalShop = await rest('GET', '/shop.json');
  console.log(`   店铺名称: ${finalShop.shop.name}`);
  console.log(`   联系邮箱: ${finalShop.shop.customer_email}`);
  console.log(`   地址: ${finalShop.shop.address1 || '未设置'}, ${finalShop.shop.city || '未设置'}`);
  console.log(`   时区: ${finalShop.shop.iana_timezone}`);
  console.log(`   货币: ${finalShop.shop.currency}`);
  console.log(`   国家: ${finalShop.shop.country_code}`);

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
