const api = require('./lib/shopify-api');

const PRODUCTS = [
  { id: '8005574623331', name: 'SilverMoon Vision' },
  { id: '8006707282019', name: 'SilverMoon Buds Pro' },
  { id: '8006680871011', name: 'SilverMoon ScanPen Pro' },
  { id: '8006680641635', name: 'SilverMoon RecorderPen' },
  { id: '8006680772707', name: 'SilverMoon Notepad' },
  { id: '8006707314787', name: 'SilverMoon WritePad' },
];

(async () => {
  for (const p of PRODUCTS) {
    const res = await api.getProduct(p.id);
    const product = res.product;
    const imgCount = product.images?.length || 0;
    console.log(`[${p.name}]`);
    console.log(`  Handle: ${product.handle}`);
    console.log(`  Images: ${imgCount}`);
    if (imgCount > 0) {
      product.images.forEach((img, i) => {
        console.log(`    [${i+1}] ${img.src}`);
      });
    }
    console.log('');
  }
})();
