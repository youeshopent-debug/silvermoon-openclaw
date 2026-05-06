const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'workspace', 'CASHCLAW');
const LOG_FILE = path.join(LOG_DIR, 'product_profits.jsonl');

const DEFAULT_RATES = { USD_CNY: 7.2, USD_MYR: 4.5 };

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function toUSD(costPriceUSD, costPriceCNY, costPriceMYR) {
  if (costPriceUSD != null) return Number(costPriceUSD);
  if (costPriceCNY != null) return Number(costPriceCNY) / DEFAULT_RATES.USD_CNY;
  if (costPriceMYR != null) return Number(costPriceMYR) / DEFAULT_RATES.USD_MYR;
  return 0;
}

function calculateProfit({
  productName = 'unknown',
  sourceUrl = '',
  supplier = '',
  costPriceUSD,
  costPriceCNY,
  costPriceMYR,
  shippingCostUSD = 0,
  platformFee = 0.05,
  sellingPriceUSD,
  targetProfitRate = 30,
}) {
  const usdCost = toUSD(costPriceUSD, costPriceCNY, costPriceMYR);
  const totalCost = usdCost + Number(shippingCostUSD);
  const sp = Number(sellingPriceUSD) || 0;
  const platformCut = sp * Number(platformFee);
  const netRevenue = sp - platformCut;
  const profit = netRevenue - totalCost;
  const profitRate = sp > 0 ? ((profit / sp) * 100) : 0;
  const viable = profit > 0 && profitRate >= targetProfitRate;

  const record = {
    productName,
    sourceUrl,
    supplier,
    costPriceUSD: usdCost.toFixed(2),
    shippingCostUSD: Number(shippingCostUSD).toFixed(2),
    platformFee: Number(platformFee),
    sellingPriceUSD: sp.toFixed(2),
    totalCost: totalCost.toFixed(2),
    profit: profit.toFixed(2),
    profitRate: Number(profitRate.toFixed(1)),
    viable,
    checkedAt: new Date().toISOString(),
  };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
  } catch (e) {
    // 落盘失败不阻塞，静默记录
  }

  return {
    ...record,
    summary: `$${totalCost.toFixed(2)} → $${profit.toFixed(2)} | ${profitRate.toFixed(1)}% | ${viable ? '✅ 可做' : '❌ 淘汰'}`,
  };
}

module.exports = calculateProfit;
