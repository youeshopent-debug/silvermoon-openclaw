const https = require('https');
const token = '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';
const store = 'aigenie-hub.myshopify.com';
const themeId = '140905709667';
const heroId = 'Hero-template--18670983839843__hero_banner';

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
  console.log('🌙 全面修复 Hero 背景图 — 使用真实 ID 选择器\n');

  const r = await shopify('themes/' + themeId + '/assets.json?asset[key]=assets/custom-design.css.liquid');
  let css = r.asset.value || '';

  // === 替换所有 color-scheme-6 hero CSS 为 hero ID 选择器 ===

  // 1. 移除旧的 color-scheme-6 Hero 相关 CSS（section 2-7）
  // 通过替换特定字符串来移除旧的 hero 区块
  const oldHeroBlock = css.match(/\/\* ---+\s*\n\s+2\. Hero[\s\S]*?\*\/\s*\n.color-scheme-6 \.hero__content-wrapper \> div:not\(:first-child\):not\(:last-child\) \{\s*[\s\S]*?\n\}/);
  
  // Also handle the desktop fix block
  const oldDesktopFix = css.match(/\/\* ========================================\s*\n\s+Hero 桌面端布局修复[\s\S]*?\*\/\s*@media screen[\s\S]*?\n\}/);
  
  if (oldHeroBlock) {
    console.log('  移除旧的 color-scheme-6 hero 区块');
    css = css.replace(oldHeroBlock[0], '');
  } else {
    console.log('  ⚠️ 未找到旧的 hero 区块，尝试按行删除...');
  }

  if (oldDesktopFix) {
    console.log('  移除旧的桌面端修复区块');
    css = css.replace(oldDesktopFix[0], '');
  } else {
    console.log('  ⚠️ 未找到旧的桌面端修复区块');
  }

  // 还要移除可能残留的旧 hero 背景行
  css = css.replace(/\.color-scheme-6\s*\.hero\s*\{[\s\S]*?\n\}/g, '');
  css = css.replace(/\.color-scheme-6\s*\.hero__container\s*\{[\s\S]*?\n\}/g, '');
  css = css.replace(/\.color-scheme-6\s*\.hero__media-grid\s*(img[^{]*)?\{[\s\S]*?\n\}/g, '');
  css = css.replace(/\.color-scheme-6\s*\.hero__content-wrapper\s*\{[\s\S]*?\n\}/g, '');
  css = css.replace(/\.color-scheme-6\s*\.hero__content-wrapper\s+h1[\s\S]*?\n\}/g, '');
  css = css.replace(/\.color-scheme-6\s*\.hero__content-wrapper\s+p[\s\S]*?\n\}/g, '');
  css = css.replace(/\.color-scheme-6\s*\.hero__content-wrapper\s+\.button[\s\S]*?\n\}/g, '');

  // Clean up empty lines from removals
  css = css.replace(/\n{3,}/g, '\n\n');

  // === 2. 注入正确的 Hero CSS（使用 hero ID）===
  const heroCSS = `
/* ========================================
   Hero 背景 + 遮罩（基于 ID 选择器）
   ======================================== */
#${heroId} {
  background-image: url("https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=80") !important;
  background-size: cover !important;
  background-position: center 30% !important;
  background-repeat: no-repeat !important;
  position: relative !important;
  overflow: hidden !important;
}

/* 隐藏 SVG 占位符（无图片时的默认显示） */
#${heroId} .hero__media-grid svg,
#${heroId} .hero__media-grid .hero__media {
  display: none !important;
}

/* 遮罩覆盖层 — 覆盖 overlay--gradient div */
#${heroId} .overlay--gradient {
  background: rgba(0,0,0,0.4) !important;
}

/* 内容层 — 确保在最上层 */
#${heroId} .hero__content-wrapper {
  position: relative !important;
  z-index: 2 !important;
}

/* 桌面端垂直堆叠布局 */
@media screen and (min-width: 750px) {
  #${heroId} .hero__content-wrapper {
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
  }

  #${heroId} .hero__content-wrapper h1,
  #${heroId} .hero__content-wrapper .h1 {
    font-size: 48px !important;
    max-width: 100% !important;
    white-space: nowrap !important;
    text-align: center !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  #${heroId} .hero__content-wrapper .button {
    min-width: 200px !important;
    text-align: center !important;
    margin-left: auto !important;
    margin-right: auto !important;
    background-color: #FF6B35 !important;
  }
  #${heroId} .hero__content-wrapper .button:hover {
    background-color: #e85d2a !important;
  }

  /* Trust bar 在按钮下方 */
  #${heroId} .hero__content-wrapper > div:not(:first-child):not(:last-child) {
    text-align: center !important;
    margin-top: 24px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}
`;

  css += heroCSS;

  // === 3. 写入 Shopify ===
  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: css }
  });
  console.log('  ✅ custom-design.css.liquid 已更新 (' + css.length + ' bytes)');

  // === 4. 验证 ===
  const verify = await shopify('themes/' + themeId + '/assets.json?asset[key]=assets/custom-design.css.liquid');
  const v = verify.asset.value || '';
  console.log('\n=== 验证 ===');
  const checks = [
    ['包含 hero ID 选择器', v.includes('#' + heroId)],
    ['包含新背景图', v.includes('photo-1500835556837-99ac94a94552')],
    ['包含 rgba 遮罩', v.includes('rgba(0,0,0,0.4)')],
    ['包含橙色按钮', v.includes('#FF6B35')],
    ['不包含旧的 color-scheme-6 hero', !v.includes('.color-scheme-6 .hero {')],
  ];
  checks.forEach(([name, ok]) => console.log('  ' + (ok ? '✅' : '❌') + ' ' + name));

  console.log('\n✅ 完成！请在外部浏览器硬刷新 (Ctrl+F5) 查看效果');
}

main().catch(console.error);
