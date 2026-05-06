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

  // 导航到 General Settings
  await page.goto('https://admin.shopify.com/store/aigenie-hub/settings/general', {
    waitUntil: 'domcontentloaded', timeout: 60000
  });
  await sleep(12000);

  // 关闭弹窗
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await sleep(2000);

  // 获取所有 s-internal-* 组件的完整状态
  const fullState = await page.evaluate(() => {
    const results = {};

    // 1. 所有 s-internal-text-field
    const textFields = document.querySelectorAll('s-internal-text-field');
    results.textFields = Array.from(textFields).map((tf, i) => {
      const shadow = tf.shadowRoot;
      if (!shadow) return { index: i, noShadow: true };
      const input = shadow.querySelector('input');
      const label = shadow.querySelector('[class*="Label"], label, [class*="label"]');
      return {
        index: i,
        label: label?.textContent?.trim() || '',
        value: input?.value || '',
        placeholder: input?.placeholder || '',
        id: input?.id || ''
      };
    });

    // 2. 所有 s-internal-select
    const selects = document.querySelectorAll('s-internal-select');
    results.selects = Array.from(selects).map((sel, i) => {
      const shadow = sel.shadowRoot;
      if (!shadow) return { index: i, noShadow: true };
      const selectEl = shadow.querySelector('select');
      const label = shadow.querySelector('[class*="Label"], label, [class*="label"]');
      return {
        index: i,
        label: label?.textContent?.trim() || '',
        value: selectEl?.value || '',
        selectedText: selectEl?.selectedOptions?.[0]?.text || '',
        options: selectEl ? Array.from(selectEl.options).map(o => `${o.value}=${o.text}`) : []
      };
    });

    // 3. 所有 s-internal-text-area
    const textAreas = document.querySelectorAll('s-internal-text-area');
    results.textAreas = Array.from(textAreas).map((ta, i) => {
      const shadow = ta.shadowRoot;
      if (!shadow) return { index: i, noShadow: true };
      const textarea = shadow.querySelector('textarea');
      const label = shadow.querySelector('[class*="Label"], label, [class*="label"]');
      return {
        index: i,
        label: label?.textContent?.trim() || '',
        value: textarea?.value?.substring(0, 200) || ''
      };
    });

    // 4. 页面所有可见文本（找关键信息）
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const allTexts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (text && text.length > 3) allTexts.push(text);
    }
    results.visibleTexts = allTexts.filter(t => 
      t.includes('Store name') || t.includes('Customer support') ||
      t.includes('Email') || t.includes('Currency') ||
      t.includes('Timezone') || t.includes('Time zone') ||
      t.includes('Standard') || t.includes('Unit') ||
      t.includes('Weight') || t.includes('Backup') ||
      t.includes('AIGenie') || t.includes('support@') ||
      t.includes('MYR') || t.includes('USD') ||
      t.includes('Ringgit') || t.includes('Eastern') ||
      t.includes('Malaysia') || t.includes('America')
    );

    return results;
  });

  console.log('=== TextFields ===');
  fullState.textFields.forEach((f, i) => {
    console.log(`[${i}] label="${f.label}" value="${f.value}" placeholder="${f.placeholder}"`);
  });

  console.log('\n=== Selects ===');
  fullState.selects.forEach((s, i) => {
    console.log(`[${i}] label="${s.label}" value="${s.value}" selected="${s.selectedText}"`);
  });

  console.log('\n=== TextAreas ===');
  fullState.textAreas.forEach((t, i) => {
    console.log(`[${i}] label="${t.label}" value="${t.value}"`);
  });

  console.log('\n=== 关键文本 ===');
  fullState.visibleTexts.forEach(t => console.log(`  - ${t}`));

  await page.screenshot({ path: 'shopify_check.png', fullPage: true });
  console.log('\n📸 截图已保存');

  await browser.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
