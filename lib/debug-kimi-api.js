const { chromium } = require('playwright-core');
const CHROME_USER_DATA = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';

async function main() {
  const browser = await chromium.launchPersistentContext(
    `${CHROME_USER_DATA}\\Profile 3`,
    { headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768'] }
  );

  const page = await browser.newPage();

  // 拦截 Kimi 的 API 请求
  const apiCalls = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('kimi') && url.includes('/api/')) {
      apiCalls.push({
        url: url,
        method: req.method(),
        headers: req.headers(),
        postData: req.postData()?.slice(0, 500),
      });
    }
  });

  await page.goto('https://kimi.moonshot.cn', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 尝试发送一条消息触发 API 调用
  const input = await page.locator('textarea, [contenteditable="true"]').first();
  if (await input.isVisible()) {
    await input.fill('Say hello');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);
  }

  console.log('\n=== 捕获的 API 请求 ===');
  for (const call of apiCalls) {
    console.log(`\nURL: ${call.url}`);
    console.log(`Method: ${call.method}`);
    console.log(`Headers:`, JSON.stringify(call.headers, null, 2).slice(0, 500));
    if (call.postData) console.log(`Body: ${call.postData}`);
  }

  if (apiCalls.length === 0) {
    console.log('未捕获到 API 请求，尝试直接读取页面网络日志...');
    const perfEntries = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(e => e.name.includes('/api/'))
        .map(e => ({ name: e.name, initiatorType: e.initiatorType }));
    }).catch(() => []);
    console.log('Performance entries:', perfEntries);
  }

  console.log('\n浏览器保持打开，按 Ctrl+C 退出');
  await new Promise(() => {});
}

main().catch(e => console.error('FATAL:', e.message));
