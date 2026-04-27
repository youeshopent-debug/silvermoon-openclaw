const assert = require('assert');

const {
  fetchUsdMyrWithFallback,
  fetchGoldSpotUsdWithFallback,
} = require('../lib/finance-fallback');

async function run() {
  {
    const calls = [];
    const fetchJson = async (url) => {
      calls.push(url);
      if (String(url).includes('exchangerate.host')) throw new Error('down');
      if (String(url).includes('frankfurter.app')) return { rates: { MYR: 4.77 } };
      throw new Error('unexpected');
    };
    const r = await fetchUsdMyrWithFallback({ fetchJson });
    assert.equal(r.ok, true);
    assert.equal(r.fx, 4.77);
    assert.equal(r.source, 'frankfurter');
    assert.equal(calls.length >= 2, true);
  }

  {
    const fetchJson = async (url) => {
      if (String(url).includes('open.er-api.com')) return { rates: { MYR: 4.88 } };
      throw new Error('down');
    };
    const r = await fetchUsdMyrWithFallback({ fetchJson });
    assert.equal(r.ok, true);
    assert.equal(r.fx, 4.88);
    assert.equal(r.source, 'erapi');
  }

  {
    const fetchJson = async (url) => {
      if (String(url).includes('base=XAU')) return { rates: { USD: 2345.67 } };
      throw new Error('down');
    };
    const r = await fetchGoldSpotUsdWithFallback({ fetchJson });
    assert.equal(r.ok, true);
    assert.equal(r.goldUsdPerOz, 2345.67);
    assert.equal(r.source, 'exchangerate_xau');
  }

  {
    const fetchJson = async (url) => {
      if (String(url).includes('exchangerate.host')) throw new Error('down');
      if (String(url).includes('coingecko') && String(url).includes('tether-gold')) return { 'tether-gold': { usd: 2468.9 } };
      throw new Error('unexpected');
    };
    const r = await fetchGoldSpotUsdWithFallback({ fetchJson });
    assert.equal(r.ok, true);
    assert.equal(r.goldUsdPerOz, 2468.9);
    assert.equal(r.source, 'coingecko_xaut');
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
