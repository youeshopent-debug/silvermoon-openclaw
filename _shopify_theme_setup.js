const ShopifyAPI = require('./lib/shopify-api');

async function main() {
  try {
    // 1. 验证连接 + 获取店铺信息
    const shop = await ShopifyAPI.getShop();
    console.log('✅ 连接成功! 店铺:', shop.shop.name, shop.shop.domain);

    // 2. 获取当前主题
    // Shopify REST: /admin/api/2025-01/themes.json
    const themes = await ShopifyAPI.graphql(`{ themes(first: 10) { edges { node { id name role } } } }`);
    console.log('\n📦 主题列表:');
    const mainTheme = themes.data?.themes?.edges?.find(e => e.node.role === 'main');
    console.log(JSON.stringify(themes, null, 2));

    // 3. 获取商品列表
    const products = await ShopifyAPI.listProducts(10);
    console.log('\n📦 商品列表:');
    for (const p of products.products || []) {
      console.log(`  - [${p.id}] ${p.title} ($${p.variants?.[0]?.price})`);
    }

  } catch (err) {
    console.error('❌ 连接失败:', JSON.stringify(err, null, 2));
  }
}

main();
