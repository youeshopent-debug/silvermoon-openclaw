const API = require('./lib/shopify-api');

(async () => {
  const { products } = await API.listProducts(50, 'any');
  console.log('TOTAL:', products.length);
  console.log('='.repeat(80));
  for (const p of products) {
    console.log(`ID: ${p.id}`);
    console.log(`Title: ${p.title}`);
    console.log(`Status: ${p.status}`);
    console.log(`Vendor: ${p.vendor}`);
    console.log(`Type: ${p.product_type}`);
    console.log(`Tags: ${p.tags}`);
    console.log(`Images: ${p.images?.length || 0}`);
    if (p.images?.length > 0) {
      p.images.forEach((img, i) => console.log(`  [${i}] ${img.src?.slice(0, 120)}`));
    }
    console.log(`Variants: ${p.variants?.length || 0}`);
    if (p.variants?.length > 0) {
      p.variants.forEach(v => console.log(`  ${v.title} | SKU:${v.sku || '-'} | Price:$${v.price} | Inv:${v.inventory_quantity}`));
    }
    console.log(`Body HTML: ${(p.body_html || '').slice(0, 300)}`);
    console.log('-'.repeat(80));
  }
})();
