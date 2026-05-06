import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';

function rest(m, p) {
  return new Promise((ok) => {
    const r = https.request({ hostname: S, path: '/admin/api/2024-01' + p, method: m, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.end();
  });
}

(async () => {
  const v = await rest('GET', '/themes/140905709667/assets.json?asset[key]=templates/index.json');
  const h = v.asset?.value || '';
  console.log('=== FULL TEMPLATE ===');
  console.log(h);
})();
