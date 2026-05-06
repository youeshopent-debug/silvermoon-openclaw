import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';

function gql(q) {
  return new Promise((ok) => {
    const r = https.request({ hostname: S, path: '/admin/api/2025-07/graphql.json', method: 'POST', headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.write(JSON.stringify({ query: q })); r.end();
  });
}

function rest(m, p) {
  return new Promise((ok) => {
    const r = https.request({ hostname: S, path: '/admin/api/2024-01' + p, method: m, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.end();
  });
}

(async () => {
  console.log('=== FINAL VERIFICATION ===\n');

  // 1. Product
  const p = await rest('GET', '/products/8005574623331.json');
  console.log('[PRODUCT]', p.product?.title);
  console.log('  Images:', p.product?.images?.length, '(non-SVG:', p.product?.images?.filter(i => !i.src.endsWith('.svg')).length, ')');
  console.log('  Variants:', p.product?.variants?.length);
  p.product?.variants?.forEach(v => console.log('    -', v.title, '$' + v.price, '(was $' + v.compare_at_price + ')'));

  // 2. Homepage template
  const tmpl = await rest('GET', '/themes/140905709667/assets.json?asset[key]=templates/index.json');
  const h = JSON.parse(tmpl.asset?.value || '{}');
  console.log('\n[HOMEPAGE]');
  console.log('  Sections:', h.order?.join(' -> '));
  const slide = h.sections?.hero_main?.blocks?.slide_1?.settings;
  console.log('  Hero image:', slide?.image?.slice(0, 50) + '...' || 'EMPTY');
  console.log('  Hero heading:', slide?.heading);

  // 3. Navigation
  const q = await gql('{ menus(first:5) { edges { node { title handle items { title url } } } } }');
  console.log('\n[NAVIGATION]');
  for (const e of (q.data?.menus?.edges || [])) {
    console.log('  ' + e.node.title + ' (' + e.node.handle + '):');
    (e.node.items || []).forEach(i => console.log('    -> ' + i.title));
  }

  // 4. Pages
  const pages = await rest('GET', '/pages.json?published_status=any&limit=20');
  console.log('\n[PAGES] Count:', (pages.pages || []).length);
  for (const pg of (pages.pages || [])) {
    console.log('  ' + (pg.published ? 'PUB' : 'DRF') + ' | ' + pg.title);
  }

  console.log('\n=== STORE URLS ===');
  console.log('  Home: https://' + S + '/');
  console.log('  Product: https://' + S + '/products/ai-smart-translation-glasses');
})();
