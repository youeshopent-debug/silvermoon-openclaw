const API = require('./lib/shopify-api');
const T = 140905709667; // Horizon theme

const BRAND_CSS = `/* ========================================
   AIGenie Vision — AI Tech Brand v1.0
   品牌: #6C5CE7 紫 / #00D4FF 青
   ======================================== */

/* ---------- 0. CSS 自定义属性 ---------- */
.color-scheme-6 {
  --ag-primary: #6C5CE7;
  --ag-accent: #00D4FF;
  --ag-emphasis: #F72585;
  --ag-bg-deep: #0A0A0F;
  --ag-bg-card: #1A1A2E;
  --ag-bg-elevated: #252540;
  --ag-text: #F0F0F5;
  --ag-text-secondary: #9090A8;
  --ag-gradient: linear-gradient(135deg, #6C5CE7, #00D4FF);
  --ag-gradient-glow: linear-gradient(135deg, rgba(108,92,231,0.3), rgba(0,212,255,0.3));
  --ag-border: rgba(108,92,231,0.2);
  --ag-glow: 0 0 30px rgba(108,92,231,0.15);
}

/* ---------- 1. 全局暗色基底 ---------- */
.color-scheme-6,
.color-scheme-6 body,
.color-scheme-6 #MainContent,
.color-scheme-6 .gradient {
  background-color: var(--ag-bg-deep) !important;
  color: var(--ag-text) !important;
}

/* ---------- 2. Header 品牌化 ---------- */
.color-scheme-6 .header-wrapper,
.color-scheme-6 .header {
  background-color: rgba(10,10,15,0.95) !important;
  border-bottom: 1px solid var(--ag-border) !important;
  backdrop-filter: blur(12px);
}
.color-scheme-6 .header__menu-item {
  color: var(--ag-text) !important;
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 500 !important;
  letter-spacing: 0.02em !important;
  transition: color 0.2s !important;
}
.color-scheme-6 .header__menu-item:hover {
  color: var(--ag-accent) !important;
}
.color-scheme-6 .header__icon {
  color: var(--ag-text) !important;
}
.color-scheme-6 .header__heading-link {
  color: var(--ag-text) !important;
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  letter-spacing: 0.05em !important;
}
.color-scheme-6 .header__active-menu-item {
  color: var(--ag-accent) !important;
  text-decoration-color: var(--ag-accent) !important;
}

/* ---------- 3. 按钮 ---------- */
.color-scheme-6 .button,
.color-scheme-6 .shopify-challenge__button {
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
  letter-spacing: 0.03em !important;
  border-radius: 50px !important;
  padding: 14px 36px !important;
  transition: all 0.3s ease !important;
}
.color-scheme-6 .button--primary {
  background: var(--ag-gradient) !important;
  color: #ffffff !important;
  border: none !important;
  box-shadow: 0 4px 20px rgba(108,92,231,0.35) !important;
}
.color-scheme-6 .button--primary:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 30px rgba(108,92,231,0.5) !important;
}
.color-scheme-6 .button--secondary {
  background: transparent !important;
  color: var(--ag-text) !important;
  border: 1.5px solid var(--ag-border) !important;
}
.color-scheme-6 .button--secondary:hover {
  border-color: var(--ag-accent) !important;
  color: var(--ag-accent) !important;
  box-shadow: 0 0 20px rgba(0,212,255,0.15) !important;
}

/* ---------- 4. Hero 区域 ---------- */
.color-scheme-6 .hero__media-grid::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(135deg, rgba(10,10,15,0.85), rgba(26,26,46,0.7)) !important;
  z-index: 1 !important;
}
.color-scheme-6 .hero__content h1,
.color-scheme-6 .hero__content .h1 {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
  background: var(--ag-gradient) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

/* ---------- 5. Marquee 跑马灯 ---------- */
.color-scheme-6 .marquee-bar {
  background-color: var(--ag-bg-card) !important;
  border-top: 1px solid var(--ag-border) !important;
  border-bottom: 1px solid var(--ag-border) !important;
  padding: 14px 0 !important;
}
.color-scheme-6 .marquee-bar p,
.color-scheme-6 .marquee-bar span {
  background: var(--ag-gradient) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  font-family: 'Space Grotesk', sans-serif !important;
  letter-spacing: 0.08em !important;
  font-size: 13px !important;
}

/* ---------- 6. 产品卡片 ---------- */
.color-scheme-6 .card,
.color-scheme-6 .card-wrapper {
  background: var(--ag-bg-card) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 16px !important;
  transition: all 0.3s ease !important;
  overflow: hidden !important;
}
.color-scheme-6 .card:hover {
  border-color: rgba(108,92,231,0.4) !important;
  box-shadow: var(--ag-glow), 0 8px 32px rgba(0,0,0,0.3) !important;
  transform: translateY(-4px) !important;
}
.color-scheme-6 .card .card__heading a {
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
  color: var(--ag-text) !important;
}
.color-scheme-6 .price {
  font-family: 'JetBrains Mono', monospace !important;
  font-weight: 600 !important;
  color: var(--ag-accent) !important;
}
.color-scheme-6 .price .price-item--sale {
  color: var(--ag-emphasis) !important;
}
.color-scheme-6 .price .price-item--regular {
  color: var(--ag-text-secondary) !important;
  text-decoration: line-through !important;
}
.color-scheme-6 .card__badge .badge {
  background: var(--ag-gradient) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 50px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  padding: 4px 14px !important;
}

/* ---------- 7. 图片圆角 ---------- */
.color-scheme-6 .card .card__media {
  border-radius: 16px 16px 0 0 !important;
}

/* ---------- 8. 产品标题 ---------- */
.color-scheme-6 .product__title h1 {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  background: var(--ag-gradient) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

/* ---------- 9. Footer ---------- */
.color-scheme-6 footer,
.color-scheme-6 .footer {
  background-color: var(--ag-bg-deep) !important;
  border-top: 1px solid var(--ag-border) !important;
  color: var(--ag-text-secondary) !important;
}
.color-scheme-6 .footer h2,
.color-scheme-6 .footer .h4 {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 600 !important;
  color: var(--ag-text) !important;
  letter-spacing: 0.05em !important;
}
.color-scheme-6 .footer a {
  color: var(--ag-text-secondary) !important;
  transition: color 0.2s !important;
}
.color-scheme-6 .footer a:hover {
  color: var(--ag-accent) !important;
}

/* ---------- 10. 输入框 ---------- */
.color-scheme-6 input,
.color-scheme-6 textarea,
.color-scheme-6 select {
  background: var(--ag-bg-elevated) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 12px !important;
  color: var(--ag-text) !important;
  font-family: 'Inter', sans-serif !important;
}
.color-scheme-6 input:focus,
.color-scheme-6 textarea:focus {
  border-color: var(--ag-accent) !important;
  box-shadow: 0 0 0 3px rgba(0,212,255,0.1) !important;
  outline: none !important;
}

/* ---------- 11. 渐变装饰 ---------- */
.color-scheme-6 .gradient-decorator {
  position: relative !important;
  overflow: hidden !important;
}
.color-scheme-6 .gradient-decorator::before {
  content: '' !important;
  position: absolute !important;
  top: -50% !important;
  left: -50% !important;
  width: 200% !important;
  height: 200% !important;
  background: radial-gradient(circle at 50% 50%, rgba(108,92,231,0.08), transparent 60%) !important;
  pointer-events: none !important;
}

/* ---------- 12. _Blocks 标题排版 ---------- */
.color-scheme-6 .blocks__content h2 {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  font-size: clamp(1.5rem, 3vw, 2.5rem) !important;
  color: var(--ag-text) !important;
  margin: 0 0 8px !important;
  line-height: 1.3 !important;
}
.color-scheme-6 .blocks__content h3 {
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
  font-size: 1.15rem !important;
  color: var(--ag-text) !important;
  margin: 20px 0 8px !important;
}
.color-scheme-6 .blocks__content p {
  color: var(--ag-text-secondary) !important;
  line-height: 1.65 !important;
  font-size: 0.95rem !important;
  margin: 0 0 4px !important;
}

/* ---------- 13. FAQ 卡片背景 ---------- */
.color-scheme-6 .blocks__content > .blocks__block:nth-child(n+2) {
  background: var(--ag-bg-card) !important;
  border: 1px solid var(--ag-border) !important;
  border-radius: 16px !important;
  padding: 20px !important;
  margin-bottom: 12px !important;
  transition: all 0.2s !important;
}

/* ---------- 14. 移动端响应 ---------- */
@media (max-width: 749px) {
  .color-scheme-6 .blocks__content h2,
  .color-scheme-6 .blocks__content h3 {
    text-align: center !important;
  }
}

/* ========== Hero 桌面端 ========== */
@media (min-width: 750px) {
  #Hero-template--18670983839843__hero_banner {
    background: linear-gradient(135deg, #0A0A0F 0%, #1A1A2E 50%, #0A0A0F 100%) !important;
    position: relative !important;
    overflow: hidden !important;
  }
  #Hero-template--18670983839843__hero_banner::after {
    content: '' !important;
    position: absolute !important;
    top: 0 !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: 600px !important;
    height: 600px !important;
    background: radial-gradient(circle, rgba(108,92,231,0.15), transparent 60%) !important;
    pointer-events: none !important;
  }
  #Hero-template--18670983839843__hero_banner .hero__media-grid {
    display: none !important;
  }
  #Hero-template--18670983839843__hero_banner::before {
    display: none !important;
  }
  #Hero-template--18670983839843__hero_banner .hero__content-wrapper {
    position: relative !important;
    z-index: 2 !important;
    max-width: 700px !important;
    margin: 0 auto !important;
  }
  #Hero-template--18670983839843__hero_banner .hero__content-wrapper h1 {
    font-family: 'Orbitron', sans-serif !important;
    font-weight: 700 !important;
    font-size: clamp(2.5rem, 5vw, 4rem) !important;
    line-height: 1.1 !important;
    margin-bottom: 20px !important;
  }
  #Hero-template--18670983839843__hero_banner .hero__content-wrapper a.button {
    background: linear-gradient(135deg, #6C5CE7, #00D4FF) !important;
    color: #ffffff !important;
    border-radius: 50px !important;
    padding: 16px 40px !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-weight: 600 !important;
    box-shadow: 0 4px 20px rgba(108,92,231,0.35) !important;
    transition: all 0.3s ease !important;
  }
  #Hero-template--18670983839843__hero_banner .hero__content-wrapper a.button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 30px rgba(108,92,231,0.5) !important;
  }
}

@media (max-width: 749px) {
  #Hero-template--18670983839843__hero_banner {
    background: linear-gradient(135deg, #0A0A0F 0%, #1A1A2E 100%) !important;
  }
  #Hero-template--18670983839843__hero_banner .hero__media-grid {
    display: none !important;
  }
}`;

