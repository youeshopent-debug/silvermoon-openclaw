import https from 'https';
import { URL } from 'url';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE || 'aigenie-hub.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN || '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';
const API_VERSION = '2025-10';

function shopifyRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${path}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
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
            reject({ status: res.statusCode, errors: parsed.errors || parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject({ status: res.statusCode, raw: data.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== 开始填写店铺资料 ===\n');

  // 1. 更新店铺基本信息
  console.log('1. 更新店铺名称、地址、联系方式...');
  try {
    const shopUpdate = await shopifyRequest('PUT', '/shop.json', {
      shop: {
        name: 'SilverMoon Bank',
        email: 'hello@silvermoon.bank',
        customer_email: 'hello@silvermoon.bank',
        phone: '+60123456789',
        address1: 'Unit 23-01, Level 23, Menara Exchange',
        address2: 'Jalan Tun Razak',
        city: 'Kuala Lumpur',
        province: 'Wilayah Persekutuan',
        zip: '50400',
        country: 'MY',
        timezone: 'Asia/Kuala_Lumpur',
        iana_timezone: 'Asia/Kuala_Lumpur',
        currency: 'USD',
        shop_owner: 'Alan Lau',
        weight_unit: 'kg',
        primary_locale: 'en',
      }
    });
    console.log('   ✅ 店铺基本信息已更新');
    console.log(`   名称: ${shopUpdate.shop.name}`);
    console.log(`   邮箱: ${shopUpdate.shop.email}`);
    console.log(`   地址: ${shopUpdate.shop.address1}, ${shopUpdate.shop.city}`);
    console.log(`   时区: ${shopUpdate.shop.iana_timezone}`);
    console.log(`   货币: ${shopUpdate.shop.currency}`);
  } catch (e) {
    console.log('   ❌ 更新失败:', e.errors || e.message);
  }

  // 2. 获取主题列表
  console.log('\n2. 获取当前主题...');
  try {
    const themes = await shopifyRequest('GET', '/themes.json');
    const activeTheme = themes.themes.find(t => t.role === 'main');
    if (activeTheme) {
      console.log(`   ✅ 当前主题: ${activeTheme.name} (ID: ${activeTheme.id})`);
    } else {
      console.log('   ⚠️ 未找到活跃主题');
    }
  } catch (e) {
    console.log('   ❌ 获取主题失败:', e.errors || e.message);
  }

  // 3. 获取政策列表
  console.log('\n3. 检查店铺政策...');
  try {
    const policies = await shopifyRequest('GET', '/policies.json');
    const policyTypes = policies.policies.map(p => p.type);
    console.log(`   已有政策: ${policyTypes.join(', ') || '无'}`);
  } catch (e) {
    console.log('   ❌ 获取政策失败:', e.errors || e.message);
  }

  // 4. 获取位置信息
  console.log('\n4. 获取仓库位置...');
  try {
    const locations = await shopifyRequest('GET', '/locations.json');
    locations.locations.forEach(loc => {
      console.log(`   📍 ${loc.name} - ${loc.city || '未设置地址'} (${loc.country_code || 'N/A'})`);
    });
  } catch (e) {
    console.log('   ❌ 获取位置失败:', e.errors || e.message);
  }

  // 5. 获取市场信息
  console.log('\n5. 获取市场配置...');
  try {
    const markets = await shopifyRequest('GET', '/markets.json');
    markets.markets.forEach(m => {
      console.log(`   🌐 ${m.name} - ${m.enabled ? '已启用' : '未启用'}`);
    });
  } catch (e) {
    console.log('   ❌ 获取市场失败:', e.errors || e.message);
  }

  // 6. 获取已安装的 App/插件
  console.log('\n6. 获取已安装应用...');
  try {
    const apps = await shopifyRequest('GET', '/applications/installed.json');
    console.log(`   已安装 ${apps.installed_applications?.length || 0} 个应用`);
    if (apps.installed_applications) {
      apps.installed_applications.forEach(a => {
        console.log(`   📦 ${a.name}`);
      });
    }
  } catch (e) {
    console.log('   ⚠️ 获取应用列表受限:', e.errors || e.message);
  }

  console.log('\n=== 店铺资料填写完成 ===');
}

main().catch(console.error);
