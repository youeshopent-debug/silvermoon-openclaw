const api = require('./lib/shopify-api');

const RENAMES = [
  { id: 8006680772707, title: null, vendor: 'SilverMoon Bank' },
  { id: 8006707314787, title: 'SilverMoon Notepad — LCD Writing Tablet', vendor: 'SilverMoon Bank' },
  { id: 8006680641635, title: 'SilverMoon RecorderPen — AI Voice Recorder (20+ Languages)', vendor: 'SilverMoon Bank' },
  { id: 8006680871011, title: 'SilverMoon ScanPen — AI Scan & Translate Pen (112 Languages)', vendor: 'SilverMoon Bank' },
  { id: 8006707282019, title: 'SilverMoon Translator Buds Pro — 3-in-1 AI Earbuds (144 Languages)', vendor: 'SilverMoon Bank' },
  { id: 8005574623331, title: 'SilverMoon Vision — AI Smart Translation Glasses (100+ Languages)', vendor: 'SilverMoon Bank' },
];

(async () => {
  let ok = 0, fail = 0;
  for (const p of RENAMES) {
    const payload = { product: {} };
    if (p.title) payload.product.title = p.title;
    if (p.vendor) payload.product.vendor = p.vendor;
    try {
      await api.updateProduct(p.id, payload);
      console.log(`  ✅ ${p.id}: ${p.title || '(keep name)'} | vendor → ${p.vendor}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${p.id}: ${e.errors || e.message || e}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} fail`);
})();
