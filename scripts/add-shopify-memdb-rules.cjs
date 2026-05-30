'use strict';
const memdb = require('../lib/memdb');

const r1 = memdb.addRule(
  'Shopify 上架流程：1) 问主人要商品信息（标题/描述/价格/图片URL/分类/Tags）2) 调用 shopify-api.js 的 createProduct() 或 shopify-operations.js 的 importProduct() 创建商品 3) 选择发布（status=active）或草稿（status=draft）4) 用 batchUpdateSeo() 设置 SEO 标题和描述 5) 用 getStoreInfo() 或 listProducts() 验证上架结果 6) 汇报结果给主人。每一步必须先汇报进度再走下一步。',
  '李长寿',
  ['shopify', 'workflow', 'shangjia']
);

const r2 = memdb.addRule(
  'Shopify 创建商品 payload 结构：{ title, body_html(支持HTML描述), vendor, product_type, status(draft/active), variants:[{ price, compare_at_price, sku, inventory_quantity }], images:[{ src: "图片URL" }], tags(逗号分隔) }。收到主人商品信息后按此格式构造。',
  '李长寿',
  ['shopify', 'api', 'payload']
);

const r3 = memdb.addRule(
  'Shopify 操作可用模块路径：1) lib/shopify-api.js - 底层 API（createProduct/updateProduct/listProducts/getShop）2) sects/药老/shopify-operations.js - 业务封装（importProduct/batchImport/publishProduct/getProductSeo/batchUpdateSeo）。推荐用 shopify-operations.js 封装层。',
  '李长寿',
  ['shopify', 'module', 'reference']
);

const r4 = memdb.addRule(
  'Shopify SEO 设置流程：上架后用 batchUpdateSeo() 设置 seoTitle(70字内)+seoDescription(160字内)+tags(10-20个)。SEO 标题格式: 主关键词 | 副关键词 - 品牌名。描述含2-3个长尾关键词+1个CTA。',
  '李长寿',
  ['shopify', 'seo']
);

console.log('r1:', r1.ok ? 'OK' : 'FAIL');
console.log('r2:', r2.ok ? 'OK' : 'FAIL');
console.log('r3:', r3.ok ? 'OK' : 'FAIL');
console.log('r4:', r4.ok ? 'OK' : 'FAIL');

const list = memdb.listRules(30);
console.log('总规则数:', list.length);
