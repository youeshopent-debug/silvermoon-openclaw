const api = require('./lib/shopify-api');
const fs = require('fs');
const path = require('path');

const IMG_DIR = path.join(__dirname, '.silvermoon_core', 'assets', 'aigenie_shopify');

const PRODUCT_MAP = [
  { pid: '8005574623331', file: 'aigenie_01_aigenie_vision.png', name: 'AIGenie Vision' },
  { pid: '8006707282019', file: 'aigenie_02_aigenie_translator_buds_pro.png', name: 'AIGenie Translator Buds Pro' },
  { pid: '8006680871011', file: 'aigenie_03_aigenie_scanpen.png', name: 'AIGenie ScanPen' },
  { pid: '8006707314787', file: 'aigenie_04_aigenie_notepad.png', name: 'AIGenie Notepad' },
  { pid: '8006680641635', file: 'aigenie_05_aigenie_recorderpen.png', name: 'AIGenie RecorderPen' },
];

(async () => {
  console.log('开始上传 5 张产品图...');
  for (const item of PRODUCT_MAP) {
    const filePath = path.join(IMG_DIR, item.file);
    if (!fs.existsSync(filePath)) {
      console.log(`[SKIP] ${item.name} — 文件不存在: ${item.file}`);
      continue;
    }
    const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
    try {
      const result = await api.updateProduct(item.pid, {
        images: [{ attachment: base64, filename: item.file }]
      });
      const imgCount = result.product?.images?.length || 0;
      console.log(`[OK] ${item.name} (${item.pid}) → ${imgCount} img(s)`);
    } catch (e) {
      console.log(`[FAIL] ${item.name} (${item.pid}): ${e.errors || e.message || e}`);
    }
  }
  console.log('全部完成！');
})();
