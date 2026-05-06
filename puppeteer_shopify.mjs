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

  // 导航到 Settings General
  await page.goto('https://admin.shopify.com/store/aigenie-hub/settings/general', {
    waitUntil: 'networkidle0', timeout: 60000
  });
  await sleep(5000);

  // 获取 CSRF token
  const csrfToken = await page.evaluate(() => {
    const script = document.querySelector('script[data-serialized-id="server-data"]');
    if (!script) return '';
    try { return JSON.parse(script.textContent).csrfToken || ''; }
    catch { return ''; }
  });
  console.log('CSRF token:', csrfToken);

  // 尝试通过 Shopify 的 Admin API 获取更多设置
  // 先获取 GeneralSettingsLoader 的数据
  const generalData = await page.evaluate(async (token) => {
    const results = {};

    // 尝试不同的 loader hash
    const loaders = [
      { name: 'GeneralSettingsLoader', hash: 'GeneralSettingsLoader' },
      { name: 'ShopGeneralSettings', hash: 'ShopGeneralSettings' },
      { name: 'ShopSettings', hash: 'ShopSettings' }
    ];

    for (const loader of loaders) {
      try {
        const resp = await fetch(`/api/operations/${loader.hash}/shopify/aigenie-hub`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-Token': token
          },
          body: JSON.stringify({
            operationName: loader.name,
            variables: {},
            extensions: {
              client_context: {
                client_route_handle: 'settings:general',
                client_pathname: '/store/aigenie-hub/settings/general'
              }
            }
          })
        });
        results[loader.name] = {
          status: resp.status,
          data: await resp.json()
        };
      } catch (e) {
        results[loader.name] = { error: e.message };
      }
    }

    return results;
  }, csrfToken);
  console.log('\nGeneral settings data:', JSON.stringify(generalData, null, 2).substring(0, 3000));

  // 尝试通过 Shopify 的 Preferences API 获取货币和时区设置
  const preferencesData = await page.evaluate(async (token) => {
    try {
      const resp = await fetch('/admin/shop_preferences.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': token
        }
      });
      return {
        status: resp.status,
        body: (await resp.text()).substring(0, 2000)
      };
    } catch (e) {
      return { error: e.message };
    }
  }, csrfToken);
  console.log('\nPreferences:', JSON.stringify(preferencesData, null, 2));

  // 尝试通过 Shopify 的 Settings API 获取货币设置
  const currencyData = await page.evaluate(async (token) => {
    try {
      const resp = await fetch('/admin/settings/currency.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Token': token
        }
      });
      return {
        status: resp.status,
        body: (await resp.text()).substring(0, 2000)
      };
    } catch (e) {
      return { error: e.message };
    }
  }, csrfToken);
  console.log('\nCurrency:', JSON.stringify(currencyData, null, 2));

  await browser.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
