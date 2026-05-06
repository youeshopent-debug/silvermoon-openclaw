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
  // 1. Read settings_data.json
  const sd = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=config/settings_data.json');
  const settings = JSON.parse(sd.asset.value);
  
  // 2. Update global colors to Void Black
  console.log('Updating global colors...');
  // Horizon theme uses these for global background
  settings.current.colors_background_1 = '#010102';
  settings.current.colors_accent_1 = '#36F4A4';
  
  // Ensure scheme-6 is fully applied to header if possible, or just force it in CSS
  // We already set scheme-6 in the previous step, let's make sure it's perfect
  settings.current.color_schemes['scheme-6'].settings.background = 'rgba(1,1,2,1)';
  settings.current.color_schemes['scheme-6'].settings.foreground = '#f7f8f8';
  
  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'config/settings_data.json', value: JSON.stringify(settings) }
  });

  // 3. Update CSS to force the "Dark Tech" look
  console.log('Updating CSS to force Dark Tech look...');
  const customCss = `/* SilverMoon Bank - Perfect Dark Tech Design */

/* 1. Global Reset to Void Black */
body, #MainContent, .gradient {
  background-color: #010102 !important;
  color: #f7f8f8 !important;
}

/* 2. Header Fix - Force Dark */
.header-wrapper, .header {
  background-color: #010102 !important;
  border-bottom: 1px solid #23252a !important;
}
.header__menu-item, .header__icon, .header__heading-link {
  color: #ffffff !important;
}

/* 3. Hero Section - Force Background Image & Hide Placeholder */
.hero-wrapper .hero {
  background-image: url('https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80') !important;
  background-size: cover !important;
  background-position: center !important;
  background-attachment: fixed !important;
}

/* Hide the cartoon illustration/placeholder */
.hero-wrapper .hero__media-grid, 
.hero-wrapper .placeholder-svg,
.hero-wrapper .hero__media {
  display: none !important;
}

/* Gradient Overlay for Readability */
.hero-wrapper .hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(1,1,2,0.7) 0%, rgba(1,1,2,0.3) 50%, rgba(1,1,2,0.8) 100%) !important;
  z-index: 1;
}

.hero-wrapper .hero__content-wrapper {
  position: relative;
  z-index: 2;
  text-shadow: 0 2px 10px rgba(0,0,0,0.5);
}

/* 4. Neon Mint Button - Enhanced */
.hero-wrapper a.button, 
.hero-wrapper .button,
.button--primary {
  background-color: #36F4A4 !important;
  color: #000000 !important;
  border-radius: 50px !important;
  padding: 16px 40px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  box-shadow: 0 0 15px rgba(54, 244, 164, 0.4) !important;
  border: none !important;
}

.hero-wrapper a.button:hover {
  background-color: #ffffff !important;
  box-shadow: 0 0 25px rgba(54, 244, 164, 0.6) !important;
  transform: translateY(-2px);
}

/* 5. Marquee & Footer */
.marquee-bar {
  background-color: #000000 !important;
  border-top: 1px solid #36F4A4 !important;
  border-bottom: 1px solid #36F4A4 !important;
}
.marquee-bar p {
  color: #36F4A4 !important;
  font-weight: 600;
  text-transform: uppercase;
}

footer {
  background-color: #000000 !important;
  border-top: 1px solid #23252a !important;
}
`;

  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: customCss }
  });

  console.log('🎯 Perfect Design Applied!');
}

main().catch(console.error);
