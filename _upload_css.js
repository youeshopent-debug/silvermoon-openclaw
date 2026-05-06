const api = require('./lib/shopify-api');

const CSS = `/* ============================================================
   SilverMoon Bank · Brand Theme v2.0
   "Warm Orange × Digital Minimal"
   Primary: #E85D2C (Warm Orange)
   Paper:   #F5F0EB (Warm White)
   CTA:     #39FF14 (Fluorescent Green)
   ============================================================ */

/* ── Design Tokens ── */
:root {
  --ag-orange:       #E85D2C;
  --ag-orange-soft:  #D4764A;
  --ag-orange-light: #F4D0B5;
  --ag-orange-pale:  #FAE8DA;
  --ag-paper:        #F5F0EB;
  --ag-paper-dark:   #EDE4DA;
  --ag-cream:        #FDF9F5;
  --ag-black:        #1A1A1A;
  --ag-gray-900:     #2C2616;
  --ag-gray-700:     #7A6B58;
  --ag-gray-400:     #B5A898;
  --ag-gray-200:     #D9D0C4;
  --ag-cta:          #39FF14;
  --ag-cta-hover:    #2EE010;
  --ag-cta-text:     #1A1A1A;
  --ag-border:       #E85D2C;
  --ag-border-subtle:#F4D0B5;
  --ag-badge-bg:     #1A1A1A;
  --ag-badge-text:   #F5F0EB;
}

/* ── Google Fonts 注入 ── */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Grotesk:wght@400;500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

h1, h2, h3, h4, h5, h6,
.section-title,
.heading {
  font-family: 'Orbitron', sans-serif !important;
  letter-spacing: 0.02em;
}

body, p, .text-body, .rte {
  font-family: 'Inter', sans-serif !important;
}

.cta-button, .btn, button:not(.header__icon),
.marquee-text {
  font-family: 'Space Grotesk', sans-serif !important;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.price, .money, .product-card__price {
  font-family: 'JetBrains Mono', monospace !important;
}

/* ── Global Background ── */
body {
  background-color: var(--ag-paper) !important;
  color: var(--ag-gray-900) !important;
}

/* ── Header / Navigation ── */
.header, .header-wrapper {
  background-color: var(--ag-black) !important;
  border-bottom: 2px solid var(--ag-orange) !important;
}
.header__heading, .header__heading a,
.header__menu-item, .header__active-menu-item {
  color: var(--ag-paper) !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.8rem;
}
.header__menu-item:hover {
  color: var(--ag-orange) !important;
}
.header__icon .icon {
  color: var(--ag-paper) !important;
}

/* ── Hero Section ── */
.hero-banner, .slideshow, .banner {
  background-color: var(--ag-black) !important;
  position: relative;
  overflow: hidden;
}
.hero-banner::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background:
    radial-gradient(ellipse at 30% 50%, rgba(232,93,44,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 50%, rgba(232,93,44,0.08) 0%, transparent 50%);
  pointer-events: none;
}
.banner__content, .hero__text, .slideshow__text {
  color: var(--ag-paper) !important;
}
.banner__heading, .hero__heading {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  color: var(--ag-paper) !important;
}
.banner__text, .hero__text p {
  color: var(--ag-orange-light) !important;
  font-size: 1.1rem;
}

/* ── CTA Buttons ── */
.banner__buttons .button--primary,
.hero__button, .section .button--primary {
  background: var(--ag-cta) !important;
  color: var(--ag-cta-text) !important;
  border: 2px solid var(--ag-cta) !important;
  border-radius: 4px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 14px 36px !important;
  font-weight: 700 !important;
  transition: all 0.2s ease;
}
.banner__buttons .button--primary:hover,
.hero__button:hover, .section .button--primary:hover {
  background: var(--ag-cta-hover) !important;
  border-color: var(--ag-cta-hover) !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(57,255,20,0.3);
}

.button--secondary, .banner__buttons .button--secondary {
  background: transparent !important;
  color: var(--ag-paper) !important;
  border: 2px solid var(--ag-paper) !important;
  border-radius: 4px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.button--secondary:hover {
  background: var(--ag-paper) !important;
  color: var(--ag-black) !important;
}

/* ── Marquee / Announcement Bar ── */
.announcement-bar, .marquee, .scrolling-text {
  background-color: var(--ag-orange) !important;
  color: var(--ag-paper) !important;
  padding: 10px 0 !important;
}
.announcement-bar__message, .marquee-text {
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.85rem;
  font-weight: 500;
}

/* ── Section Headers ── */
.section-header h2, .section-title {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  text-transform: uppercase;
  color: var(--ag-black) !important;
  letter-spacing: 0.03em;
  position: relative;
  display: inline-block;
}
.section-header h2::after, .section-title::after {
  content: '';
  display: block;
  width: 60px;
  height: 3px;
  background: var(--ag-orange);
  margin: 12px auto 0;
}

/* ── Product Cards (Bento Grid Feel) ── */
.product-card, .card, .card-wrapper {
  background: var(--ag-cream) !important;
  border: 2px solid var(--ag-border-subtle) !important;
  border-radius: 12px !important;
  overflow: hidden;
  transition: all 0.3s ease;
}
.product-card:hover, .card:hover {
  border-color: var(--ag-orange) !important;
  box-shadow: 0 8px 30px rgba(232,93,44,0.1);
  transform: translateY(-4px);
}

/* ── Product Images — 2pt Orange Border ── */
.product-card__image-wrapper img,
.card__media img,
.product__media img {
  border: 2px solid var(--ag-orange) !important;
  border-radius: 8px !important;
  padding: 2px;
  background: var(--ag-paper);
}

/* ── Product Info ── */
.product-card__title, .card__heading, .product__title {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  color: var(--ag-black) !important;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 1.1rem !important;
}
.product-card__vendor {
  color: var(--ag-gray-700) !important;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  font-family: 'Space Grotesk', sans-serif !important;
}
.product-card__price, .price {
  font-family: 'JetBrains Mono', monospace !important;
  color: var(--ag-orange) !important;
  font-weight: 700 !important;
}
.price--compare {
  color: var(--ag-gray-400) !important;
}
.product-card__badge, .badge {
  background: var(--ag-badge-bg) !important;
  color: var(--ag-badge-text) !important;
  border-radius: 4px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}

/* ── Add to Cart Button ── */
.product-form__submit, .shopify-payment-button__button--unbranded {
  background: var(--ag-orange) !important;
  color: var(--ag-paper) !important;
  border: 2px solid var(--ag-orange) !important;
  border-radius: 4px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700 !important;
  padding: 14px 30px !important;
}
.product-form__submit:hover {
  background: transparent !important;
  color: var(--ag-orange) !important;
}

/* ── Features / Text Blocks Section ── */
.feature-row, .multicolumn-card, .text-block {
  background: var(--ag-cream) !important;
  border: 1px solid var(--ag-orange-pale) !important;
  border-radius: 12px !important;
  padding: 28px !important;
  transition: border-color 0.3s ease;
}
.feature-row:hover, .multicolumn-card:hover {
  border-color: var(--ag-orange) !important;
}
.feature-row__title, .multicolumn-card__title {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 700 !important;
  color: var(--ag-black) !important;
  text-transform: uppercase;
  font-size: 1rem !important;
}
.feature-row__text, .multicolumn-card__text {
  color: var(--ag-gray-700) !important;
  line-height: 1.7;
}

/* ── FAQ Section ── */
.faq-section {
  background: var(--ag-cream) !important;
  border-top: 2px solid var(--ag-orange-pale);
}
.faq-item, .accordion {
  border-bottom: 1px solid var(--ag-orange-pale) !important;
}
.faq-item__question, .accordion__title {
  font-family: 'Space Grotesk', sans-serif !important;
  font-weight: 600 !important;
  color: var(--ag-black) !important;
}
.faq-item__answer, .accordion__content {
  color: var(--ag-gray-700) !important;
  line-height: 1.7;
}

/* ── Newsletter Section ── */
.newsletter-section, .email-signup {
  background: var(--ag-black) !important;
  border-top: 3px solid var(--ag-orange);
}
.newsletter-section h2, .email-signup h2 {
  color: var(--ag-paper) !important;
  font-family: 'Orbitron', sans-serif !important;
  text-transform: uppercase;
}
.newsletter-section p, .email-signup p {
  color: var(--ag-orange-light) !important;
}
.newsletter-form__field-wrapper input {
  background: var(--ag-paper-dark) !important;
  border: 2px solid var(--ag-orange) !important;
  border-radius: 4px !important;
  color: var(--ag-black) !important;
  font-family: 'Inter', sans-serif !important;
}
.newsletter-form__button {
  background: var(--ag-cta) !important;
  color: var(--ag-cta-text) !important;
  border: none !important;
  border-radius: 4px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  font-weight: 700 !important;
}

/* ── Footer ── */
.footer {
  background: var(--ag-black) !important;
  color: var(--ag-gray-400) !important;
  border-top: 2px solid var(--ag-orange) !important;
}
.footer h3, .footer h4, .footer__heading {
  color: var(--ag-paper) !important;
  font-family: 'Orbitron', sans-serif !important;
  text-transform: uppercase;
  font-size: 0.85rem !important;
  letter-spacing: 0.05em;
}
.footer a {
  color: var(--ag-gray-400) !important;
  font-family: 'Inter', sans-serif !important;
}
.footer a:hover {
  color: var(--ag-orange) !important;
}
.footer__copyright {
  color: var(--ag-gray-700) !important;
  font-size: 0.75rem;
  border-top: 1px solid var(--ag-gray-900) !important;
  padding-top: 20px;
}

/* ── Page Headers ── */
.page-header, .collection-hero__inner {
  border-bottom: 2px solid var(--ag-orange-pale);
  margin-bottom: 2rem;
}
.page-header h1, .collection-hero__title {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 900 !important;
  text-transform: uppercase;
  color: var(--ag-black) !important;
  letter-spacing: 0.03em;
}

/* ── Breadcrumbs ── */
.breadcrumb {
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: var(--ag-gray-700) !important;
}
.breadcrumb a {
  color: var(--ag-gray-400) !important;
}
.breadcrumb a:hover {
  color: var(--ag-orange) !important;
}

/* ── Pagination ── */
.pagination {
  font-family: 'JetBrains Mono', monospace !important;
}
.pagination a {
  color: var(--ag-gray-700) !important;
  border: 1px solid var(--ag-gray-200) !important;
}
.pagination a:hover {
  border-color: var(--ag-orange) !important;
  color: var(--ag-orange) !important;
}
.pagination .current {
  background: var(--ag-orange) !important;
  color: var(--ag-paper) !important;
  border-color: var(--ag-orange) !important;
}

/* ── Quantity Selector ── */
.quantity {
  border: 2px solid var(--ag-gray-200) !important;
  border-radius: 4px !important;
}
.quantity__button {
  color: var(--ag-gray-700) !important;
}
.quantity__button:hover {
  color: var(--ag-orange) !important;
}
.quantity__input {
  font-family: 'JetBrains Mono', monospace !important;
  color: var(--ag-black) !important;
}

/* ── Cart Page ── */
.cart-wrapper {
  background: var(--ag-cream) !important;
}
.cart-item__name {
  font-family: 'Orbitron', sans-serif !important;
  font-weight: 600 !important;
  color: var(--ag-black) !important;
  text-transform: uppercase;
  font-size: 0.9rem !important;
}
.cart-item__price {
  font-family: 'JetBrains Mono', monospace !important;
  color: var(--ag-orange) !important;
  font-weight: 700 !important;
}
.cart__checkout-button {
  background: var(--ag-cta) !important;
  color: var(--ag-cta-text) !important;
  border: none !important;
  border-radius: 4px !important;
  font-family: 'Space Grotesk', sans-serif !important;
  text-transform: uppercase;
  font-weight: 700 !important;
  letter-spacing: 0.08em;
  padding: 16px 36px !important;
}
.cart__checkout-button:hover {
  background: var(--ag-cta-hover) !important;
  box-shadow: 0 4px 20px rgba(57,255,20,0.3);
}

/* ── Search ── */
.search__input {
  border: 2px solid var(--ag-gray-200) !important;
  border-radius: 4px !important;
  font-family: 'Inter', sans-serif !important;
  background: var(--ag-cream) !important;
}
.search__input:focus {
  border-color: var(--ag-orange) !important;
  box-shadow: 0 0 0 3px rgba(232,93,44,0.1);
}

/* ── Loading Spinner ── */
.loading__spinner {
  border-color: var(--ag-orange) !important;
}

/* ── Responsive ── */
@media screen and (max-width: 749px) {
  .header, .header-wrapper {
    padding: 8px 16px !important;
  }
  .product-card__title, .card__heading {
    font-size: 0.9rem !important;
  }
  .banner__buttons .button--primary, .hero__button {
    padding: 12px 24px !important;
    font-size: 0.85rem !important;
  }
}`;

const THEME_ID = 140905709667;
const ASSET_KEY = 'assets/custom-design.css.liquid';

(async () => {
  console.log('上传暖橙主题 CSS v2.0...');
  try {
    const result = await api.updateThemeAsset(THEME_ID, ASSET_KEY, CSS);
    console.log('✅ CSS 上传成功!');
    console.log('Asset key:', result.asset?.key);
    console.log('Size:', result.asset?.size, 'bytes');
  } catch (e) {
    console.error('❌ 上传失败:', e.errors || e.message || e);
  }
})();
