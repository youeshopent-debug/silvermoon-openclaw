import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const A = '/admin/api/2024-01';
function req(m,p){return new Promise((ok,no)=>{const r=https.request({hostname:S,path:A+p,method:m,headers:{'X-Shopify-Access-Token':T,'Content-Type':'application/json'}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>ok(JSON.parse(d)))});r.on('error',no);r.end()})}
async function main() {
  // 1. Current homepage template
  console.log('=== 当前首页模板 ===');
  try {
    const a = await req('GET','/themes/140905709667/assets.json?asset%5Bkey%5D=templates%2Findex.json');
    console.log(JSON.stringify(JSON.parse(a.asset.value),null,2));
  } catch(e) { console.log('No index.json:', e.message); }
  
  // 2. Available sections in theme
  console.log('\n=== 主题版本 ===');
  const t = await req('GET','/themes/140905709667.json');
  console.log(`Theme: ${t.theme.name}, role: ${t.theme.role}`);

  // 3. List available assets (first 20)
  console.log('\n=== 模板文件列表 ===');
  const assets = await req('GET','/themes/140905709667/assets.json?limit=30');
  for (const a of assets.assets || []) {
    if (a.key.startsWith('templates/') || a.key.startsWith('sections/'))
      console.log(`  ${a.key} (${a.content_type})`);
  }
}
main().catch(console.error);
