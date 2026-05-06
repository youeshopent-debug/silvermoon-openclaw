import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const A = '/admin/api/2024-01';
function req(m, p) {
  return new Promise((ok, no) => {
    const r = https.request({ hostname: S, path: A + p, method: m, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { ok(JSON.parse(d)); } catch(e) { ok({ _raw: d.slice(0,500), _status: res.statusCode }); }
      });
    });
    r.on('error', no); r.end();
  });
}
async function main() {
  // Check slideshow section for available blocks
  console.log('=== Slideshow Section ===');
  const ss = await req('GET', '/themes/140905709667/assets.json?asset%5Bkey%5D=sections%2Fslideshow.liquid');
  if (ss.asset) {
    // Extract schema block types
    const content = ss.asset.value;
    const types = content.match(/type:\s*"([^"]+)"/g) || [];
    console.log('Block types found:', [...new Set(types)].join('\n  '));
    // Extract schema section
    const schemaMatch = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
    if (schemaMatch) console.log('Schema snippet:', schemaMatch[1].slice(0, 1000));
  } else {
    console.log('Cannot read slideshow.liquid');
  }

  // Check navigation API
  console.log('\n=== Navigation API ===');
  const nav = await req('GET', '/smart_collections.json?limit=5');
  console.log('smart_collections:', JSON.stringify(nav).slice(0, 300));

  // Check what `/menus.json` returns
  console.log('\n=== Menus API ===');
  const menus = await req('GET', '/menus.json');
  console.log('menus response:', JSON.stringify(menus).slice(0, 500));
  
  // Check /navigation API  
  console.log('\n=== Navigation ===');
  const nav2 = await req('GET', '/navigation.json?limit=5');  
  console.log('navigation:', JSON.stringify(nav2).slice(0, 300));
}
main().catch(console.error);
