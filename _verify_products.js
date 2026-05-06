const API = require('./lib/shopify-api.js');

async function main() {
  console.log('===== 产品全面验收 =====\n');

  const { products } = await API.listProducts();
  const active = products.filter(p => p.status === 'active');
  const draft = products.filter(p => p.status === 'draft');

  console.log(`总产品数: ${products.length} (活跃: ${active.length}, 草稿: ${draft.length})\n`);

  console.log('--- 活跃产品 ---');
  for (const p of active) {
    console.log(`  🔹 [#${p.id}] ${p.title}`);
    console.log(`     Type: ${p.product_type}  |  Tags: ${p.tags}`);
    console.log(`     Handle: ${p.handle}`);
    console.log(`     Variant: $${p.variants?.[0]?.price || 'N/A'}`);
    console.log('');
  }

  if (draft.length) {
    console.log('--- 草稿产品 ---');
    for (const p of draft) {
      console.log(`  🔸 [#${p.id}] ${p.title} | Type: ${p.product_type} | Tags: ${p.tags}`);
    }
  }

  console.log('===== 验收完成 =====');
}

main().catch(console.error);
