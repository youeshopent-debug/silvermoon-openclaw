function toNum(x) {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

async function tryOne(fetchJson, url, parse) {
  const u = String(url || '').trim();
  if (!u) return null;
  try {
    const j = await fetchJson(u);
    const out = parse(j);
    return out;
  } catch {
    return null;
  }
}

async function fetchUsdMyrWithFallback({ fetchJson }) {
  const f = fetchJson;
  if (typeof f !== 'function') return { ok: false, reason: 'no_fetch' };

  const r1 = await tryOne(f, 'https://api.exchangerate.host/latest?base=USD&symbols=MYR', (j) => toNum(j?.rates?.MYR));
  if (r1 != null) return { ok: true, fx: r1, source: 'exchangerate_host' };

  const r2 = await tryOne(f, 'https://api.frankfurter.app/latest?from=USD&to=MYR', (j) => toNum(j?.rates?.MYR));
  if (r2 != null) return { ok: true, fx: r2, source: 'frankfurter' };

  const r3 = await tryOne(f, 'https://open.er-api.com/v6/latest/USD', (j) => toNum(j?.rates?.MYR));
  if (r3 != null) return { ok: true, fx: r3, source: 'erapi' };

  return { ok: false, reason: 'unavailable' };
}

async function fetchGoldSpotUsdWithFallback({ fetchJson }) {
  const f = fetchJson;
  if (typeof f !== 'function') return { ok: false, reason: 'no_fetch' };

  const r1 = await tryOne(f, 'https://api.exchangerate.host/latest?base=XAU&symbols=USD', (j) => toNum(j?.rates?.USD));
  if (r1 != null) return { ok: true, goldUsdPerOz: r1, source: 'exchangerate_xau' };

  return { ok: false, reason: 'unavailable' };
}

module.exports = { fetchUsdMyrWithFallback, fetchGoldSpotUsdWithFallback };

