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

async function main() {
  console.log('=== 深度店铺装修 ===\n');

  // 1. 查当前完整状态
  console.log('1. 当前状态:');
  const shop = await rest('GET', '/shop.json');
  console.log(`   名称: ${shop.shop.name}`);
  console.log(`   邮箱: ${shop.shop.email}`);
  console.log(`   客户邮箱: ${shop.shop.customer_email}`);
  console.log(`   地址1: ${shop.shop.address1}`);
  console.log(`   城市: ${shop.shop.city}`);
  console.log(`   邮编: ${shop.shop.zip}`);
  console.log(`   时区: ${shop.shop.iana_timezone}`);
  console.log(`   货币: ${shop.shop.currency}`);
  console.log(`   国家: ${shop.shop.country_code}`);
  console.log(`   重量单位: ${shop.shop.weight_unit}`);
  console.log(`   店主: ${shop.shop.shop_owner}`);
  console.log(`   密码保护: ${shop.shop.password_enabled}`);

  // 2. REST API 能改的字段有限，试试逐个字段更新
  console.log('\n2. 尝试更新可改字段...');
  
  // 先试 customer_email（这个通常可以改）
  try {
    await rest('PUT', '/shop.json', {
      shop: {
        customer_email: 'hello@silvermoon.bank',
        phone: '+60123456789',
        timezone: 'Asia/Kuala_Lumpur',
        iana_timezone: 'Asia/Kuala_Lumpur',
        weight_unit: 'kg',
        primary_locale: 'en',
      }
    });
    console.log('   ✅ 基础字段已更新');
  } catch (e) {
    console.log('   ⚠️ 基础字段更新失败:', e.errors?.message || e.message);
  }

  // 3. 创建政策（用 GraphQL 试试）
  console.log('\n3. 创建店铺政策...');
  try {
    const policyQ = `mutation {
      policyCreate(policy: {
        type: REFUND_POLICY
        title: "Refund Policy"
        body: "At SilverMoon Bank, we stand behind our products. Digital products: all sales are final but we offer support within 14 days. Physical merchandise: returns accepted within 30 days of delivery. Contact: hello@silvermoon.bank"
      }) {
        policy { id title type }
        userErrors { field message }
      }
    }`;
    const r = await rest('POST', '/graphql.json', { query: policyQ });
    console.log('   📋 政策创建结果:', JSON.stringify(r.data?.policyCreate?.userErrors || r.data?.policyCreate?.policy));
  } catch (e) {
    console.log('   ⚠️ 政策创建失败:', e.errors?.message || e.message);
  }

  // 4. 获取主题 settings_data 看看品牌色配置
  console.log('\n4. 读取主题配置...');
  try {
    const asset = await rest('GET', `/themes/140905709667/assets.json?asset[key]=config/settings_data.json`);
    const settings = JSON.parse(asset.asset.value);
    const colors = settings.current?.colors || settings.preset?.colors || {};
    console.log('   主题配色:', JSON.stringify(colors).slice(0, 300));
  } catch (e) {
    console.log('   ⚠️ 主题配置读取失败:', e.errors?.message || e.message);
  }

  // 5. 验证最终状态
  console.log('\n5. 验证最终状态...');
  const final = await rest('GET', '/shop.json');
  console.log(`   名称: ${final.shop.name}`);
  console.log(`   客户邮箱: ${final.shop.customer_email}`);
  console.log(`   电话: ${final.shop.phone}`);
  console.log(`   时区: ${final.shop.iana_timezone}`);
  console.log(`   重量单位: ${final.shop.weight_unit}`);

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
