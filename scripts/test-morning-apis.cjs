const https = require('https');
const http = require('http');

const PROXY = process.env.OPENCLAW_PROXY_URL || '';

async function testFetch(label, url, opts = {}) {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      ...opts,
    });
    const text = await resp.text();
    const ms = Date.now() - start;
    console.log(`✅ ${label} (${ms}ms) HTTP ${resp.status} ${text.slice(0,80)}`);
    return true;
  } catch (e) {
    const ms = Date.now() - start;
    console.log(`❌ ${label} (${ms}ms) ${e?.message || e}`);
    return false;
  }
}

(async () => {
  console.log('=== 早报 API 连通性测试 ===\n');

  const results = [];

  // 天气
  results.push(await testFetch('天气', 'https://api.open-meteo.com/v1/forecast?latitude=4.2445&longitude=117.889&current_weather=true'));

  // Google News (本地新闻)
  results.push(await testFetch('Google News (本地)', 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVnVHZ0pWVXlnQVAB?hl=zh-CN&gl=CN&ceid=CN:zh-Hans'));

  // BBC 中文 (世界新闻)
  results.push(await testFetch('BBC 中文', 'https://www.bbc.com/zhongwen/simp/topics/c406y6zpv7yt'));

  // CoinGecko (加密货币)
  results.push(await testFetch('CoinGecko BTC', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'));

  // Gold API
  results.push(await testFetch('Gold API (metals)', 'https://api.metals.live/v1/spot/gold'));

  // FRED (美国利率)
  results.push(await testFetch('FRED FEDFUNDS', 'https://fred.stlouisfed.org/graph/fredgraph.csv?bgcolor=%23e1e9f0&chart_type=line&drp=0&fo=open%20sans&graph_bgcolor=%23ffffff&height=450&mode=fred&recession_bars=on&txtcolor=%23444444&ts=12&tts=12&width=749&nt=0&thu=0&trc=0&show_legend=yes&show_axis_titles=yes&show_tooltip=yes&id=FEDFUNDS&scale=left&cosd=2024-05-01&coed=2025-05-01&line_color=%234572a7&link_values=false&line_style=solid&mark_type=none&mw=3&lw=2&ost=-99999&oet=99999&mma=0&fml=a&fq=Daily&fam=avg&fgst=lin&fgsnd=2020-02-01&line_index=1&transformation=lin&vintage_date=2025-05-01&revision_date=2025-05-01&nd=1954-07-01'));

  // 外汇 (USD/MYR)
  results.push(await testFetch('USD/MYR', 'https://open.er-api.com/v6/latest/USD'));

  const ok = results.filter(Boolean).length;
  console.log(`\n=== 总结: ${ok}/${results.length} 通过 ===`);
})().catch(console.error);
