import puppeteer from 'puppeteer';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
    protocolTimeout: 60000
  });

  const pages = await browser.pages();
  let page = pages.find(p => p.url().includes('shopify.com'));
  if (!page) page = await browser.newPage();

  // ===== 1. General Settings =====
  console.log('=== 1. General Settings ===');
  await page.goto('https://admin.shopify.com/store/aigenie-hub/settings/general', {
    waitUntil: 'domcontentloaded', timeout: 60000
  });
  await sleep(12000);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await sleep(2000);

  // 设置 Backup Region
  console.log('设置 Backup Region → US...');
  const r1 = await page.evaluate(() => {
    const selects = document.querySelectorAll('s-internal-select');
    for (const sel of selects) {
      const shadow = sel.shadowRoot;
      if (!shadow) continue;
      const label = shadow.querySelector('[class*="Label"], label, [class*="label"]');
      if (label?.textContent?.trim() === 'Backup Region') {
        const selectEl = shadow.querySelector('select');
        if (selectEl) {
          selectEl.value = 'US';
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          selectEl.dispatchEvent(new Event('input', { bubbles: true }));
          return { found: true, newValue: selectEl.value, selectedText: selectEl.selectedOptions?.[0]?.text };
        }
      }
    }
    return { found: false };
  });
  console.log('  Backup Region:', JSON.stringify(r1));

  // 点击 Save
  console.log('点击 Save...');
  const save1 = await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.textContent?.trim().toLowerCase() === 'save') {
        btn.click();
        return { clicked: true, text: btn.textContent?.trim() };
      }
    }
    return { clicked: false };
  });
  console.log('  Save:', JSON.stringify(save1));

  if (save1.clicked) {
    await sleep(4000);
    const toast = await page.evaluate(() => {
      const els = document.querySelectorAll('[role="status"], [aria-live="polite"]');
      return Array.from(els).map(e => e.textContent?.trim()).filter(Boolean);
    });
    console.log('  Toast:', toast);
  }

  // ===== 2. Store details（店铺名称和邮箱可能在 Store details 页面）=====
  console.log('\n=== 2. Store Details ===');
  await page.goto('https://admin.shopify.com/store/aigenie-hub/settings/store', {
    waitUntil: 'domcontentloaded', timeout: 60000
  });
  await sleep(10000);
  console.log('URL:', page.url());

  // 获取页面文本
  const storeText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text && text.length > 2) texts.push(text);
    }
    return texts.join('\n').substring(0, 3000);
  });
  console.log('Store page text:', storeText.substring(0, 1000));

  // ===== 3. 尝试通过 Shopify API 直接更新 =====
  console.log('\n=== 3. 尝试通过 Shopify API 更新 ===');
  const apiResult = await page.evaluate(async () => {
    const results = {};
    const script = document.querySelector('script[data-serialized-id="server-data"]');
    let csrf = '';
    if (script) {
      try { csrf = JSON.parse(script.textContent).csrfToken || ''; } catch {}
    }

    // 尝试获取店铺信息
    try {
      const resp = await fetch('/admin/shop.json', {
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrf }
      });
      const text = await resp.text();
      results.shopGet = { status: resp.status, body: text.substring(0, 1000) };
    } catch (e) {
      results.shopGet = { error: e.message };
    }

    // 尝试 GraphQL
    try {
      const resp = await fetch('/admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({
          query: `{ shop { name email myshopifyDomain currency } }`
        })
      });
      const text = await resp.text();
      results.graphql = { status: resp.status, body: text.substring(0, 1000) };
    } catch (e) {
      results.graphql = { error: e.message };
    }

    return results;
  });
  console.log(JSON.stringify(apiResult, null, 2));

  await page.screenshot({ path: 'shopify_final_check.png', fullPage: true });
  console.log('\n📸 截图已保存');

  await browser.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
