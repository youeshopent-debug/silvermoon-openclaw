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
  console.log('🌙 注入 Hero background-image...\n');

  const r = await shopify('themes/' + themeId + '/assets.json?asset[key]=assets/custom-design.css.liquid');
  let css = r.asset.value || '';

  const heroBlock = '.color-scheme-6 .hero {';
  const heroBg = `.color-scheme-6 .hero {
  background-image: url("https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80") !important;
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;`;

  css = css.replace(heroBlock, heroBg);

  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: css }
  });

  console.log('✅ background-image 已注入');
  console.log('CSS size: ' + css.length + ' bytes');
  console.log('Has background-image: ' + css.includes('background-image'));
  console.log('Has min-height: ' + css.includes('min-height'));
  console.log('Has .hero: ' + css.includes('.color-scheme-6 .hero'));
  console.log('\n请用外部浏览器打开 https://aigenie-hub.myshopify.com/ 查看效果');
}

main().catch(console.error);
