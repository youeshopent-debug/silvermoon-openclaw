const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME_USER_DATA = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';
const PROFILE = 'Profile 3';
const AUTH_OUT = path.join(__dirname, '..', 'zero_token_tokens_final.json');

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

async function main() {
  console.log(`打开 Chrome Profile 3 窗口，提取所有 AI 平台 Token...\n`);

  const browser = await chromium.launchPersistentContext(
    `${CHROME_USER_DATA}\\${PROFILE}`,
    {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1366,768',
      ],
    }
  );

  const results = {};

  for (const platform of PLATFORMS) {
    try {
      const page = await browser.newPage();
      await page.goto(platform.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const cookies = await page.context().cookies();
      const localStorage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          items[key] = localStorage.getItem(key);
        }
        return items;
      }).catch(() => ({}));
      const url = page.url();
      results[platform.id] = { cookies, localStorage, url };
      console.log(`  ✅ ${platform.name} - cookies: ${cookies.length}, localStorage: ${Object.keys(localStorage).length}`);
      await page.close();
    } catch (e) {
      console.log(`  ⚠️ ${platform.name}: ${e.message.slice(0, 80)}`);
      results[platform.id] = { error: e.message };
    }
  }

  fs.writeFileSync(AUTH_OUT, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✅ Token 已保存到: ${AUTH_OUT}`);
  console.log(`共提取 ${Object.keys(results).length} 个平台的数据`);
  console.log('\n浏览器窗口保持打开，按 Ctrl+C 关闭脚本和浏览器');
  await new Promise(() => {});
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
