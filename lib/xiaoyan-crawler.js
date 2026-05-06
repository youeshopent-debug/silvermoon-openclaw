"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const CRAWLER_DATA_DIR = path.join(__dirname, "..", "workspace", "CASHCLAW", "crawler_data");
if (!fs.existsSync(CRAWLER_DATA_DIR)) {
  fs.mkdirSync(CRAWLER_DATA_DIR, { recursive: true });
}

const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 7890;
const CASHCLAW_PROXY = String(process.env.CASHCLAW_PROXY || "").trim();

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
    const mod = options.protocol === "https:" ? https : http;
    const req = mod.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function appendToDailyLog(category, entry) {
  const logFile = path.join(CRAWLER_DATA_DIR, `${category}_${new Date().toISOString().slice(0, 10)}.json`);
  const existing = [];
  if (fs.existsSync(logFile)) {
    try {
      existing.push(...JSON.parse(fs.readFileSync(logFile, "utf8")));
    } catch {}
  }
  existing.push({ crawledAt: new Date().toISOString(), ...entry });
  fs.writeFileSync(logFile, JSON.stringify(existing, null, 2), "utf8");
  return logFile;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min, max) {
  return new Promise((r) => setTimeout(r, min + Math.floor(Math.random() * (max - min))));
}

class XiaoyanCrawler {
  constructor() {
    this._crawleeReady = false;
    this._useProxy = false;
    this._initCrawlee();
  }

  async _checkProxy() {
    return new Promise((resolve) => {
      try {
        const sock = new http.Agent().createConnection({ host: "127.0.0.1", port: 7890 }, (err) => {
          resolve(!err);
        });
        sock.setTimeout(2000, () => { sock.destroy(); resolve(false); });
        sock.on("error", () => resolve(false));
      } catch {
        resolve(false);
      }
    });
  }

  async _initCrawlee() {
    try {
      const { PlaywrightCrawler } = require("crawlee");
      this._PlaywrightCrawler = PlaywrightCrawler;
      this._crawleeReady = true;
      this._useProxy = await this._checkProxy();
    } catch {
      this._crawleeReady = false;
    }
  }

  async _crawlWithPlaywright(urls, label) {
    if (!this._crawleeReady || !this._PlaywrightCrawler) {
      await this._initCrawlee();
    }
    if (!this._crawleeReady) {
      return { fallback: true, reason: "Crawlee not available" };
    }

    const results = [];
    const proxy = getProxyConfig();
    const proxyUrl = `http://${proxy.host}:${proxy.port}`;

    const launchArgs = [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-size=1920,1080",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ];
    if (this._useProxy) {
      launchArgs.push(`--proxy-server=http://${proxy.host}:${proxy.port}`);
    }

    const crawlerOpts = {
      useSessionPool: true,
      persistCookiesPerSession: true,
      sessionPoolOptions: {
        maxPoolSize: 10,
      },
      browserPoolOptions: {
        useFingerprints: true,
        fingerprintOptions: {
          fingerprintGeneratorOptions: {
            browsers: [
              { name: "chrome", minVersion: 120 },
              { name: "edge", minVersion: 120 },
            ],
            devices: ["desktop"],
            operatingSystems: ["windows"],
          },
        },
      },
      launchContext: {
        launchOptions: {
          headless: true,
          args: launchArgs,
        },
      },
      preNavigationHooks: [
        async ({ page }) => {
          await page.setExtraHTTPHeaders({
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          });
        },
      ],
      requestHandler: async ({ page, request, log, session }) => {
        try {
          await randomDelay(2000, 5000);
          await page.waitForLoadState("networkidle", { timeout: 30000 });
          await page.evaluate(() => window.scrollTo(0, Math.floor(Math.random() * 500)));
          await randomDelay(1000, 3000);
          const text = await page.innerText("body");
          const title = await page.title();
          const html = await page.content();
          results.push({
            url: request.url,
            title,
            textLength: text.length,
            text: text.substring(0, 5000),
            htmlSnippet: html.substring(0, 2000),
            status: "ok",
          });
        } catch (err) {
          results.push({ url: request.url, status: "error", error: err.message });
        }
      },
      maxRequestsPerCrawl: urls.length,
      maxConcurrency: 1,
      maxRequestRetries: 3,
      retryOnBlocked: true,
      requestHandlerTimeoutSecs: 60,
    };

    if (this._useProxy) {
      const { ProxyConfiguration } = require("crawlee");
      crawlerOpts.proxyConfiguration = new ProxyConfiguration({
        proxyUrls: [proxyUrl],
      });
    }

    const crawler = new this._PlaywrightCrawler(crawlerOpts);

    try {
      await crawler.run(urls);
    } catch (err) {
      for (const url of urls) {
        if (!results.find((r) => r.url === url)) {
          results.push({ url, status: "error", error: err.message });
        }
      }
    }

    appendToDailyLog(label, { method: "playwright", results });
    return { results, method: "playwright" };
  }

  async crawlByKeywords(keywords, maxResults = 5) {
    const query = encodeURIComponent(keywords.join(" "));
    const searchUrl = `https://www.google.com/search?q=${query}&num=${maxResults}`;

    if (this._crawleeReady) {
      const pw = await this._crawlWithPlaywright([searchUrl], "keyword");
      appendToDailyLog("keyword", { keywords, ...pw });
      return { success: pw.results?.length > 0, data: pw.results, method: "playwright" };
    }

    const proxy = getProxyConfig();
    const url = `https://newsapi.org/v2/everything?q=${query}&pageSize=${maxResults}&language=en`;
    try {
      const resp = await httpRequest({
        hostname: proxy.host,
        port: proxy.port,
        path: url,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 15000,
      });
      appendToDailyLog("keyword", { keywords, results: resp.data });
      return { success: true, data: resp.data, method: "rest" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async crawlUrl(url) {
    if (this._crawleeReady) {
      const pw = await this._crawlWithPlaywright([url], "direct");
      return { success: pw.results?.length > 0, data: pw.results, method: "playwright" };
    }
    return { success: false, error: "Crawlee not available", method: "none" };
  }

  async crawlEcommerce(keywords, sites = ["1688.com", "aliexpress.com", "amazon.com"]) {
    const queries = sites.map((site) => `site:${site} ${keywords.join(" ")}`);
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(queries.join(" OR "))}&num=10`;

    if (!this._crawleeReady) {
      return { success: false, error: "Crawlee not available for ecommerce crawling" };
    }

    const pw = await this._crawlWithPlaywright([searchUrl], "ecommerce");
    appendToDailyLog("ecommerce", { keywords, sites, ...pw });
    return { success: pw.results?.length > 0, data: pw.results, method: "playwright" };
  }

  getLatestData(category) {
    const files = fs.readdirSync(CRAWLER_DATA_DIR)
      .filter((f) => f.startsWith(category))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    try {
      return JSON.parse(fs.readFileSync(path.join(CRAWLER_DATA_DIR, files[0]), "utf8"));
    } catch {
      return null;
    }
  }

  getDataSummary() {
    const files = fs.readdirSync(CRAWLER_DATA_DIR).sort().reverse().slice(0, 15);
    const summary = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CRAWLER_DATA_DIR, file), "utf8"));
        const lastEntry = Array.isArray(data) ? data[data.length - 1] : data;
        summary.push({
          file,
          size: fs.statSync(path.join(CRAWLER_DATA_DIR, file)).size,
          lastCrawled: lastEntry?.crawledAt || "unknown",
        });
      } catch {}
    }
    return summary;
  }
}

module.exports = new XiaoyanCrawler();
