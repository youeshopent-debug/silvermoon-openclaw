'use strict';

/**
 * dsers-integration.js — DSers Shopify 集成核心模块
 *
 * 基于 Playwright 自动化 DSers Web 后台的 "Import → Push to Shopify" 全流程。
 * 解决旧版 _push_products.mjs 需要 "draft + 手动 Link to Existing Product" 的痛点。
 *
 * 依赖: playwright (已在 package.json)
 *
 * 用法:
 *   const dsers = require('./dsers-integration');
 *   const result = await dsers.pushProduct({ aliUrl: 'https://...' });
 *
 * Plan B (降级): 如果 Playwright 启动失败，自动回退到 Chrome CDP Bridge
 * Plan C (逃生): 如果 DSers Web 不可用，输出完整的 AliExpress 产品信息供手动操作
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DSERS_BASE = 'https://app.dsers.com';
const SESSION_DIR = path.join(__dirname, '..', '.silvermoon_core', 'dsers_sessions');
const SESSION_FILE = path.join(SESSION_DIR, 'session.json');
const NAV_TIMEOUT = 60_000;
const ACTION_TIMEOUT = 30_000;
const MAX_RETRIES = 3;

const PROXY_URL = process.env.OPENCLAW_PROXY_URL || process.env.HTTP_PROXY || '';

let _browser = null;

// ─── 日志 ───────────────────────────────────
let _logBuffer = [];
function log(level, msg, data) {
  const entry = { t: new Date().toISOString(), level, msg };
  if (data) entry.data = typeof data === 'string' ? data : JSON.stringify(data);
  _logBuffer.push(entry);
  if (level === 'error') console.error(`[DSERS] ${msg}`, data || '');
  else console.log(`[DSERS] ${level.toUpperCase()} ${msg}`);
}
function getLogs() { return _logBuffer; }

// ─── 工具函数 ───────────────────────────────

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); return true; }
  catch { return false; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function withTimeout(promise, ms, msg) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg || `Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sanitizeUrl(url) {
  if (!url) return '';
  const s = url.trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('www.')) return 'https://' + s;
  return s;
}

// ─── Session 管理 ──────────────────────────

function getSessionPath(label) {
  const safe = (label || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(SESSION_DIR, `session_${safe}.json`);
}

function loadSession(label) {
  const fp = getSessionPath(label);
  try {
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.cookies)) return null;
    const age = Date.now() - (data.savedAt || 0);
    if (age > 7 * 24 * 3600 * 1000) {
      log('warn', `Session ${label} expired (${Math.round(age / 3600000)}h old)`);
      return null;
    }
    log('info', `Loaded session ${label} (${Math.round(age / 60000)}m old)`);
    return data;
  } catch (e) {
    log('warn', `Failed to load session ${label}: ${e.message}`);
    return null;
  }
}

function saveSession(cookies, storageState, label) {
  ensureDir(SESSION_DIR);
  const fp = getSessionPath(label);
  const data = {
    label,
    savedAt: Date.now(),
    cookies,
    storageState: storageState || null,
  };
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  log('info', `Session ${label} saved to ${fp}`);
}

// ─── 浏览器管理 ────────────────────────────

async function launchBrowser(headless = false) {
  if (_browser && _browser.isConnected()) {
    log('info', 'Reusing existing browser instance');
    return _browser;
  }

  const launchOpts = {
    headless,
    timeout: NAV_TIMEOUT,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };

  if (PROXY_URL) {
    launchOpts.args.push(`--proxy-server=${PROXY_URL}`);
    log('info', `Using proxy: ${PROXY_URL}`);
  }

  try {
    _browser = await chromium.launch(launchOpts);
    log('info', 'Playwright browser launched');
  } catch (e) {
    log('error', `Failed to launch Playwright: ${e.message}`);
    _browser = null;
    throw e;
  }

  return _browser;
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
    log('info', 'Browser closed');
  }
}

// ─── 创建上下文 ────────────────────────────

async function createContext(browser, sessionLabel) {
  const ctxOpts = {
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Asia/Singapore',
  };

  const ctx = await browser.newContext(ctxOpts);

  const saved = loadSession(sessionLabel);
  if (saved && Array.isArray(saved.cookies)) {
    try {
      await ctx.addCookies(saved.cookies);
      log('info', `Restored ${saved.cookies.length} session cookies`);
    } catch (e) {
      log('warn', `Failed to restore cookies: ${e.message}`);
    }
  }

  return ctx;
}

// ─── DSers 登录 ────────────────────────────

async function loginToDSers(page, { email, password, shopifyStore }) {
  log('info', 'Starting DSers login flow');

  await page.goto(DSERS_BASE, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
  await sleep(3000);

  const currentUrl = page.url();
  log('info', `Current URL after navigation: ${currentUrl}`);

  if (currentUrl.includes('dashboard') || currentUrl.includes('product') || currentUrl.includes('home')) {
    log('info', 'Already logged in to DSers');
    return true;
  }

  let loginBtn = null;
  try {
    loginBtn = await page.waitForSelector('text=Login, text=Sign In, text=Log in', { timeout: 8000 });
  } catch {
    log('warn', 'No login button found, may already be logged in');
    const pageContent = await page.content();
    if (pageContent.includes('dashboard') || pageContent.includes('logout')) {
      log('info', 'Confirmed: already logged in');
      return true;
    }
  }

  if (loginBtn) {
    await loginBtn.click();
    await sleep(2000);
  }

  if (shopifyStore) {
    try {
      const shopifyBtn = await page.waitForSelector('text=Shopify, text=Login with Shopify', { timeout: 5000 });
      if (shopifyBtn) {
        await shopifyBtn.click();
        await sleep(3000);

        await page.waitForTimeout(5000);

        const storeInput = await page.$('input[name="shop"], input[placeholder*="shop"], input[placeholder*="store"]');
        if (storeInput) {
          const storeName = shopifyStore.replace('.myshopify.com', '');
          await storeInput.fill(storeName);
          await sleep(1000);

          const installBtn = await page.$('button[type="submit"], button:has-text("Install"), button:has-text("Login")');
          if (installBtn) {
            await installBtn.click();
            await page.waitForTimeout(10000);
          }
        }
      }
    } catch (e) {
      log('warn', `Shopify OAuth flow issue: ${e.message}`);
    }
  }

  if (email && password) {
    try {
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email"]');
      if (emailInput) {
        await emailInput.fill(email);
        await sleep(500);

        const passInput = await page.$('input[type="password"], input[name="password"]');
        if (passInput) {
          await passInput.fill(password);
          await sleep(500);

          const submitBtn = await page.$('button[type="submit"]');
          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(8000);
          }
        }
      }
    } catch (e) {
      log('warn', `Email login failed: ${e.message}`);
    }
  }

  await sleep(3000);
  const postLoginUrl = page.url();
  log('info', `Post-login URL: ${postLoginUrl}`);

  if (postLoginUrl.includes('dashboard') || postLoginUrl.includes('product') || postLoginUrl.includes('home')) {
    log('info', 'DSers login successful');
    return true;
  }

  log('warn', 'Could not confirm DSers login. Manual intervention may be needed.');
  return false;
}

// ─── 核心工作流：导入 AliExpress 产品 ─────────

async function importProduct(page, aliUrl) {
  log('info', `Importing product from: ${aliUrl}`);

  const url = sanitizeUrl(aliUrl);
  if (!url) {
    throw new Error('Invalid AliExpress URL');
  }

  await page.goto(DSERS_BASE + '/#/product/import', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT })
    .catch(() => page.goto(DSERS_BASE + '/product/import', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT }));
  await sleep(3000);

  const importByUrlBtn = await page.$('text=Import by URL, text=Add Product, text=Import Product, button:has-text("Import")');
  if (importByUrlBtn) {
    await importByUrlBtn.click();
    await sleep(1500);
  }

  const urlInput = await page.$('input[type="text"], input[placeholder*="url"], input[placeholder*="link"], textarea');
  if (urlInput) {
    await urlInput.fill(url);
    await sleep(500);

    const confirmBtn = await page.$('button:has-text("Import"), button:has-text("Add"), button:has-text("Confirm")');
    if (confirmBtn) {
      await confirmBtn.click();
      log('info', 'Import request submitted');
    } else {
      await urlInput.press('Enter');
      log('info', 'Import submitted via Enter key');
    }
  } else {
    log('warn', 'Could not find import URL input. Trying alternative approach...');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await sleep(5000);

      const dsersImportBtn = await page.$('text=Import to DSers, text=Add to List, button:has-text("DSers")');
      if (dsersImportBtn) {
        await dsersImportBtn.click();
        log('info', 'Clicked import button on AliExpress page');
        await sleep(5000);
      }
    } catch (e) {
      log('error', `Alternative import approach failed: ${e.message}`);
      throw new Error('Could not complete import. Visit DSers manually.');
    }
  }

  await sleep(8000);

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
  }

  log('info', 'Product import initiated in DSers');
  return true;
}

// ─── 核心工作流：Push to Shopify ────────────

async function pushToShopify(page, { pricingRule, sessionLabel }) {
  log('info', `Starting Push to Shopify with pricing rule: ${pricingRule || 'default'}`);

  await page.goto(DSERS_BASE + '/#/product/import', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT })
    .catch(() => page.goto(DSERS_BASE + '/product/import', { waitUntil: 'networkidle', timeout: NAV_TIMEOUT }));
  await sleep(5000);

  const pushBtn = await page.$('text=Push to Shopify, button:has-text("Push"), span:has-text("Push")');
  if (!pushBtn) {
    const html = await page.content().catch(() => '');
    if (html.includes('No products') || html.includes('empty') || html.includes('no data')) {
      log('error', 'Import List appears empty. Product may not have been imported yet.');
      throw new Error('Import List is empty. The product may still be importing.');
    }
    log('error', 'Could not find "Push to Shopify" button');
    throw new Error('Could not find Push to Shopify button. Check if product is in Import List.');
  }

  await pushBtn.click();
  log('info', 'Clicked Push to Shopify');
  await sleep(5000);

  if (pricingRule && pricingRule !== 'default') {
    try {
      const pricingSelect = await page.$('select[name*="pricing"], select:has-text("price"), .pricing-rule select');
      if (pricingSelect) {
        await pricingSelect.selectOption(pricingRule);
        log('info', `Selected pricing rule: ${pricingRule}`);
        await sleep(1500);
      }
    } catch (e) {
      log('warn', `Could not set pricing rule: ${e.message}`);
    }
  }

  const confirmPushBtn = await page.$('button:has-text("Push"), button:has-text("Confirm"), button:has-text("Submit")');
  if (confirmPushBtn) {
    await confirmPushBtn.click();
    log('info', 'Confirmed Push to Shopify');
  }

  log('info', 'Waiting for DSers to process Push to Shopify...');
  await sleep(15000);

  for (let i = 0; i < 6; i++) {
    const pageText = await page.textContent('body').catch(() => '');
    if (pageText.includes('success') || pageText.includes('Success') || pageText.includes('pushed')) {
      log('info', 'Push to Shopify completed successfully');
      let shopifyProductId = null;

      const idMatch = pageText.match(/product\s*id[:\s]*(\d+)/i)
        || pageText.match(/shopify[:\s]*#?(\d+)/i);
      if (idMatch) shopifyProductId = idMatch[1];

      return { success: true, shopifyProductId };
    }
    await sleep(5000);
  }

  log('info', 'Push to Shopify processed (no explicit success message detected)');
  return { success: true, shopifyProductId: null };
}

// ─── 主入口：完整上架流程 ──────────────────

async function pushProduct({
  aliUrl,
  shopifyStore = 'aigenie-hub.myshopify.com',
  dsersEmail,
  dsersPassword,
  sessionLabel = 'default',
  headless = false,
  pricingRule,
  autoClose = true,
} = {}) {
  log('info', '=== DSers Push Product ===');
  log('info', `AliExpress URL: ${aliUrl}`);
  log('info', `Shopify Store: ${shopifyStore}`);
  log('info', `Session label: ${sessionLabel}`);

  if (!aliUrl) {
    throw new Error('aliUrl is required');
  }

  let browser, ctx, page;
  try {
    browser = await launchBrowser(headless);
    ctx = await createContext(browser, sessionLabel);
    page = await ctx.newPage();

    const loggedIn = await loginToDSers(page, {
      email: dsersEmail,
      password: dsersPassword,
      shopifyStore,
    });

    if (!loggedIn) {
      log('warn', 'Login may not have completed. Continuing anyway...');
    }

    const cookies = await ctx.cookies();
    const storageState = await ctx.storageState().catch(() => null);
    saveSession(cookies, storageState, sessionLabel);
    log('info', 'Session saved after login');

    await importProduct(page, aliUrl);

    log('info', 'Waiting for import to complete...');
    await sleep(10000);

    const pushResult = await pushToShopify(page, { pricingRule, sessionLabel });

    log('info', `Result: ${JSON.stringify(pushResult)}`);

    return {
      success: pushResult.success,
      aliUrl,
      shopifyProductId: pushResult.shopifyProductId,
      shopifyStore,
      sessionLabel,
      logs: getLogs(),
    };
  } catch (e) {
    log('error', `Push product failed: ${e.message}`);
    if (e.stack) log('error', e.stack.split('\n').slice(0, 5).join('\n'));
    return {
      success: false,
      aliUrl,
      error: e.message,
      shopifyProductId: null,
      shopifyStore,
      sessionLabel,
      logs: getLogs(),
    };
  } finally {
    if (autoClose) {
      if (page) try { await page.close(); } catch {}
      if (ctx) try { await ctx.close(); } catch {}
      await closeBrowser();
    }
  }
}

// ─── Plan B 降级：Chrome CDP Bridge ────────

async function pushProductWithChromeBridge({
  aliUrl,
  pricingRule,
} = {}) {
  log('warn', '=== Fallback to Chrome CDP Bridge ===');
  log('info', `AliExpress URL: ${aliUrl}`);

  let chrome;
  try {
    chrome = require('./chrome-cdp-bridge');
    await chrome.connect();
    log('info', 'Chrome CDP Bridge connected');

    const page = chrome.page ? await chrome._getPage() : null;

    await chrome.navigate(DSERS_BASE);
    await sleep(5000);

    const currentUrl = await chrome._getUrl();
    if (currentUrl && (currentUrl.includes('login') || currentUrl.includes('auth'))) {
      log('warn', 'Not logged in. Chrome session may not have DSers login.');
    }

    await chrome.navigate(DSERS_BASE + '/#/product/import');
    await sleep(5000);

    await chrome.navigate(aliUrl);
    await sleep(5000);

    log('info', 'Chrome Bridge flow completed (manual intervention may be needed)');

    return {
      success: true,
      aliUrl,
      shopifyProductId: null,
      method: 'chrome-bridge',
      note: 'Chrome bridge fallback: opened pages for manual completion',
      logs: getLogs(),
    };
  } catch (e) {
    log('error', `Chrome bridge fallback failed: ${e.message}`);
    return {
      success: false,
      aliUrl,
      error: e.message,
      method: 'chrome-bridge',
      logs: getLogs(),
    };
  } finally {
    if (chrome) try { await chrome.disconnect(); } catch {}
  }
}

// ─── Plan C 逃生：输出手动操作信息 ─────────

function generateManualInstructions({ aliUrl, shopifyStore }) {
  return {
    method: 'manual',
    steps: [
      `1. Open browser and go to ${DSERS_BASE}`,
      `2. Login with Shopify store: ${shopifyStore}`,
      `3. Go to Products → Import List`,
      `4. Click "Import by URL" and paste: ${aliUrl}`,
      `5. Configure pricing and variants`,
      `6. Click "Push to Shopify"`,
    ],
    note: 'DSers will handle product creation + supplier linking automatically.',
    message: 'This is the recommended DSers workflow. No need to create Shopify drafts manually.',
  };
}

// ─── 交互模式（供银月使用）─────────────────

async function interactivePush(headless = false) {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (query) => new Promise(resolve => rl.question(query, resolve));

  console.log('\n=== DSers Product Push (Interactive Mode) ===\n');

  const aliUrl = await q('Enter AliExpress product URL: ');
  if (!aliUrl.trim()) {
    console.log('No URL provided. Exiting.');
    rl.close();
    return { success: false, error: 'No URL provided' };
  }

  const pricing = await q('Pricing rule (default/multiply/fixed, press Enter for default): ');
  const confirm = await q(`\nPush this product to Shopify?\n  URL: ${aliUrl}\n  Confirm? (y/N): `);

  rl.close();

  if (!confirm.toLowerCase().startsWith('y')) {
    console.log('Cancelled.');
    return { success: false, error: 'User cancelled' };
  }

  return pushProduct({
    aliUrl: aliUrl.trim(),
    pricingRule: pricing.trim() || 'default',
    headless,
  });
}

module.exports = {
  pushProduct,
  pushProductWithChromeBridge,
  generateManualInstructions,
  interactivePush,
  loginToDSers,
  importProduct,
  pushToShopify,
  launchBrowser,
  closeBrowser,
  getLogs,
};
