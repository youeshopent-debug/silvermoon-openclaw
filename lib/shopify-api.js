const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

let SHOPIFY_STORE = process.env.SHOPIFY_STORE || '';
let SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN || '';
const API_VERSION = '2025-10';

if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
  const fallbackPath = path.join(__dirname, '..', '.silvermoon_core', 'shopify_agent_keys.json');
  try {
    const creds = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    if (!SHOPIFY_STORE) SHOPIFY_STORE = creds.store || '';
    if (!SHOPIFY_TOKEN) SHOPIFY_TOKEN = creds.token || '';
  } catch (e) { /* 无凭据文件时静默跳过 */ }
}

function shopifyRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${path}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, errors: parsed.errors || parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject({ status: res.statusCode, raw: data.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const ShopifyAPI = {
  // ── 商品 ──
  async listProducts(limit = 50, status = 'active') {
    const query = status === 'any' ? `?limit=${limit}` : `?limit=${limit}&status=${status}`;
    return shopifyRequest('GET', `/products.json${query}`);
  },
  async getProduct(id) {
    return shopifyRequest('GET', `/products/${id}.json`);
  },
  async createProduct(data) {
    return shopifyRequest('POST', '/products.json', { product: data });
  },
  async updateProduct(id, data) {
    return shopifyRequest('PUT', `/products/${id}.json`, { product: data });
  },
  async deleteProduct(id) {
    return shopifyRequest('DELETE', `/products/${id}.json`);
  },

  // ── 订单 ──
  async listOrders(limit = 50, status = 'any') {
    return shopifyRequest('GET', `/orders.json?limit=${limit}&status=${status}`);
  },
  async getOrder(id) {
    return shopifyRequest('GET', `/orders/${id}.json`);
  },
  async updateOrder(id, data) {
    return shopifyRequest('PUT', `/orders/${id}.json`, { order: data });
  },
  async cancelOrder(id, reason = 'other') {
    return shopifyRequest('POST', `/orders/${id}/cancel.json`, { reason });
  },

  // ── 客户 ──
  async listCustomers(limit = 50) {
    return shopifyRequest('GET', `/customers.json?limit=${limit}`);
  },
  async getCustomer(id) {
    return shopifyRequest('GET', `/customers/${id}.json`);
  },
  async searchCustomers(query) {
    return shopifyRequest('GET', `/customers/search.json?query=${encodeURIComponent(query)}`);
  },

  // ── 库存 ──
  async listInventoryLevels(locationIds) {
    const ids = Array.isArray(locationIds) ? locationIds.join(',') : locationIds;
    return shopifyRequest('GET', `/inventory_levels.json?location_ids=${ids}`);
  },
  async setInventoryLevel(locationId, inventoryItemId, available) {
    return shopifyRequest('POST', '/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available,
    });
  },

  // ── 店铺信息 ──
  async getShop() {
    return shopifyRequest('GET', '/shop.json');
  },

  // ── 多市场 ──
  async listMarkets() {
    return shopifyRequest('GET', '/markets.json');
  },

  // ── GraphQL 查询（灵活扩展） ──
  async graphql(query, variables = {}) {
    return shopifyRequest('POST', '/graphql.json', { query, variables });
  },

  // ── 主题 ──
  async listThemes() {
    return shopifyRequest('GET', '/themes.json');
  },
  async getThemeAsset(themeId, key) {
    return shopifyRequest('GET', `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  },
  async updateThemeAsset(themeId, key, value, contentType = null) {
    const payload = { asset: { key } };
    if (contentType === 'image') {
      payload.asset.attachment = value;
    } else {
      payload.asset.value = value;
    }
    return shopifyRequest('PUT', `/themes/${themeId}/assets.json`, payload);
  },
  async listThemeAssets(themeId) {
    return shopifyRequest('GET', `/themes/${themeId}/assets.json`);
  },
};

module.exports = ShopifyAPI;
