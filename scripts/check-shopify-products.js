const https = require('https');
const TOKEN = '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';
const STORE = 'aigenie-hub.myshopify.com';

function api(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://${STORE}/admin/api/2024-04${path}`, {
      headers: { 'X-Shopify-Access-Token': TOKEN }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { reject(d.slice(0, 300)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // 产品
  const pData = await api('/products.json?limit=10');
  console.log('=== 产品列表 ===');
  for (const p of pData.products || []) {
    console.log(`\n📦 ${p.title}`);
    console.log(`   ID: ${p.id} | Status: ${p.status}`);
    console.log(`   Options:`);
    for (const o of p.options || []) {
      console.log(`     ${o.name}: [${(o.values || []).join(', ')}]`);
    }
    console.log(`   Variants (${p.variants.length}):`);
    for (const v of p.variants) {
      console.log(`     ${v.title} | $${v.price} | 库存:${v.inventory_quantity}`);
    }
  }

  // 集合
  const cData = await api('/custom_collections.json?limit=20');
  console.log('\n=== 自定义集合 ===');
  for (const c of cData.custom_collections || []) {
    console.log(`   📁 ${c.title} (${c.id})`);
  }

  // 智能集合
  const sData = await api('/smart_collections.json?limit=20');
  console.log('\n=== 智能集合 ===');
  for (const c of sData.smart_collections || []) {
    console.log(`   📁 ${c.title} (${c.id})`);
  }
}
main().catch(e => console.error('❌', e));
