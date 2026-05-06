const API = 'https://api.coingecko.com/api/v3/simple/price';
const COINS = 'bitcoin,ethereum,solana,binancecoin,ripple';

async function fetchMarketDigest() {
  const url = `${API}?ids=${COINS}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();

  const labels = {
    bitcoin: { name: 'BTC', symbol: 'BTC' },
    ethereum: { name: 'ETH', symbol: 'ETH' },
    solana: { name: 'SOL', symbol: 'SOL' },
    binancecoin: { name: 'BNB', symbol: 'BNB' },
    ripple: { name: 'XRP', symbol: 'XRP' },
  };

  const items = Object.entries(data).map(([id, v]) => ({
    symbol: labels[id]?.symbol || id,
    name: labels[id]?.name || id,
    priceUsd: v.usd || 0,
    change24h: v.usd_24h_change != null ? Number(v.usd_24h_change.toFixed(2)) : null,
    marketCap: v.usd_market_cap || 0,
  }));

  return { source: 'CoinGecko', fetchedAt: new Date().toISOString(), items };
}

if (require.main === module) {
  fetchMarketDigest().then(r => {
    r.items.forEach(item =>
      console.log(`${item.symbol} $${item.priceUsd} (${item.change24h != null ? item.change24h + '%' : 'N/A'})`)
    );
  }).catch(e => {
    console.error('market-digest 失败:', e.message);
    process.exit(1);
  });
}

module.exports = { fetchMarketDigest };
