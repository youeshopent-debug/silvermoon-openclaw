const https = require('https');
const token = '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';
const store = 'aigenie-hub.myshopify.com';

function shopify(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: store,
      path: '/admin/api/2024-01/' + endpoint,
      method,
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== Home 页诊断 ===\n');

  // 1. 检查主题 assets 中的 custom-design.css.liquid
  console.log('1/6 检查 custom-design.css.liquid...');
  const cssAsset = await shopify('themes/140905709667/assets.json?asset[key]=assets/custom-design.css.liquid');
  if (cssAsset.asset) {
    console.log('   存在，大小: ' + (cssAsset.asset.size || '?') + ' bytes');
    console.log('   前200字符: ' + (cssAsset.asset.value || '').substring(0, 200));
  } else {
    console.log('   ❌ 不存在!');
    console.log('   响应: ' + JSON.stringify(cssAsset).substring(0, 200));
  }

  // 2. 获取主模板内容 (layout/theme.liquid)
  console.log('\n2/6 检查 layout/theme.liquid 是否引用了 custom-design.css...');
  const layout = await shopify('themes/140905709667/assets.json?asset[key]=layout/theme.liquid');
  if (layout.asset) {
    const val = layout.asset.value || '';
    if (val.includes('custom-design')) {
      console.log('   ✅ 已引用 custom-design.css.liquid');
    } else {
      console.log('   ❌ 未引用!');
    }
  } else {
    console.log('   无法读取 layout/theme.liquid');
  }

  // 3. 获取当前在线主题的信息
  console.log('\n3/6 检查主题信息和角色...');
  const themes = await shopify('themes.json');
  const mainTheme = themes.themes.find(t => t.role === 'main');
  if (mainTheme) {
    console.log('   主主题: ' + mainTheme.name + ' (ID: ' + mainTheme.id + ')');
    console.log('   状态: ' + mainTheme.role);
  }

  // 4. 检查首页 sections 配置
  console.log('\n4/6 检查首页 JSON 模板...');
  const indexJson = await shopify('themes/140905709667/assets.json?asset[key]=templates/index.json');
  if (indexJson.asset) {
    const index = JSON.parse(indexJson.asset.value);
    console.log('   Sections 数量: ' + Object.keys(index.sections || {}).length);
    for (const [k, v] of Object.entries(index.sections || {})) {
      console.log('   - ' + k + ': ' + v.type + (v.disabled ? ' [已禁用]' : ''));
    }
  } else {
    console.log('   ❌ 无法读取 templates/index.json');
    console.log('   响应: ' + JSON.stringify(indexJson).substring(0, 300));
  }

  // 5. 检查 settings_data.json 中是否有 section 组
  console.log('\n5/6 检查 settings_data.json sections 配置...');
  const sd = await shopify('themes/140905709667/assets.json?asset[key]=config/settings_data.json');
  if (sd.asset) {
    try {
      const data = JSON.parse(sd.asset.value);
      const sections = data.current && data.current.sections;
      if (sections) {
        console.log('   Sections 配置数量: ' + Object.keys(sections).length);
        for (const [k, v] of Object.entries(sections)) {
          console.log('   - ' + k + ': ' + JSON.stringify(v).substring(0, 80));
        }
      } else {
        console.log('   ❌ 没有 sections 配置');
      }
    } catch (e) {
      console.log('   JSON 解析失败: ' + e.message);
    }
  }

  // 6. 检查商店基本信息
  console.log('\n6/6 检查商店信息...');
  const shop = await shopify('shop.json');
  if (shop.shop) {
    console.log('   商店: ' + shop.shop.name);
    console.log('   域名: ' + shop.shop.domain);
    console.log('   计划: ' + shop.shop.plan_name);
    console.log('   启用密码: ' + (shop.shop.password_enabled ? '是' : '否'));
  }
}

main().catch(console.error);
