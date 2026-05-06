/**
 * chrome-cdp-bridge.js — Chrome CDP 桥接核心
 *
 * 通过 Chrome DevTools Protocol 直连已运行的 Chrome，
 * 让 TRAE + Openclaw 所有 Agent 共享登录态浏览器操作能力。
 *
 * 依赖：puppeteer (已在 package.json)
 *
 * 用法：
 *   const chrome = require('./chrome-cdp-bridge');
 *   await chrome.connect();
 *   await chrome.navigate('https://app.shanjian.tv');
 *   await chrome.screenshot('flashshow_home');
 *   await chrome.disconnect();
 */

'use strict';

const http = require('http');
const puppeteer = require('puppeteer');

const CDP_PORT = 9222;
const CDP_HOST = '127.0.0.1';
const CONNECT_TIMEOUT = 10_000;
const NAV_TIMEOUT = 30_000;

let _browser = null;
let _page = null;
let _targetId = null;

function _fetchJSON(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs || CONNECT_TIMEOUT }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`parse failed: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function discoverCDPEndpoint() {
  const jsonUrl = `http://${CDP_HOST}:${CDP_PORT}/json/version`;
  const info = await _fetchJSON(jsonUrl, 5000);
  if (!info.webSocketDebuggerUrl) {
    throw new Error('CDP endpoint not found — is Chrome running with --remote-debugging-port=9222?');
  }
  return info.webSocketDebuggerUrl;
}

async function listTargets() {
  const jsonUrl = `http://${CDP_HOST}:${CDP_PORT}/json`;
  return _fetchJSON(jsonUrl, 5000);
}

async function connect(targetUrl) {
  if (_browser) {
    try { await _browser.pages(); return; }
    catch { _browser = null; _page = null; }
  }

  const wsEndpoint = await discoverCDPEndpoint();
  _browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null,
  });

  const pages = await _browser.pages();
  if (targetUrl) {
    _page = pages.find((p) => p.url().includes(targetUrl)) || pages[0];
  } else {
    _page = pages[0] || (await _browser.newPage());
  }

  const target = _browser.target();
  _targetId = target._targetId || null;
  return { ok: true, tabs: pages.length };
}

async function disconnect() {
  if (_browser) {
    try { await _browser.disconnect(); }
    catch {}
    _browser = null;
    _page = null;
    _targetId = null;
  }
}

async function ensureConnected() {
  if (!_browser) {
    await connect();
  }
}

async function navigate(url) {
  await ensureConnected();
  await _page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  return { url: _page.url(), title: await _page.title() };
}

async function click(selector) {
  await ensureConnected();
  await _page.waitForSelector(selector, { timeout: 10000 });
  await _page.click(selector);
  return { ok: true, selector };
}

async function fill(selector, value) {
  await ensureConnected();
  await _page.waitForSelector(selector, { timeout: 10000 });
  await _page.click(selector, { clickCount: 3 });
  await _page.keyboard.press('Backspace');
  await _page.type(selector, String(value));
  return { ok: true, selector, value: String(value).substring(0, 40) };
}

async function typeText(selector, value) {
  await ensureConnected();
  if (selector) {
    await _page.waitForSelector(selector, { timeout: 10000 });
    await _page.click(selector);
  }
  await _page.keyboard.type(String(value));
  return { ok: true };
}

async function pressKey(key) {
  await ensureConnected();
  await _page.keyboard.press(key);
  return { ok: true, key };
}

async function screenshot(name) {
  await ensureConnected();
  const buf = await _page.screenshot({ type: 'png', fullPage: false });
  return { buffer: buf, name: name || `chrome_${Date.now()}` };
}

async function evaluate(script) {
  await ensureConnected();
  const result = await _page.evaluate(script);
  return result;
}

async function getCookies() {
  await ensureConnected();
  const cookies = await _page.cookies();
  const client = await _browser.target().createCDPSession();
  const { localStorage } = await client.send('DOMStorage.getDOMStorageItems', {
    storageId: { storageKey: _page.url(), isLocalStorage: true },
  }).catch(() => ({ localStorage: [] }));
  return {
    cookies: cookies.map((c) => ({ name: c.name, value: c.value.substring(0, 20) + '...', domain: c.domain })),
    cookieCount: cookies.length,
    localStorageCount: localStorage.length,
  };
}

async function getPageInfo() {
  await ensureConnected();
  return {
    url: _page.url(),
    title: await _page.title(),
    tabIndex: _targetId,
  };
}

async function switchTab(indexOrUrl) {
  await ensureConnected();
  const pages = await _browser.pages();
  let target;
  if (typeof indexOrUrl === 'number') {
    target = pages[indexOrUrl];
  } else {
    target = pages.find((p) => p.url().includes(indexOrUrl)) || pages[0];
  }
  if (target) {
    _page = target;
    await _page.bringToFront();
    return { ok: true, url: _page.url(), title: await _page.title() };
  }
  throw new Error(`tab not found: ${indexOrUrl}`);
}

async function listTabs() {
  await ensureConnected();
  const pages = await _browser.pages();
  return pages.map((p, i) => ({
    index: i,
    url: p.url().substring(0, 100),
    title: p.title().substring(0, 60),
  }));
}

async function waitForSelector(selector, timeoutMs) {
  await ensureConnected();
  await _page.waitForSelector(selector, { timeout: timeoutMs || 10000 });
  return { ok: true };
}

async function waitForTimeout(ms) {
  await ensureConnected();
  await _page.waitForTimeout(ms);
  return { ok: true };
}

async function getVisibleText() {
  await ensureConnected();
  const text = await _page.evaluate(() => document.body?.innerText || '');
  return text.substring(0, 5000);
}

async function getHTML(selector) {
  await ensureConnected();
  if (selector) {
    const el = await _page.$(selector);
    if (!el) return null;
    return _page.evaluate((e) => e.outerHTML, el);
  }
  return _page.content();
}

module.exports = {
  connect,
  disconnect,
  ensureConnected,
  discoverCDPEndpoint,
  listTargets,
  navigate,
  click,
  fill,
  typeText,
  pressKey,
  screenshot,
  evaluate,
  getCookies,
  getPageInfo,
  switchTab,
  listTabs,
  waitForSelector,
  waitForTimeout,
  getVisibleText,
  getHTML,
};
