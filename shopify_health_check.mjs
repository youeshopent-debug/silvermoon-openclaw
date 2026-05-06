import ShopifyAPI from './lib/shopify-api.js';

async function main() {
  console.log('=== 银月钱庄 · Shopify 健康检查 ===\n');

  // 1. 店铺信息
  try {
    const shop = await ShopifyAPI.getShop();
    const s = shop.shop;
    console.log(`[店铺] 名称: ${s.name}`);
    console.log(`[店铺] 域名: ${s.domain}`);
    console.log(`[店铺] 邮箱: ${s.email}`);
    console.log(`[店铺] 货币: ${s.currency}`);
    console.log(`[店铺] 时区: ${s.timezone}`);
    console.log(`[店铺] 计划: ${s.plan_name}`);
    console.log(`[店铺] 已创建: ${s.created_at}`);
    console.log(`[店铺] 状态: ${s.force_ssl ? 'HTTPS ✅' : '⚠️ 无 HTTPS'}`);
    console.log(`[店铺] 地址: ${s.address1 || ''}, ${s.city || ''}, ${s.country_name || ''}\n`);
  } catch (e) {
    console.error(`[店铺] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  // 2. 产品
  try {
    const products = await ShopifyAPI.listProducts(250, 'active');
    console.log(`[产品] 活跃产品数: ${products.products.length}`);
    for (const p of products.products) {
      const v = p.variants?.[0];
      console.log(`  - ${p.id}: ${p.title} | $${v?.price || '?'} | 库存: ${v?.inventory_quantity || 0} | 状态: ${p.status}`);
    }
    console.log();
  } catch (e) {
    console.error(`[产品] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  // 3. 订单
  try {
    const orders = await ShopifyAPI.listOrders(10, 'any');
    console.log(`[订单] 最近订单数: ${orders.orders.length}`);
    for (const o of orders.orders) {
      console.log(`  - #${o.order_number}: $${o.total_price} | ${o.financial_status} | ${o.fulfillment_status || '未发货'} | ${o.created_at?.slice(0, 10)}`);
    }
    console.log();
  } catch (e) {
    console.error(`[订单] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  // 4. 客户
  try {
    const customers = await ShopifyAPI.listCustomers(10);
    console.log(`[客户] 总客户数: ${customers.customers.length}`);
    console.log();
  } catch (e) {
    console.error(`[客户] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  // 5. 市场（多币种）
  try {
    const markets = await ShopifyAPI.listMarkets();
    console.log(`[市场] 数量: ${markets.markets?.length || 0}`);
    if (markets.markets) {
      for (const m of markets.markets) {
        console.log(`  - ${m.name} | ${m.enabled ? '启用 ✅' : '禁用 ❌'} | 货币: ${m.currency?.iso_code || '?'}`);
      }
    }
    console.log();
  } catch (e) {
    console.error(`[市场] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  // 6. 主题
  try {
    const themes = await ShopifyAPI.graphql(`{
      themes(first: 10) {
        edges {
          node {
            id
            name
            prefix
            role
          }
        }
      }
    }`);
    const edges = themes?.data?.themes?.edges || [];
    console.log(`[主题] 数量: ${edges.length}`);
    for (const e of edges) {
      const n = e.node;
      console.log(`  - ${n.name} | 角色: ${n.role} | ID: ${n.id?.split('/').pop()}`);
    }
    console.log();
  } catch (e) {
    console.error(`[主题] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  // 7. 页面（检查 Landing Page）
  try {
    const pages = await ShopifyAPI.graphql(`{
      pages(first: 10) {
        edges {
          node {
            id
            title
            handle
            publishedAt
          }
        }
      }
    }`);
    const pageEdges = pages?.data?.pages?.edges || [];
    console.log(`[页面] 数量: ${pageEdges.length}`);
    for (const e of pageEdges) {
      const n = e.node;
      console.log(`  - ${n.title} | /pages/${n.handle} | ${n.publishedAt ? '已发布 ✅' : '未发布 ❌'}`);
    }
    console.log();
  } catch (e) {
    console.error(`[页面] ❌ 获取失败: ${e.errors || e.message || e}\n`);
  }

  console.log('=== 检查完毕 ===');
}

main().catch(e => {
  console.error('[致命]', e?.message || e);
  process.exit(1);
});
