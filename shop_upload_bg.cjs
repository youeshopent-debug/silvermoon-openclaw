const https = require('https');
const token = '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';
const store = 'aigenie-hub.myshopify.com';
const themeId = '140905709667';

function shopify(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: store,
      path: '/admin/api/2024-01/' + endpoint,
      method,
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('=== 1. 下载 Unsplash 图片 ===\n');
  const imgData = await new Promise((resolve, reject) => {
    https.get('https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=80', res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
  console.log('  下载完成:', imgData.length, 'bytes');

  // 2. 上传为 theme asset
  console.log('\n=== 2. 上传到 Shopify theme assets ===\n');
  const b64 = imgData.toString('base64');
  const uploadResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/hero-bg.jpg', attachment: b64 }
  });
  if (uploadResult.errors) {
    console.log('  ❌ 上传失败:', JSON.stringify(uploadResult.errors));
    return;
  }
  console.log('  ✅ 已上传 hero-bg.jpg');

  // 3. 获取图片URL
  const assetInfo = await shopify('themes/' + themeId + '/assets.json?asset[key]=assets/hero-bg.jpg');
  const bgUrl = 'https://' + store + '/' + assetInfo.asset.public_url;
  console.log('  图片URL:', bgUrl);

  // 4. 读取 settings_data.json
  console.log('\n=== 3. 修改 settings_data.json ===\n');
  const settingsData = await shopify('themes/' + themeId + '/assets.json?asset[key]=config/settings_data.json');
  let settings = settingsData.asset.value;
  
  // 查找 hero_banner section 设置
  const parsed = JSON.parse(settings);
  const sections = parsed.current?.sections || {};
  const heroKey = Object.keys(sections).find(k => k.includes('hero_banner'));
  
  if (heroKey) {
    console.log('  找到 hero section:', heroKey);
    const heroSettings = sections[heroKey];
    console.log('  当前设置:', JSON.stringify(heroSettings, null, 2));
    
    // 设置图片
    // settings_data.json 中图片值需要是文件的 basename
    heroSettings.settings.image_1 = 'hero-bg.jpg';
    
    // 写回
    parsed.current.sections[heroKey] = heroSettings;
    const newSettings = JSON.stringify(parsed);
    
    const result = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
      asset: { key: 'config/settings_data.json', value: newSettings }
    });
    
    if (!result.errors) {
      console.log('  ✅ settings_data.json 已更新');
    } else {
      console.log('  ❌ 更新失败:', JSON.stringify(result.errors));
    }
  } else {
    console.log('  ⚠️ 未找到 hero_banner section');
    console.log('  所有 sections:', Object.keys(sections));
  }
}

main().catch(console.error);