const FONTS_LIQUID = `<!-- AIGenie Vision Brand Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&family=Orbitron:wght@600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  h1, h2, h3, .h1, .h2, .h3 { font-family: 'Orbitron', sans-serif !important; }
  body, p, li, a:not(.button) { font-family: 'Inter', sans-serif !important; }
  .price, .money { font-family: 'JetBrains Mono', monospace !important; }
  .subtitle, .kicker { font-family: 'Space Grotesk', sans-serif !important; }
</style>`;

async function main() {
  // Step 1: Update custom-design.css.liquid
  console.log('📝 Step 1: Uploading brand CSS...');
  try {
    const cssResult = await API.updateThemeAsset(T, 'assets/custom-design.css.liquid', BRAND_CSS);
    console.log('   ✅ CSS updated:', cssResult.asset?.key);
  } catch(e) {
    console.log('   ❌ CSS upload failed:', e.message.slice(0,100));
  }

  // Step 2: Read current theme.liquid, inject Google Fonts
  console.log('\n📝 Step 2: Injecting Google Fonts into theme.liquid...');
  try {
    const themeLiquid = await API.getThemeAsset(T, 'layout/theme.liquid');
    let content = themeLiquid.asset.value;
    const headClose = '</head>';
    
    if (content.includes('AIGenie Vision Brand Fonts')) {
      console.log('   ⏭️  Fonts already injected, skipping');
    } else {
      const idx = content.lastIndexOf(headClose);
      if (idx > -1) {
        content = content.slice(0, idx) + FONTS_LIQUID + '\n' + content.slice(idx);
        const result = await API.updateThemeAsset(T, 'layout/theme.liquid', content);
        console.log('   ✅ Fonts injected into theme.liquid');
      } else {
        console.log('   ❌ Could not find </head>');
      }
    }
  } catch(e) {
    console.log('   ❌ theme.liquid update failed:', e.message.slice(0,100));
  }

  console.log('\n✅ All updates complete!');
}

main().catch(console.error);
