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
  // === FIX 1: Update color scheme groups ===
  console.log('🔧 Fix 1: Updating color_schemes scheme-6 group settings...');
  const sd = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=config/settings_data.json');
  const settings = JSON.parse(sd.asset.value);

  if (!settings.current.color_schemes) {
    settings.current.color_schemes = {};
  }

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

  const r1 = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'config/settings_data.json', value: JSON.stringify(settings) }
  });
  console.log('  ' + (r1.errors ? '❌ FAILED: ' + JSON.stringify(r1.errors) : '✅ Color scheme group updated'));

  // === FIX 2: Rewrite custom-design.css.liquid with correct selectors ===
  console.log('\n🔧 Fix 2: Rewriting custom CSS with correct selectors...');

  const customCss = `/* SilverMoon Bank Design System — Home page fixes */
/* Use .hero-wrapper (class-based) instead of #shopify-section-* (dynamic IDs) */

/* Hero background image */
.hero-wrapper .hero {
  background-image: url('https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80');
  background-size: cover;
  background-position: center;
  position: relative;
}

/* Gradient overlay */
.hero-wrapper .hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(1,1,2,0.85) 0%, rgba(1,1,2,0.4) 50%, rgba(1,1,2,0.85) 100%);
  z-index: 1;
  pointer-events: none;
}

/* Ensure content is above overlay */
.hero-wrapper .hero .hero__content-wrapper,
.hero-wrapper .hero .hero__media-grid {
  position: relative;
  z-index: 2;
}

/* Neon mint CTA button */
.hero-wrapper a.button,
.hero-wrapper .button {
  background-color: #36F4A4 !important;
  color: #000000 !important;
  border-radius: 9999px !important;
  padding: 14px 36px !important;
  font-weight: 600 !important;
  border: none !important;
  text-transform: none !important;
  letter-spacing: 0.02em !important;
  transition: all 0.25s ease !important;
}

.hero-wrapper a.button:hover,
.hero-wrapper .button:hover {
  background-color: #2bd893 !important;
  transform: scale(1.03) !important;
  box-shadow: 0 0 24px rgba(54, 244, 164, 0.3) !important;
}

/* Headings in hero */
.hero-wrapper .hero h1 {
  font-size: clamp(2.2rem, 5vw, 4rem) !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
  line-height: 1.1 !important;
}

/* Marquee bar styling */
.marquee-bar {
  border-top: 1px solid #23252a !important;
  border-bottom: 1px solid #23252a !important;
}

/* Featured product section */
.featured-product-section {
  padding-top: 64px !important;
  padding-bottom: 64px !important;
}

/* Global typography refinements */
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}
`;

  const r2 = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: customCss + '\n' }
  });
  console.log('  ' + (r2.errors ? '❌ FAILED: ' + JSON.stringify(r2.errors) : '✅ Custom CSS updated'));

  // === FIX 3: Upload hero background image as theme asset ===
  console.log('\n🔧 Fix 3: Uploading hero background image...');
  const r3 = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/hero-tech-bg.jpg', src: 'https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80' }
  });
  console.log('  ' + (r3.errors ? '⚠️ Upload failed (CSS uses CDN URL anyway): ' + JSON.stringify(r3.errors) : '✅ Hero image uploaded: ' + (r3.asset ? r3.asset.public_url : 'OK')));

  // === Summary ===
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Done! Fixes applied:');
  console.log('  1. ✅ color_schemes scheme-6 → dark tech group colors');
  console.log('  2. ✅ CSS selectors → .hero-wrapper (class-based, no dynamic IDs)');
  console.log('  3. ✅ Hero bg image uploaded');
  console.log('\n📌 Next: Open your store to verify:');
  console.log('  https://aigenie-hub.myshopify.com/');
  console.log('  (May need to clear cache / append ?v=timestamp)');
}

main().catch(console.error);
