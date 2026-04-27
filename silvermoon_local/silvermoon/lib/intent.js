function isNonEmpty(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

function formatNum(n, digits) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const d = Math.max(0, Math.min(8, Number(digits || 0) || 0));
  return v.toFixed(d);
}

function buildCard(title, bullets) {
  const t = String(title || '').trim();
  const lines = [];
  lines.push('✅ 主人');
  if (t) lines.push(`🔹 ${t}`);
  for (const b of Array.isArray(bullets) ? bullets : []) {
    const s = String(b || '').trim();
    if (!s) continue;
    lines.push(`🔹 ${s}`);
  }
  return lines.join('\n').trim();
}

const CACHE = {
  fx: { at: 0, v: null },
  gold: { at: 0, v: null },
  crypto: { at: 0, v: null },
};

function within(ms, at) {
  const t = Number(at || 0) || 0;
  return Date.now() - t <= ms;
}

async function tryIntentIntercept(text, deps) {
  const s = String(text || '').trim();
  if (!isNonEmpty(s)) return null;

  const d = deps && typeof deps === 'object' ? deps : {};
  const fetchUsdMyr = d.fetchUsdMyr;
  const fetchMetalsSpotUsd = d.fetchMetalsSpotUsd;
  const fetchCryptoUsd = d.fetchCryptoUsd;

  const reFx = /(汇率|美元\/马币|usd\s*\/\s*myr|usdmyr|马币汇率|MYR|换汇|兑马币)/i;
  const reGold = /(金价|黄金|国际黄金|gold|xau|金|贵金属)/i;
  const reCrypto = /(加密|crypto|币价|比特币|以太坊|\bBTC\b|\bETH\b)/i;

  const ttlMs = 35_000;

  if (reFx.test(s)) {
    let fx = within(ttlMs, CACHE.fx.at) ? CACHE.fx.v : null;
    if (fx == null && typeof fetchUsdMyr === 'function') {
      try {
        fx = await fetchUsdMyr();
        if (Number.isFinite(fx)) {
          CACHE.fx = { at: Date.now(), v: Number(fx) };
        } else {
          fx = null;
        }
      } catch {
        fx = null;
      }
    }
    const line = fx == null ? '马币汇率：暂无（网络不可用）' : `马币汇率：美元/马币 ${formatNum(fx, 4)}`;
    return buildCard('汇率快报', [line, '需要我按你的偏好固定在早报里，我可以直接接入。']);
  }

  if (reGold.test(s)) {
    let gold = within(ttlMs, CACHE.gold.at) ? CACHE.gold.v : null;
    if (gold == null && typeof fetchMetalsSpotUsd === 'function') {
      try {
        const m = await fetchMetalsSpotUsd();
        const g = m && Number.isFinite(m.gold) ? Number(m.gold) : null;
        if (g != null) {
          gold = g;
          CACHE.gold = { at: Date.now(), v: g };
        }
      } catch {
        gold = null;
      }
    }
    const line = gold == null ? '国际黄金：暂无（网络不可用）' : `国际黄金：$${formatNum(gold, 2)}/oz`;
    return buildCard('金价快报', [line, '要不要我同时把马币金价（按汇率换算）也补上？']);
  }

  if (reCrypto.test(s)) {
    let crypto = within(ttlMs, CACHE.crypto.at) ? CACHE.crypto.v : null;
    if (crypto == null && typeof fetchCryptoUsd === 'function') {
      try {
        const j = await fetchCryptoUsd();
        const out = {
          btc: Number.isFinite(j?.btc) ? Number(j.btc) : null,
          btcChg: Number.isFinite(j?.btcChg) ? Number(j.btcChg) : null,
          eth: Number.isFinite(j?.eth) ? Number(j.eth) : null,
          ethChg: Number.isFinite(j?.ethChg) ? Number(j.ethChg) : null,
        };
        if (out.btc != null || out.eth != null) {
          crypto = out;
          CACHE.crypto = { at: Date.now(), v: out };
        }
      } catch {
        crypto = null;
      }
    }
    if (!crypto) return buildCard('加密快报', ['BTC/ETH：暂无（网络不可用）']);
    const bullets = [];
    if (crypto.btc != null) bullets.push(`比特币(BTC)：$${formatNum(crypto.btc, 0)}${crypto.btcChg == null ? '' : `（24h ${formatNum(crypto.btcChg, 2)}%）`}`);
    if (crypto.eth != null) bullets.push(`以太坊(ETH)：$${formatNum(crypto.eth, 0)}${crypto.ethChg == null ? '' : `（24h ${formatNum(crypto.ethChg, 2)}%）`}`);
    bullets.push('要我把“RWA/AI 领域最新资料”也做成一键快报吗？我可以直接给你 5 条链接。');
    return buildCard('加密快报', bullets);
  }

  return null;
}

module.exports = { tryIntentIntercept };

