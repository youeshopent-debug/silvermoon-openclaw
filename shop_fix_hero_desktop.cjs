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
  console.log('🌙 读取当前 custom-design.css...');
  const r = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=assets/custom-design.css.liquid');
  let css = r.asset?.value || '';
  console.log('  当前 CSS 大小: ' + css.length + ' bytes');

  // === 桌面端 Hero 布局修复（Kimi 提示词）===
  // 仅在桌面端生效，不碰移动端
  const heroDesktopFix = `

/* ========================================
   Hero 桌面端布局修复 — 垂直堆叠版
   ======================================== */
@media screen and (min-width: 750px) {
  .color-scheme-6 .hero__content-wrapper {
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
  }

  .color-scheme-6 .hero__content-wrapper h1,
  .color-scheme-6 .hero__content-wrapper .h1 {
    font-size: 48px !important;
    max-width: 100% !important;
    white-space: nowrap !important;
    text-align: center !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .color-scheme-6 .hero__content-wrapper p,
  .color-scheme-6 .hero__content-wrapper .body {
    text-align: center !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .color-scheme-6 .hero__content-wrapper .button {
    min-width: 200px !important;
    text-align: center !important;
    margin-left: auto !important;
    margin-right: auto !important;
    background-color: #FF6B35 !important;
  }
  .color-scheme-6 .hero__content-wrapper .button:hover {
    background-color: #e85d2a !important;
  }

  /* Trust bar — 确保在按钮下方 */
  .color-scheme-6 .hero__content-wrapper .trust-bar,
  .color-scheme-6 .hero__content-wrapper [class*="trust"],
  .color-scheme-6 .hero__content-wrapper [class*="usp"],
  .color-scheme-6 .hero__content-wrapper .header__inline-menu,
  .color-scheme-6 .hero__content-wrapper > div:not(:first-child):not(:last-child) {
    text-align: center !important;
    margin-top: 24px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}
`;

  // 只在末尾追加，避免重复
  if (css.includes('Hero 桌面端布局修复')) {
    console.log('  ⚠️  Hero 桌面端修复已存在，跳过');
  } else {
    css += heroDesktopFix;
    console.log('  追加 Hero 桌面端修复...');
  }

  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: css }
  });
  console.log('  ✅ custom-design.css.liquid 已更新');
  console.log('  最终 CSS 大小: ' + css.length + ' bytes');

  // 验证
  const verify = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=assets/custom-design.css.liquid');
  console.log('  验证大小: ' + verify.asset.value.length + ' bytes');
  console.log('  包含 @media: ' + verify.asset.value.includes('@media screen and (min-width: 750px)'));
  console.log('');
  console.log('✅ 完成！请用外部浏览器打开 https://aigenie-hub.myshopify.com/ 查看效果');
}

main().catch(console.error);
