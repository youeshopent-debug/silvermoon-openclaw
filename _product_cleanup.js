const api = require('./lib/shopify-api');

const RENAMES = [
  { id: 8005574623331, title: 'AIGenie Vision — AI Smart Translation Glasses (100+ Languages)' },
  { id: 8006707282019, title: 'AIGenie Translator Buds Pro — 3-in-1 AI Earbuds (144 Languages)' },
  { id: 8006680871011, title: 'AIGenie ScanPen — AI Scan & Translate Pen (112 Languages)' },
  { id: 8006707314787, title: 'AIGenie Notepad — LCD Writing Tablet' },
  { id: 8006680641635, title: 'AIGenie RecorderPen — AI Voice Recorder (20+ Languages)' }
];

const DRAFT = [
  8006707216483, // Ultra-Light Glasses（眼镜重叠）
  8006707249251, // 800W Camera Glasses（眼镜重叠）
  8006680215651, // Translation Earbuds（耳机重叠）
  8006707347555, // Scan Reader Pen 3 PRO（笔重叠）
  8006707380323  // V39 Recorder MP3（录音重叠）
];

const DELETE_IDS = [
  8006697320547  // Example product
];

(async () => {
  let ok = 0, fail = 0;

  // 1. 重命名
  console.log('═══ Renaming core products ═══');
  for (const p of RENAMES) {
    try {
      await api.updateProduct(p.id, { status: 'active', title: p.title });
      console.log(`  ✅ ${p.title}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${p.title}: ${e.message}`);
      fail++;
    }
  }

  // 2. 下架重叠
  console.log('\n═══ Archiving duplicate products ═══');
  for (const id of DRAFT) {
    try {
      await api.updateProduct(id, { status: 'draft' });
      console.log(`  ✅ Archived product #${id}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ Product #${id}: ${e.message}`);
      fail++;
    }
  }

  // 3. 删除 Example product
  console.log('\n═══ Deleting Example product ═══');
  for (const id of DELETE_IDS) {
    try {
      await api.deleteProduct(id);
      console.log(`  ✅ Deleted product #${id}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ Product #${id}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
})();
