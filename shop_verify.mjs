import https from 'https';
const TOKEN = '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';
const SHOP = 'aigenie-hub.myshopify.com';
const API = '/admin/api/2024-01';
function req(method, path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: SHOP, path: API + path, method,
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }
    };
    const r = https.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
    r.on('error', reject); r.end();
  });
}
async function main() {
  console.log('=== 页面状态 ===');
  const pages = await req('GET', '/pages.json?limit=50');
  for (const p of pages.pages) console.log(`  ${p.published ? '✅' : '❌'} ${p.title} (published_at: ${p.published_at || '无'})`);
  console.log(`  总计: ${pages.pages.length} 页, 已发布: ${pages.pages.filter(p=>p.published).length}`);

  console.log('\n=== 产品状态 ===');
  const prods = await req('GET', '/products.json?limit=50');
  for (const p of prods.products) {
    const imgs = p.images?.length || 0;
    console.log(`  ${p.title} | $${p.variants?.[0]?.price} | 图片: ${imgs}张 | status: ${p.status}`);
    if (imgs > 0) p.images.forEach((img,i)=>console.log(`    [${i}] ${img.src?.slice(0,80)}`));
  }

  console.log('\n=== 首页模板 ===');
  try {
    const home = await req('GET', '/themes/140905709667/assets.json?asset%5Bkey%5D=templates%2Findex.json');
    const sections = home.asset ? Object.keys(JSON.parse(home.asset.value).sections||{}) : [];
    console.log(`  区块: ${sections.join(', ') || '无'}`);
  } catch(e) { console.log('  ❌ 首页模板不存在或读取失败'); }

  console.log('\n=== 导航菜单 ===');
  const menus = await req('GET', '/menus.json');
  for (const m of menus.menus || []) console.log(`  ${m.title} (${m.handle}): ${m.items?.length||0} 项`);

  console.log('\n=== 店铺公开访问 ===');
  const shop = await req('GET', '/shop.json');
  console.log(`  店铺名: ${shop.shop.name}`);
  console.log(`  password_enabled: ${shop.shop.password_enabled}`);
  console.log(`  时区: ${shop.shop.iana_timezone}`);
  console.log(`  域名: ${shop.shop.domain}`);
  console.log(`  公开访问: ${shop.shop.password_enabled ? '❌ 需要密码' : '✅ 已公开'}`);
}
main().catch(console.error);
