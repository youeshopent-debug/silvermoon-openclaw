const ShopifyAPI = require('../../lib/shopify-api');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'workspace', 'CASHCLAW', 'shopify_ops');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(action, payload, result) {
  const entry = { ts: new Date().toISOString(), action, payload, result };
  fs.appendFileSync(path.join(LOG_DIR, `ops_${new Date().toISOString().slice(0, 10)}.jsonl`), JSON.stringify(entry) + '\n');
  return result;
}

// ── 上下架 ──

async function listProductsByStatus(status = 'active') {
  const res = await ShopifyAPI.listProducts(250, status);
  return log('listProductsByStatus', { status }, res.products || []);
}

async function listAllProducts() {
  const [active, draft, archived] = await Promise.all([
    ShopifyAPI.listProducts(250, 'active'),
    ShopifyAPI.listProducts(250, 'draft'),
    ShopifyAPI.listProducts(250, 'archived'),
  ]);
  const all = [
    ...(active.products || []),
    ...(draft.products || []),
    ...(archived.products || []),
  ];
  return log('listAllProducts', {}, all);
}

async function setProductStatus(productId, status) {
  const res = await ShopifyAPI.updateProduct(productId, { status });
  return log('setProductStatus', { productId, status }, res.product);
}

async function publishProduct(productId) {
  return setProductStatus(productId, 'active');
}

async function unpublishProduct(productId) {
  return setProductStatus(productId, 'draft');
}

// ── SEO ──

async function getProductSeo(productId) {
  const res = await ShopifyAPI.getProduct(productId);
  const p = res.product;
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    seoTitle: p.metafields_global_title_tag || p.title,
    seoDescription: p.metafields_global_description_tag || '',
    tags: p.tags,
    productType: p.product_type,
    publishedAt: p.published_at,
    status: p.status,
  };
}

async function batchUpdateSeo(updates) {
  const results = [];
  for (const u of updates) {
    try {
      const body = {};
      if (u.title !== undefined) body.title = u.title;
      if (u.seoTitle !== undefined) body.metafields_global_title_tag = u.seoTitle;
      if (u.seoDescription !== undefined) body.metafields_global_description_tag = u.seoDescription;
      if (u.tags !== undefined) body.tags = u.tags;
      if (u.productType !== undefined) body.product_type = u.productType;
      const res = await ShopifyAPI.updateProduct(u.productId, body);
      results.push({ productId: u.productId, ok: true, product: res.product });
    } catch (err) {
      results.push({ productId: u.productId, ok: false, error: err.errors || err.message || err });
    }
  }
  return log('batchUpdateSeo', updates, results);
}

// ── 导入 ──

async function importProduct(productData) {
  const res = await ShopifyAPI.createProduct(productData);
  return log('importProduct', productData, res.product);
}

async function batchImport(products) {
  const results = [];
  for (const p of products) {
    try {
      const res = await ShopifyAPI.createProduct(p);
      results.push({ title: p.title, ok: true, product: res.product });
    } catch (err) {
      results.push({ title: p.title, ok: false, error: err.errors || err.message || err });
    }
  }
  return log('batchImport', products, results);
}

// ── 查询 ──

async function getStoreInfo() {
  const res = await ShopifyAPI.getShop();
  return log('getStoreInfo', {}, res.shop);
}

async function getRecentOrders(limit = 20) {
  const res = await ShopifyAPI.listOrders(limit);
  return log('getRecentOrders', { limit }, res.orders || []);
}

module.exports = {
  listProductsByStatus,
  listAllProducts,
  setProductStatus,
  publishProduct,
  unpublishProduct,
  getProductSeo,
  batchUpdateSeo,
  importProduct,
  batchImport,
  getStoreInfo,
  getRecentOrders,
};
