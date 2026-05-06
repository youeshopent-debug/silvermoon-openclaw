const { chromium } = require('playwright-core');
const CHROME_USER_DATA = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';

const TARGETS = [
  { id: 'deepseek-web', name: 'DeepSeek', url: 'https://chat.deepseek.com' },
  { id: 'claude-web', name: 'Claude', url: 'https://claude.ai' },
  { id: 'chatgpt-web', name: 'ChatGPT', url: 'https://chatgpt.com' },
];

async function main() {
  const browser = await chromium.launchPersistentContext(
    `${CHROME_USER_DATA}\\Default`,
    { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  );

  for (const t of TARGETS) {
    console.log(`\n=== ${t.name} ===`);
    const page = await browser.newPage();
    try {
      await page.goto(t.url, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(3000);
      const cookies = await page.context().cookies();
      const title = await page.title().catch(() => 'N/A');
      const url = page.url();
      console.log(`  URL: ${url}`);
      console.log(`  Title: ${title}`);
      console.log(`  Cookies: ${cookies.length}`);
      const sessionCookies = cookies.filter(c =>
        /session|token|auth|sid|login|access|refresh/i.test(c.name)
      );
      for (const sc of sessionCookies) {
        console.log(`  🍪 ${sc.name}: ${sc.value.slice(0, 40)}... (domain: ${sc.domain})`);
      }
      const hasLoginUI = await page.locator('input[type="email"], input[type="password"], button:has-text("Log in"), button:has-text("Sign in"), a:has-text("Log in"), a:has-text("Sign in")').first().isVisible().catch(() => false);
      console.log(`  登录表单可见: ${hasLoginUI}`);
      const hasChatInput = await page.locator('textarea, [contenteditable="true"]').first().isVisible().catch(() => false);
      console.log(`  聊天输入框可见: ${hasChatInput}`);
      if (hasChatInput) {
        console.log(`  ✅ ${t.name} 已登录！`);
      } else if (!hasLoginUI) {
        console.log(`  ⚠️ ${t.name} 可能已登录（无登录表单，但聊天框未出现）`);
      } else {
        console.log(`  ❌ ${t.name} 需要登录`);
      }
    } catch (e) {
      console.log(`  ❌ 错误: ${e.message.slice(0, 100)}`);
    }
    await page.close();
  }
  await browser.close();
}

main().catch(e => console.error('FATAL:', e.message));
