const { chromium } = require('playwright-core');
const CHROME_USER_DATA = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';

const PLATFORMS = [
  { id: 'deepseek-web', name: 'DeepSeek', url: 'https://chat.deepseek.com' },
  { id: 'claude-web', name: 'Claude', url: 'https://claude.ai' },
  { id: 'chatgpt-web', name: 'ChatGPT', url: 'https://chatgpt.com' },
  { id: 'qwen-web', name: 'Qwen', url: 'https://chat.qwen.ai' },
  { id: 'kimi-web', name: 'Kimi', url: 'https://kimi.moonshot.cn' },
  { id: 'gemini-web', name: 'Gemini', url: 'https://gemini.google.com/app' },
  { id: 'grok-web', name: 'Grok', url: 'https://grok.com' },
  { id: 'doubao-web', name: 'Doubao', url: 'https://www.doubao.com/chat' },
  { id: 'glm-web', name: 'GLM', url: 'https://chatglm.cn' },
];

async function scanProfile(profileName) {
  console.log(`\n=== 扫描 ${profileName} ===`);
  let browser;
  try {
    browser = await chromium.launchPersistentContext(
      `${CHROME_USER_DATA}\\${profileName}`,
      { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    );
    let count = 0;
    for (const p of PLATFORMS) {
      try {
        const page = await browser.newPage();
        await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        const cookies = await page.context().cookies();
        const hasInput = await page.locator('textarea, [contenteditable="true"]').first().isVisible().catch(() => false);
        const hasLogin = await page.locator('input[type="email"], input[type="password"], button:has-text("Log in")').first().isVisible().catch(() => false);
        const loggedIn = hasInput || (!hasLogin && cookies.length > 3);
        if (loggedIn) count++;
        console.log(`  ${loggedIn ? '✅' : '❌'} ${p.name}`);
        await page.close();
      } catch (e) {
        console.log(`  ⚠️ ${p.name}: ${e.message.slice(0, 50)}`);
      }
    }
    await browser.close();
    return count;
  } catch (e) {
    console.log(`  ❌ 无法打开: ${e.message.slice(0, 60)}`);
    return -1;
  }
}

async function main() {
  const profiles = ['Profile 3', 'Profile 1', 'Profile 4', 'Default'];
  const results = [];
  for (const p of profiles) {
    const count = await scanProfile(p);
    if (count >= 0) results.push({ profile: p, count });
  }
  console.log('\n=== 汇总 ===');
  results.sort((a, b) => b.count - a.count);
  for (const r of results) {
    console.log(`  ${r.profile}: ${r.count}/9`);
  }
  if (results.length > 0) {
    console.log(`\n最佳 Profile: ${results[0].profile}`);
  }
}

main().catch(e => console.error('FATAL:', e.message));
