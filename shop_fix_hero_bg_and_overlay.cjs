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
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🌙 更新 Hero 背景图 + 遮罩...\n');

  const r = await shopify('themes/' + themeId + '/assets.json?asset[key]=assets/custom-design.css.liquid');
  let css = r.asset.value || '';

  // 1. 替换背景图 — 从卡通山湖换成真实旅行场景（traveler looking at map）
  const oldBg = 'photo-1617864064479-3420e2f1f277';
  const newBg = 'photo-1500835556837-99ac94a94552';

  if (css.includes(oldBg)) {
    css = css.replace(new RegExp(oldBg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newBg);
    console.log('  ✅ 背景图已替换: cartoon → realistic travel');
  } else if (css.includes(newBg)) {
    console.log('  ℹ️  新背景图已存在');
  } else {
    console.log('  ⚠️  未找到旧背景图 URL，尝试直接替换 background-image 行...');
    // fallback: 替换任何 unsplash hero background
    css = css.replace(
      /background-image:\s*url\("https:\/\/images\.unsplash\.com\/[^"]+"\)\s*!important;/,
      'background-image: url("https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=80") !important;'
    );
    console.log('  ✅ 背景图已替换（fallback 模式）');
  }

  // 2. 把渐变遮罩改为 rgba(0,0,0,0.4) 实色遮罩
  const oldOverlay = 'background: linear-gradient(180deg, rgba(1,1,2,0.7) 0%, rgba(1,1,2,0.3) 50%, rgba(1,1,2,0.8) 100%) !important;';
  const newOverlay = 'background: rgba(0,0,0,0.4) !important;';

  if (css.includes(oldOverlay)) {
    css = css.replace(oldOverlay, newOverlay);
    console.log('  ✅ 遮罩已更新: gradient → rgba(0,0,0,0.4) solid');
  } else {
    console.log('  ℹ️  遮罩可能已更新或格式不同，检查中...');
    // 查找任何 ::after 中的 background
    const overlayMatch = css.match(/\.color-scheme-6\s*\.hero__media-grid::after[\s\S]{0,200}?\}/);
    if (overlayMatch) {
      console.log('  当前 overlay CSS:');
      console.log('  ' + overlayMatch[0].slice(0, 300));
    }
  }

  // 写入
  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: css }
  });

  console.log('\n  ✅ custom-design.css.liquid 已更新');
  console.log('  CSS size: ' + css.length + ' bytes');

  // 验证
  const verify = await shopify('themes/' + themeId + '/assets.json?asset[key]=assets/custom-design.css.liquid');
  const v = verify.asset.value || '';
  const checks = [
    ['包含新背景图', v.includes('photo-1500835556837-99ac94a94552')],
    ['不包含旧背景图', !v.includes('photo-1617864064479-3420e2f1f277')],
    ['包含新遮罩 rgba', v.includes('rgba(0,0,0,0.4)')],
    ['包含按钮橙色 #FF6B35', v.includes('#FF6B35')],
    ['包含桌面端 @media', v.includes('@media screen and (min-width: 750px)')],
  ];
  console.log('\n=== 验证结果 ===');
  checks.forEach(([name, ok]) => console.log('  ' + (ok ? '✅' : '❌') + ' ' + name));

  console.log('\n✅ 完成！请在外部浏览器打开 https://aigenie-hub.myshopify.com/ 查看效果');
  console.log('  新背景: traveler looking at map (realistic travel scene)');
  console.log('  遮罩: rgba(0,0,0,0.4) 确保白色文字可读');
}

main().catch(console.error);
