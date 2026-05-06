const https = require('https');
const token = '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';
const store = 'aigenie-hub.myshopify.com';
const themeId = '140905709667';
const bgUrl = 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=80';

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
  console.log('🌙 修改 hero.liquid — 替换 SVG 占位符为真实背景图\n');

  // 1. 读取 hero.liquid
  const r = await shopify('themes/' + themeId + '/assets.json?asset[key]=sections/hero.liquid');
  let tmpl = r.asset.value || '';
  console.log('  hero.liquid 原始大小:', tmpl.length, '字符');

  // 2. 统计替换前 SVG 占位符数量
  const beforeMatches = tmpl.match(/\{\{[^}]*hero-apparel-1[^}]*\}\}/g);
  console.log('  SVG 占位符出现次数:', beforeMatches ? beforeMatches.length : 0);

  // 3. 替换 SVG 占位符为真实 img
  const imgTag = `<img src="${bgUrl}" class="hero__media" alt="Travel destination" loading="eager" />`;
  const newTmpl = tmpl.replace(/\{\{.*?hero-apparel-1.*?placeholder_svg_tag.*?hero__media.*?\}\}/g, imgTag);

  // 4. 验证替换
  const afterMatches = newTmpl.match(/\{\{[^}]*hero-apparel-1[^}]*\}\}/g);
  console.log('  替换后 SVG 占位符剩余:', afterMatches ? afterMatches.length : 0);

  // 5. 写入
  const putResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'sections/hero.liquid', value: newTmpl }
  });
  if (putResult.errors) {
    console.log('  ❌ 写入失败:', JSON.stringify(putResult.errors));
    return;
  }
  console.log('  ✅ hero.liquid 已更新 (' + newTmpl.length + ' 字符)');

  // 6. 验证
  const verify = await shopify('themes/' + themeId + '/assets.json?asset[key]=sections/hero.liquid');
  const v = verify.asset?.value || '';
  console.log('\n=== 验证 ===');
  console.log('  ✅ 包含 Unsplash URL:', v.includes('photo-1500835556837-99ac94a94552'));
  console.log('  ✅ 不含 SVG 占位符:', !v.includes('hero-apparel-1') || v.match(/\{\{[^}]*hero-apparel-1[^}]*\}\}/g) === null);
  console.log('  📏 大小:', v.length, '字符');
  console.log('\n✅ 完成！请在浏览器硬刷新 Ctrl+F5 查看效果');
}

main().catch(console.error);
