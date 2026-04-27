'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const CRAWLER_DATA_DIR = path.join(__dirname, '..', 'workspace', 'CASHCLAW', 'crawler_data');
if (!fs.existsSync(CRAWLER_DATA_DIR)) {
  fs.mkdirSync(CRAWLER_DATA_DIR, { recursive: true });
}

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 7890;

const CASHCLAW_PROXY = String(process.env.CASHCLAW_PROXY || '').trim();

function getProxyConfig() {
  if (CASHCLAW_PROXY) {
    try {
      const u = new URL(CASHCLAW_PROXY);
      return { host: u.hostname, port: parseInt(u.port, 10) || 7890 };
    } catch {}
  }
  return { host: PROXY_HOST, port: PROXY_PORT };
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const mod = options.protocol === 'https:' ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function appendToDailyLog(category, entry) {
  const logFile = path.join(CRAWLER_DATA_DIR, `${category}_${new Date().toISOString().slice(0, 10)}.json`);
  const existing = [];
  if (fs.existsSync(logFile)) {
    try { existing.push(...JSON.parse(fs.readFileSync(logFile, 'utf8'))); } catch {}
  }
  existing.push({ crawledAt: new Date().toISOString(), ...entry });
  fs.writeFileSync(logFile, JSON.stringify(existing, null, 2), 'utf8');
  return logFile;
}

class XiaoyanCrawler {

  constructor() {
    this._crawleeReady = false;
    this._initCrawlee();
  }

  async _initCrawlee() {
    try {
      const { PlaywrightCrawler } = require('crawlee');
      this._PlaywrightCrawler = PlaywrightCrawler;
      this._crawleeReady = true;
    } catch {
      this._crawleeReady = false;
    }
  }

  async _crawlWithPlaywright(urls, label) {
    if (!this._crawleeReady || !this._PlaywrightCrawler) {
      await this._initCrawlee();
    }
    if (!this._crawleeReady) {
      return { fallback: true, reason: 'Crawlee not available' };
    }

    const results = [];
    const proxy = getProxyConfig();
    const proxyUrl = `http://${proxy.host}:${proxy.port}`;

    const crawler = new this._PlaywrightCrawler({
      proxyConfiguration: {
        proxyUrls: [proxyUrl],
      },
      requestHandler: async ({ page, request, log }) => {
        try {
          await page.waitForLoadState('networkidle', { timeout: 15000 });
          const text = await page.innerText('body');
          const title = await page.title();
          results.push({
            url: request.url,
            title,
            textLength: text.length,
            text: text.substring(0, 3000),
            status: 'ok',
          });
        } catch (err) {
          results.push({
            url: request.url,
            status: 'error',
            error: err.message,
          });
        }
      },
      maxRequestsPerCrawl: urls.length,
      maxConcurrency: 2,
      headless: true,
      retryOnBlocked: true,
      retryOnBlockedCount: 2,
    });

    try {
      await crawler.run(urls);
    } catch (err) {
      for (const url of urls) {
        if (!results.find(r => r.url === url)) {
          results.push({ url, status: 'error', error: err.message });
        }
      }
    }

    appendToDailyLog(label, { method: 'playwright', results });
    return { results, method: 'playwright' };
  }

  _sources = {
    finance: [
      { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,cardano&vs_currencies=usd,myr', type: 'json' },
      { name: 'ExchangeRate-API', url: 'https://v6.exchangerate-api.com/v6/latest/USD', type: 'json' },
      { name: 'GoldAPI', url: 'https://www.goldapi.io/api/XAU/USD', type: 'json' },
    ],
    news: [
      { name: 'GoogleFinance', url: 'https://www.google.com/finance', type: 'browser' },
      { name: 'CoinDesk', url: 'https://www.coindesk.com/', type: 'browser' },
    ],
    web3: [
      { name: 'DeFiLlama', url: 'https://api.llama.fi/protocols', type: 'json' },
      { name: 'DuneAnalytics', url: 'https://dune.com/browse/dashboards', type: 'browser' },
    ],
    macro: [
      { name: 'TradingView', url: 'https://www.tradingview.com/markets/', type: 'browser' },
      { name: 'Investing', url: 'https://www.investing.com/currencies/usd-myr', type: 'browser' },
    ],
  };

  async crawlFinance() {
    const results = [];
    const proxy = getProxyConfig();

    for (const source of this._sources.finance) {
      if (source.type === 'browser' && this._crawleeReady) {
        const pw = await this._crawlWithPlaywright([source.url], 'finance');
        results.push({ source: source.name, ...pw });
        continue;
      }
      try {
        const resp = await httpRequest({
          hostname: proxy.host,
          port: proxy.port,
          path: source.url,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 15000,
        });
        results.push({ source: source.name, status: resp.status, data: resp.data });
      } catch (err) {
        results.push({ source: source.name, status: 'error', error: err.message });
      }
    }

    appendToDailyLog('finance', { results });
    return results;
  }

  async crawlNews() {
    const results = [];
    const proxy = getProxyConfig();

    for (const source of this._sources.news) {
      if (source.type === 'browser' && this._crawleeReady) {
        const pw = await this._crawlWithPlaywright([source.url], 'news');
        results.push({ source: source.name, ...pw });
        continue;
      }
      try {
        const resp = await httpRequest({
          hostname: proxy.host,
          port: proxy.port,
          path: source.url,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 15000,
        });
        results.push({ source: source.name, status: resp.status, data: resp.data });
      } catch (err) {
        results.push({ source: source.name, status: 'error', error: err.message });
      }
    }

    appendToDailyLog('news', { results });
    return results;
  }

  async crawlWeb3() {
    const results = [];
    const proxy = getProxyConfig();

    for (const source of this._sources.web3) {
      if (source.type === 'browser' && this._crawleeReady) {
        const pw = await this._crawlWithPlaywright([source.url], 'web3');
        results.push({ source: source.name, ...pw });
        continue;
      }
      try {
        const resp = await httpRequest({
          hostname: proxy.host,
          port: proxy.port,
          path: source.url,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 15000,
        });
        results.push({ source: source.name, status: resp.status, data: resp.data });
      } catch (err) {
        results.push({ source: source.name, status: 'error', error: err.message });
      }
    }

    appendToDailyLog('web3', { results });
    return results;
  }

  async crawlMacro() {
    const results = [];
    const proxy = getProxyConfig();

    for (const source of this._sources.macro) {
      if (source.type === 'browser' && this._crawleeReady) {
        const pw = await this._crawlWithPlaywright([source.url], 'macro');
        results.push({ source: source.name, ...pw });
        continue;
      }
      try {
        const resp = await httpRequest({
          hostname: proxy.host,
          port: proxy.port,
          path: source.url,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 15000,
        });
        results.push({ source: source.name, status: resp.status, data: resp.data });
      } catch (err) {
        results.push({ source: source.name, status: 'error', error: err.message });
      }
    }

    appendToDailyLog('macro', { results });
    return results;
  }

  async crawlAll() {
    const [finance, news, web3, macro] = await Promise.allSettled([
      this.crawlFinance(),
      this.crawlNews(),
      this.crawlWeb3(),
      this.crawlMacro(),
    ]);

    return {
      finance: finance.status === 'fulfilled' ? finance.value : [],
      news: news.status === 'fulfilled' ? news.value : [],
      web3: web3.status === 'fulfilled' ? web3.value : [],
      macro: macro.status === 'fulfilled' ? macro.value : [],
    };
  }

  async crawlByKeywords(keywords, maxResults = 5) {
    const proxy = getProxyConfig();
    const query = encodeURIComponent(keywords.join(' '));

    if (this._crawleeReady) {
      const searchUrl = `https://www.google.com/search?q=${query}&num=${maxResults}`;
      const pw = await this._crawlWithPlaywright([searchUrl], 'keyword');
      appendToDailyLog('keyword', { keywords, ...pw });
      return { success: pw.results?.length > 0, data: pw.results, method: 'playwright' };
    }

    const url = `https://newsapi.org/v2/everything?q=${query}&pageSize=${maxResults}&language=en`;
    try {
      const resp = await httpRequest({
        hostname: proxy.host,
        port: proxy.port,
        path: url,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000,
      });
      appendToDailyLog('keyword', { keywords, results: resp.data });
      return { success: true, data: resp.data, method: 'rest' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async crawlSentinel() {
    const result = await this.crawlAll();
    const summary = {
      finance: result.finance.filter(r => r.status === 'ok' || r.status === 200).length,
      news: result.news.filter(r => r.status === 'ok' || r.status === 200).length,
      web3: result.web3.filter(r => r.status === 'ok' || r.status === 200).length,
      macro: result.macro.filter(r => r.status === 'ok' || r.status === 200).length,
      totalErrors: [...result.finance, ...result.news, ...result.web3, ...result.macro]
        .filter(r => r.status === 'error').length,
      crawledAt: new Date().toISOString(),
    };

    const sentinelFile = path.join(CRAWLER_DATA_DIR, 'sentinel_summary.json');
    const history = [];
    if (fs.existsSync(sentinelFile)) {
      try { history.push(...JSON.parse(fs.readFileSync(sentinelFile, 'utf8'))); } catch {}
    }
    history.push(summary);
    if (history.length > 30) history.splice(0, history.length - 30);
    fs.writeFileSync(sentinelFile, JSON.stringify(history, null, 2), 'utf8');

    return summary;
  }

  getLatestData(category) {
    const files = fs.readdirSync(CRAWLER_DATA_DIR)
      .filter(f => f.startsWith(category))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    try {
      return JSON.parse(fs.readFileSync(path.join(CRAWLER_DATA_DIR, files[0]), 'utf8'));
    } catch {
      return null;
    }
  }

  getDataSummary() {
    const files = fs.readdirSync(CRAWLER_DATA_DIR).sort().reverse().slice(0, 15);
    const summary = [];

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CRAWLER_DATA_DIR, file), 'utf8'));
        const lastEntry = Array.isArray(data) ? data[data.length - 1] : data;
        summary.push({
          file,
          size: fs.statSync(path.join(CRAWLER_DATA_DIR, file)).size,
          lastCrawled: lastEntry?.crawledAt || 'unknown',
        });
      } catch {}
    }

    return summary;
  }

  getSentinelHistory() {
    const sentinelFile = path.join(CRAWLER_DATA_DIR, 'sentinel_summary.json');
    if (!fs.existsSync(sentinelFile)) return [];
    try {
      return JSON.parse(fs.readFileSync(sentinelFile, 'utf8'));
    } catch {
      return [];
    }
  }
}

module.exports = new XiaoyanCrawler();
