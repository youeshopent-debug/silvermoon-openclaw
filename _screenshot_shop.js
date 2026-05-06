const api = require('./lib/shopify-api');

(async () => {
  const shop = await api.getShop();
  console.log('Store:', JSON.stringify(shop, null, 2));
})();
