import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const A = '/admin/api/2024-01';
function req(m, p, b = null) {
  return new Promise((ok, no) => {
    const opts = { hostname: S, path: A + p, method: m, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } };
    const r = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const info = { status: res.statusCode, headers: res.headers };
        try { ok({ ...JSON.parse(d), _status: info.status, _headers: info.headers }); }
        catch(e) { ok({ _raw: d.slice(0,800), _status: info.status, _headers: info.headers }); }
      });
    });
    r.on('error', no); if (b) r.write(JSON.stringify(b)); r.end();
  });
}
async function main() {
  // 1. 查 token scope — 通过 /shop 的 X-Shopify-API-Default-Scope header
  console.log('=== 查 Token Scope ===');
  const shop = await req('GET', '/shop.json');
  console.log('Status:', shop._status);
  console.log('Headers:', JSON.stringify(shop._headers, null, 2));
  console.log('Shop:', shop.shop?.name);

  // 2. 再试 menus API — 可能是 endpoint 不对
  console.log('\n=== 尝试不同菜单 API ===');
  // Try v2024-04
  const m1 = await req('GET', '/menus.json');
  console.log('menus.json:', m1._status, m1.errors ? JSON.stringify(m1.errors).slice(0,200) : 'OK items=' + (m1.menus?.length||0));

  // Try graphql for navigation
  const gql = JSON.stringify({query: `{ menus(first:10) { edges { node { id title handle items { title url } } } } }`});
  const r2 = await req('POST', '/graphql.json', JSON.parse(gql));
  console.log('\n=== GraphQL menus ===');
  console.log('Status:', r2._status);
  console.log('Data:', JSON.stringify(r2.data).slice(0, 500));
  if (r2.errors) console.log('Errors:', JSON.stringify(r2.errors).slice(0, 300));

  // 3. 试 navigation API  
  console.log('\n=== 导航 API ===');
  const nav = await req('GET', '/navigation/menus.json');
  console.log('/navigation/menus.json:', nav._status, nav.errors ? JSON.stringify(nav.errors).slice(0,200) : 'OK');
}
main().catch(console.error);
