'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const MEMORIAL_DIR = path.join(__dirname, '..', 'workspace', 'memorials');
const CRAWLER_DATA_DIR = path.join(__dirname, '..', 'workspace', 'CASHCLAW', 'crawler_data');
const BROWSER_DATA_DIR = path.join(__dirname, '..', 'user_data', 'chrome-freelance-automation');

for (const dir of [MEMORIAL_DIR, CRAWLER_DATA_DIR, BROWSER_DATA_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 7890;

function getProxyConfig() {
  const proxy = String(process.env.CASHCLAW_PROXY || '').trim();
  if (proxy) {
    try {
      const u = new URL(proxy);
      return { host: u.hostname, port: parseInt(u.port, 10) || 7890 };
    } catch {}
  }
  return { host: PROXY_HOST, port: PROXY_PORT };
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

function appendMemorial(entry) {
  const logFile = path.join(MEMORIAL_DIR, `memorial_${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.appendFileSync(logFile, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
  return logFile;
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
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

class FreelanceCrawler {
  constructor() {
    this._crawleeReady = false;
    this._browser = null;
    this._context = null;
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

  async _ensureBrowser() {
    if (this._browser) return this._browser;
    const { chromium } = require('playwright');
    this._browser = await chromium.launchPersistentContext(BROWSER_DATA_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      timezoneId: 'Asia/Kuala_Lumpur',
      proxy: getProxyConfig(),
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    this._context = this._browser;
    return this._browser;
  }

  async _closeBrowser() {
    if (this._browser) {
      try { await this._browser.close(); } catch {}
      this._browser = null;
      this._context = null;
    }
  }

  async _screenshot(page, name) {
    const screenshotDir = path.join(MEMORIAL_DIR, 'screenshots');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    const filePath = path.join(screenshotDir, `${name}_${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
  }

  async scanFiverrInbox() {
    const context = await this._ensureBrowser();
    const page = await context.newPage();
    const results = { platform: 'fiverr', messages: [], error: null };

    try {
      await page.goto('https://www.fiverr.com/inbox', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      const isLoggedIn = await page.locator('a[href="/inbox"]').count() > 0
        || await page.locator('.inbox-conversations').count() > 0
        || await page.locator('[data-testid="conversation-list"]').count() > 0;

      if (!isLoggedIn) {
        results.error = 'not_logged_in';
        results.screenshot = await this._screenshot(page, 'fiverr_not_logged_in');
        appendMemorial({ platform: 'fiverr', action: 'scan', status: 'not_logged_in', screenshot: results.screenshot });
        await page.close();
        return results;
      }

      const conversations = await page.locator('[data-testid="conversation-list-item"], .conversation-item, .inbox-conversation').all();
      const maxScan = Math.min(conversations.length, 10);

      for (let i = 0; i < maxScan; i++) {
        try {
          const conv = conversations[i];
          const senderName = await conv.locator('.username, [data-testid="username"], .conversation-partner').innerText().catch(() => 'unknown');
          const preview = await conv.locator('.message-preview, .last-message, [data-testid="last-message"]').innerText().catch(() => '');
          const timeAgo = await conv.locator('.time-ago, .message-time, [data-testid="time-ago"]').innerText().catch(() => '');

          await conv.click();
          await page.waitForTimeout(2000);

          const chatMessages = await page.locator('.message-item, [data-testid="message"], .chat-message').all();
          const recentMessages = [];
          for (const msg of chatMessages.slice(-6)) {
            const text = await msg.innerText().catch(() => '');
            if (text.trim()) recentMessages.push(text.trim());
          }

          results.messages.push({
            sender: senderName,
            preview: preview.trim(),
            timeAgo: timeAgo.trim(),
            recentMessages: recentMessages.slice(-4),
            hasNewMessage: preview.length > 0,
          });
        } catch (convErr) {
          continue;
        }
      }

      results.screenshot = await this._screenshot(page, 'fiverr_inbox');
      appendMemorial({ platform: 'fiverr', action: 'scan', status: 'ok', messageCount: results.messages.length });
    } catch (err) {
      results.error = err.message;
      results.screenshot = await this._screenshot(page, 'fiverr_error').catch(() => null);
      appendMemorial({ platform: 'fiverr', action: 'scan', status: 'error', error: err.message });
    }

    await page.close();
    return results;
  }

  async scanUpworkInbox() {
    const context = await this._ensureBrowser();
    const page = await context.newPage();
    const results = { platform: 'upwork', messages: [], error: null };

    try {
      await page.goto('https://www.upwork.com/ab/messages/', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      const isLoggedIn = await page.locator('.conversation-list, [data-test="conversation-list"], .messages-list').count() > 0;

      if (!isLoggedIn) {
        results.error = 'not_logged_in';
        results.screenshot = await this._screenshot(page, 'upwork_not_logged_in');
        appendMemorial({ platform: 'upwork', action: 'scan', status: 'not_logged_in', screenshot: results.screenshot });
        await page.close();
        return results;
      }

      const conversations = await page.locator('.conversation-item, [data-test="conversation-item"], .message-list-item').all();
      const maxScan = Math.min(conversations.length, 10);

      for (let i = 0; i < maxScan; i++) {
        try {
          const conv = conversations[i];
          const senderName = await conv.locator('.conversation-partner-name, [data-test="partner-name"], .freelancer-name').innerText().catch(() => 'unknown');
          const preview = await conv.locator('.conversation-preview, [data-test="preview"], .message-preview').innerText().catch(() => '');
          const timeAgo = await conv.locator('.conversation-time, [data-test="time"], .time-ago').innerText().catch(() => '');

          results.messages.push({
            sender: senderName,
            preview: preview.trim(),
            timeAgo: timeAgo.trim(),
            hasNewMessage: preview.length > 0,
          });
        } catch (convErr) {
          continue;
        }
      }

      results.screenshot = await this._screenshot(page, 'upwork_inbox');
      appendMemorial({ platform: 'upwork', action: 'scan', status: 'ok', messageCount: results.messages.length });
    } catch (err) {
      results.error = err.message;
      results.screenshot = await this._screenshot(page, 'upwork_error').catch(() => null);
      appendMemorial({ platform: 'upwork', action: 'scan', status: 'error', error: err.message });
    }

    await page.close();
    return results;
  }

  async backgroundCheck(clientName, platform) {
    const context = await this._browser || await this._ensureBrowser();
    const page = await context.newPage();
    const results = { clientName, platform, profile: null, reviews: [], error: null };

    try {
      const searchQuery = encodeURIComponent(`${clientName} ${platform === 'fiverr' ? 'Fiverr' : 'Upwork'} client review`);
      await page.goto(`https://www.google.com/search?q=${searchQuery}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      const searchResults = await page.locator('div.g, div[data-hveid], .tF2Cxc').all();
      const profileData = [];

      for (const result of searchResults.slice(0, 5)) {
        try {
          const title = await result.locator('h3').innerText().catch(() => '');
          const snippet = await result.locator('.VwiC3b, .lEBKkf, span.aCOpRe').innerText().catch(() => '');
          const link = await result.locator('a').getAttribute('href').catch(() => '');
          if (title) profileData.push({ title, snippet: snippet.slice(0, 300), link });
        } catch {}
      }

      results.profile = profileData;
      results.screenshot = await this._screenshot(page, `background_${platform}_${Date.now()}`);
      appendMemorial({ platform, action: 'background_check', clientName, status: 'ok', profileCount: profileData.length });
    } catch (err) {
      results.error = err.message;
      appendMemorial({ platform, action: 'background_check', clientName, status: 'error', error: err.message });
    }

    await page.close();
    return results;
  }

  async scanAll() {
    const [fiverr, upwork] = await Promise.allSettled([
      this.scanFiverrInbox(),
      this.scanUpworkInbox(),
    ]);

    const results = {
      fiverr: fiverr.status === 'fulfilled' ? fiverr.value : { platform: 'fiverr', messages: [], error: fiverr.reason?.message },
      upwork: upwork.status === 'fulfilled' ? upwork.value : { platform: 'upwork', messages: [], error: upwork.reason?.message },
      scannedAt: new Date().toISOString(),
    };

    appendToDailyLog('freelance_scan', results);
    return results;
  }

  async close() {
    await this._closeBrowser();
  }
}

module.exports = new FreelanceCrawler();
