const ShopifyAPI = require('./shopify-api');

const DIAG_CONFIG = {
  minDescriptionLength: 50,
  maxProductsToCheck: 100,
  maxOrdersToCheck: 50,
  lowStockThreshold: 5,
};

async function runDiagnostic() {
  const issues = [];
  const summary = [];
  let shopDomain = '';

  // ── 1. 店铺基本信息 ──
  let shopInfo = {};
  try {
    shopInfo = (await ShopifyAPI.getShop()).shop || {};
    shopDomain = (shopInfo.domain || process.env.SHOPIFY_STORE || '').replace(/\.\./g, '.').replace(/\.$/, '');
    summary.push(`🏪 店铺：${shopInfo.name || '未知'}`);
    summary.push(`🌐 域名：${shopDomain}`);
    summary.push(`📧 邮箱：${shopInfo.email || '未设置'}`);
    summary.push(`📍 时区：${shopInfo.iana_timezone || '未知'}`);
    summary.push(`💰 货币：${shopInfo.currency || '未知'}`);

    if (!shopInfo.email) {
      issues.push('🔴 店铺未设置客服邮箱');
    }
  } catch (e) {
    issues.push('🔴 无法获取店铺信息 — ' + (e.errors || e.message || 'API 错误'));
    return { ok: false, report: buildReport(summary, issues), issues, summary };
  }

  // ── 2. 商品检查 ──
  let products = [];
  try {
    const data = await ShopifyAPI.listProducts(DIAG_CONFIG.maxProductsToCheck);
    products = data.products || [];
    summary.push(`📦 活跃商品：${products.length} 个`);

    for (const p of products) {
      if (!p.images || p.images.length === 0) {
        issues.push(`⚠️ [商品] ${p.title} — 缺少商品图片 [查看](https://${shopDomain}/admin/products/${p.id})`);
      }
      const descLen = (p.body_html || '').replace(/<[^>]+>/g, '').trim().length;
      if (descLen < DIAG_CONFIG.minDescriptionLength) {
        issues.push(`⚠️ [商品] ${p.title} — 描述过短（${descLen}字）[查看](https://${shopDomain}/admin/products/${p.id})`);
      }
      if (!p.title || p.title.length < 3) {
        issues.push(`⚠️ [商品] ID:${p.id} — 标题异常`);
      }
      for (const v of (p.variants || [])) {
        if (v.inventory_quantity <= DIAG_CONFIG.lowStockThreshold && v.inventory_quantity > 0) {
          issues.push(`⚠️ [库存] ${p.title}(${v.title || '默认'}) — 即将售罄（剩${v.inventory_quantity}件）`);
        }
        if (v.inventory_quantity === 0 && (v.inventory_policy || 'deny') === 'deny') {
          issues.push(`🔴 [库存] ${p.title}(${v.title || '默认'}) — 已断货`);
        }
      }
    }
  } catch (e) {
    issues.push('🔴 无法获取商品列表 — ' + (e.errors || e.message || 'API 错误'));
  }

  // ── 3. 待处理订单 ──
  let orders = [];
  try {
    const data = await ShopifyAPI.listOrders(DIAG_CONFIG.maxOrdersToCheck, 'any');
    orders = data.orders || [];

    const pendingOrders = orders.filter(o =>
      o.fulfillment_status !== 'fulfilled' && o.financial_status !== 'refunded'
    );
    const unfulfilledCount = pendingOrders.length;
    const totalOrderValue = pendingOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0).toFixed(2);

    if (unfulfilledCount > 0) {
      issues.push(`📋 [订单] ${unfulfilledCount} 个订单待处理（总额 $${totalOrderValue}）`);
      for (const o of pendingOrders.slice(0, 5)) {
        const name = o.name || `#${o.order_number}`;
        issues.push(`   🔸 ${name} — $${o.total_price}（${o.fulfillment_status || '未发货'}）[查看](https://${shopDomain}/admin/orders/${o.id})`);
      }
      if (pendingOrders.length > 5) {
        issues.push(`   ... 还有 ${pendingOrders.length - 5} 个待处理订单`);
      }
    } else {
      summary.push('✅ 所有订单已处理，无待发货订单');
    }

    summary.push(`🛒 最近订单：${orders.length} 个`);
  } catch (e) {
    issues.push('🔴 无法获取订单列表 — ' + (e.errors || e.message || 'API 错误'));
  }

  return {
    ok: issues.length === 0 || issues.every(i => i.startsWith('⚠️')),
    report: buildReport(summary, issues),
    issues,
    summary,
  };
}

function buildReport(summary, issues) {
  const lines = [];
  lines.push('📊 药老 · Shopify 巡检报告');
  lines.push('');

  for (const s of summary) {
    lines.push(s);
  }

  if (issues.length > 0) {
    lines.push('');
    lines.push('---');
    lines.push(`📋 发现 ${issues.length} 个待处理项：`);
    lines.push('');
    for (const issue of issues) {
      lines.push(issue);
    }
  } else {
    lines.push('');
    lines.push('✅ 一切正常，无需处理');
  }

  return lines.join('\n');
}

module.exports = { runDiagnostic };
