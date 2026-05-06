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
  console.log('🎨 银月钱庄 — 强制暗色科技风部署\n');

  // 1. 更新 settings_data.json — 确保 scheme-6 所有字段正确
  console.log('[1/3] 更新颜色方案 scheme-6...');
  const sd = await shopify(`themes/${themeId}/assets.json?asset%5Bkey%5D=config/settings_data.json`);
  const settings = JSON.parse(sd.asset.value);

  settings.current.color_schemes['scheme-6'] = {
    settings: {
      background: 'rgba(1,1,2,1)',
      foreground_heading: '#ffffff',
      foreground: '#f7f8f8',
      primary: '#36F4A4',
      primary_hover: '#2bd893',
      border: '#23252a',
      shadow: '#000000',
      primary_button_background: '#36F4A4',
      primary_button_text: '#000000',
      primary_button_border: '#36F4A4',
      primary_button_hover_background: '#2bd893',
      primary_button_hover_text: '#000000',
      primary_button_hover_border: '#2bd893',
      secondary_button_background: 'rgba(0,0,0,0)',
      secondary_button_text: '#36F4A4',
      secondary_button_border: '#36F4A4',
      secondary_button_hover_background: '#36F4A414',
      secondary_button_hover_text: '#36F4A4',
      secondary_button_hover_border: '#36F4A4',
      input_background: '#1a1a1e',
      input_text_color: '#f7f8f8',
      input_border_color: '#23252a',
      input_hover_background: '#23252a',
      variant_background_color: '#1a1a1e',
      variant_text_color: '#f7f8f8',
      variant_border_color: '#23252a',
      variant_hover_background_color: '#23252a',
      variant_hover_text_color: '#ffffff',
      variant_hover_border_color: '#36F4A4',
      selected_variant_background_color: '#36F4A4',
      selected_variant_text_color: '#000000',
      selected_variant_border_color: '#36F4A4',
      selected_variant_hover_background_color: '#2bd893',
      selected_variant_hover_text_color: '#000000',
      selected_variant_hover_border_color: '#2bd893'
    }
  };

  await shopify(`themes/${themeId}/assets.json`, 'PUT', {
    asset: { key: 'config/settings_data.json', value: JSON.stringify(settings) }
  });
  console.log('  ✅ scheme-6 已更新');

  // 2. 重写 custom-design.css — 用 color-scheme-6 选择器覆盖主题变量
  console.log('[2/3] 重写 custom-design.css...');
  const css = `/* ========================================
   银月钱庄 SilverMoon Bank — 暗色科技风
   作者: 李长寿
   版本: v3.0 (强制覆盖)
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

/* ---------- 2. Hero 背景图 + 隐藏占位图 ---------- */
.color-scheme-6 .hero {
  background-image: url('https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80') !important;
  background-size: cover !important;
  background-position: center !important;
}
.color-scheme-6 .hero__media-grid,
.color-scheme-6 .placeholder-svg,
.color-scheme-6 .hero__media {
  display: none !important;
}

/* ---------- 3. Hero 渐变遮罩 ---------- */
.color-scheme-6 .hero::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(180deg, rgba(1,1,2,0.7) 0%, rgba(1,1,2,0.3) 50%, rgba(1,1,2,0.8) 100%) !important;
  z-index: 1 !important;
  display: block !important;
}
.color-scheme-6 .hero__content-wrapper {
  position: relative !important;
  z-index: 2 !important;
}

/* ---------- 4. Hero 文字样式 ---------- */
.color-scheme-6 .hero__content-wrapper h1 {
  color: #ffffff !important;
  font-size: clamp(2rem, 5vw, 4rem) !important;
  font-weight: 800 !important;
  line-height: 1.1 !important;
  text-shadow: 0 2px 20px rgba(0,0,0,0.6) !important;
}
.color-scheme-6 .hero__content-wrapper p {
  color: #c0c0c0 !important;
  font-size: clamp(1rem, 2vw, 1.25rem) !important;
  line-height: 1.6 !important;
  text-shadow: 0 1px 10px rgba(0,0,0,0.5) !important;
}

/* ---------- 5. 霓虹按钮 ---------- */
.color-scheme-6 .hero__content-wrapper .button,
.color-scheme-6 .button--primary {
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
  transition: all 0.3s ease !important;
}
.color-scheme-6 .hero__content-wrapper .button:hover {
  background-color: #ffffff !important;
  color: #000000 !important;
  box-shadow: 0 0 30px rgba(54, 244, 164, 0.7) !important;
  transform: translateY(-2px) !important;
}

/* ---------- 6. Marquee 跑马灯 ---------- */
.color-scheme-6 .marquee-bar {
  background-color: #000000 !important;
  border-top: 1px solid #36F4A4 !important;
  border-bottom: 1px solid #36F4A4 !important;
}
.color-scheme-6 .marquee-bar p,
.color-scheme-6 .marquee-bar span {
  color: #36F4A4 !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
}

/* ---------- 7. Footer ---------- */
.color-scheme-6 footer,
.color-scheme-6 .footer {
  background-color: #000000 !important;
  border-top: 1px solid #23252a !important;
  color: #666 !important;
}

/* ---------- 8. 产品展示区 ---------- */
.color-scheme-6 .featured-product {
  background-color: #010102 !important;
}
.color-scheme-6 .product-card {
  background-color: #1a1a1e !important;
  border: 1px solid #23252a !important;
  border-radius: 12px !important;
}
`;

  await shopify(`themes/${themeId}/assets.json`, 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: css }
  });
  console.log('  ✅ custom-design.css 已重写');

  // 3. 验证
  console.log('[3/3] 验证...');
  const verify = await shopify(`themes/${themeId}/assets.json?asset%5Bkey%5D=assets/custom-design.css.liquid`);
  console.log(`  ✅ CSS 文件大小: ${verify.asset.value.length} 字节`);
  console.log(`  ✅ 包含 .color-scheme-6: ${verify.asset.value.includes('.color-scheme-6')}`);
  console.log(`  ✅ 包含 #010102: ${verify.asset.value.includes('#010102')}`);

  console.log('\n🎯 部署完成！请刷新 Shopify 首页查看效果。');
}

main().catch(console.error);
