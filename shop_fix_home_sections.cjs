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
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🌙 李长寿 — Home 页深度修复 v2\n');

  // === FIX 1: 更新 Hero section — 添加背景图引用 + 反折叠 ===
  console.log('[1/3] 更新 templates/index.json — 解锁 Hero 内容可见性...');
  const res = await shopify(`themes/${themeId}/assets.json?asset[key]=templates/index.json`);
  const index = JSON.parse(res.asset.value);

  index.sections.hero_banner.settings = {
    ...index.sections.hero_banner.settings,
    section_height: 'large',
    media_type_1: 'image',
    image_1: 'https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80',
    media_count: 1,
    color_scheme: 'scheme-6',
    toggle_overlay: true,
    overlay_style: 'gradient',
    overlay_color: '#000000',
    section_width: 'full',
    horizontal_alignment_flex_direction_column: 'center',
    vertical_alignment_flex_direction_column: 'center',
    gap: 24,
    content_direction: 'column'
  };

  await shopify(`themes/${themeId}/assets.json`, 'PUT', {
    asset: { key: 'templates/index.json', value: JSON.stringify(index, null, 2) }
  });
  console.log('  ✅ index.json 已更新（Hero 解锁高度 + 背景图引用）');

  // === FIX 2: 重写 CSS — 防塌陷 + 可见性保证 ===
  console.log('\n[2/3] 重写 custom-design.css.liquid — 防塌陷加固...');
  const css = `/* ========================================
   银月钱庄 SilverMoon Bank — 暗色科技风 v4.0
   作者: 李长寿
   ======================================== */

/* ---------- 0. 全局暗色基底 ---------- */
.color-scheme-6,
.color-scheme-6 body,
.color-scheme-6 #MainContent,
.color-scheme-6 .gradient {
  background-color: #010102 !important;
  color: #f7f8f8 !important;
}

/* ---------- 1. Header 强制暗色 ---------- */
.color-scheme-6 .header-wrapper,
.color-scheme-6 .header {
  background-color: #010102 !important;
  border-bottom: 1px solid #23252a !important;
}
.color-scheme-6 .header__menu-item,
.color-scheme-6 .header__icon,
.color-scheme-6 .header__heading-link {
  color: #ffffff !important;
}

/* ---------- 2. Hero — 防塌陷 + 暗色基底 ---------- */
.color-scheme-6 .hero {
  min-height: 600px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  position: relative !important;
  overflow: hidden !important;
}
.color-scheme-6 .hero__container {
  min-height: 600px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
}

/* ---------- 3. 隐藏占位图，确保背景图生效 ---------- */
.color-scheme-6 .hero__media-grid img.placeholder-svg,
.color-scheme-6 .placeholder-svg {
  display: none !important;
}
.color-scheme-6 .hero__media-grid {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0 !important;
}
.color-scheme-6 .hero__media-grid img:not(.placeholder-svg) {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

/* ---------- 4. 渐变遮罩 ---------- */
.color-scheme-6 .hero__media-grid::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(180deg, rgba(1,1,2,0.7) 0%, rgba(1,1,2,0.3) 50%, rgba(1,1,2,0.8) 100%) !important;
  z-index: 1 !important;
}

/* ---------- 5. Hero 内容 — 强制显示 ---------- */
.color-scheme-6 .hero__content-wrapper {
  position: relative !important;
  z-index: 2 !important;
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  padding: 60px 24px !important;
  max-width: 800px !important;
  margin: 0 auto !important;
  pointer-events: auto !important;
}

/* ---------- 6. Hero 文字 ---------- */
.color-scheme-6 .hero__content-wrapper h1,
.color-scheme-6 .hero__content-wrapper .h1 {
  color: #ffffff !important;
  font-size: clamp(2rem, 5vw, 4rem) !important;
  font-weight: 800 !important;
  line-height: 1.1 !important;
  margin-bottom: 16px !important;
  text-shadow: 0 2px 20px rgba(0,0,0,0.6) !important;
}
.color-scheme-6 .hero__content-wrapper p,
.color-scheme-6 .hero__content-wrapper .body {
  color: #d0d0d0 !important;
  font-size: clamp(1rem, 2vw, 1.25rem) !important;
  line-height: 1.6 !important;
  max-width: 600px !important;
  text-shadow: 0 1px 10px rgba(0,0,0,0.5) !important;
  margin-bottom: 24px !important;
}

/* ---------- 7. 霓虹 CTA 按钮 ---------- */
.color-scheme-6 .hero__content-wrapper .button {
  background-color: #36F4A4 !important;
  color: #000000 !important;
  border-radius: 50px !important;
  padding: 16px 40px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  box-shadow: 0 0 20px rgba(54, 244, 164, 0.5) !important;
  border: none !important;
  font-size: 1rem !important;
  display: inline-block !important;
  pointer-events: auto !important;
}
.color-scheme-6 .hero__content-wrapper .button:hover {
  background-color: #ffffff !important;
  color: #000000 !important;
  box-shadow: 0 0 30px rgba(54, 244, 164, 0.7) !important;
  transform: translateY(-2px) !important;
}

/* ---------- 8. Marquee 跑马灯 ---------- */
.color-scheme-6 .marquee-bar {
  background-color: #000000 !important;
  border-top: 1px solid #36F4A4 !important;
  border-bottom: 1px solid #36F4A4 !important;
  padding: 12px 0 !important;
}
.color-scheme-6 .marquee-bar p,
.color-scheme-6 .marquee-bar span {
  color: #36F4A4 !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
}

/* ---------- 9. Footer ---------- */
.color-scheme-6 footer,
.color-scheme-6 .footer {
  background-color: #000000 !important;
  border-top: 1px solid #23252a !important;
  color: #666 !important;
}

/* ---------- 10. 产品展示 ---------- */
.color-scheme-6 .featured-product {
  background-color: #010102 !important;
}
.color-scheme-6 .featured-product h2 {
  color: #ffffff !important;
}`;

  await shopify(`themes/${themeId}/assets.json`, 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: css }
  });
  console.log('  ✅ custom-design.css.liquid 已重写');

  // === FIX 3: 验证 ===
  console.log('\n[3/3] 验证...');
  const verifyCss = await shopify(`themes/${themeId}/assets.json?asset[key]=assets/custom-design.css.liquid`);
  console.log(`  CSS 大小: ${verifyCss.asset.value.length} bytes`);
  console.log(`  包含 .hero__content-wrapper: ${verifyCss.asset.value.includes('.hero__content-wrapper')}`);
  console.log(`  包含 min-height: ${verifyCss.asset.value.includes('min-height: 600px')}`);

  const verifyIdx = await shopify(`themes/${themeId}/assets.json?asset[key]=templates/index.json`);
  const idx = JSON.parse(verifyIdx.asset.value);
  console.log(`  Hero blocks: ${Object.keys(idx.sections.hero_banner.blocks).length}`);
  console.log(`  Hero settings: media_count=${idx.sections.hero_banner.settings.media_count}, image_1=${idx.sections.hero_banner.settings.image_1 ? 'set' : 'empty'}`);

  console.log('\n✅ 修复完成！请在外部浏览器查看:');
  console.log('   https://aigenie-hub.myshopify.com/');
  console.log('   (Trae 内置浏览器会阻止 CDN 资源加载，用 Chrome/Firefox 看)');
}

main().catch(console.error);
