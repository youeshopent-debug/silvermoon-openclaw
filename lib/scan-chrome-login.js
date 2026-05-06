const { chromium } = require('playwright-core');

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

const CHROME_USER_DATA = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';

async function scanAllProfiles() {
  const profiles = ['Default', 'Profile 1', 'Profile 3', 'Profile 4'];
  const allResults = [];

  for (const profile of profiles) {
    console.log(`\n=== 扫描 Profile: ${profile} ===`);
    let browser;
    try {
      browser = await chromium.launchPersistentContext(
        `${CHROME_USER_DATA}\\${profile}`,
        {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        }
      );
      const results = [];
      for (const platform of PLATFORMS) {
        try {
          const page = await browser.newPage();
          await page.goto(platform.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(2000);
          const cookies = await page.context().cookies();
          const hasSession = cookies.some(c =>
            c.name.toLowerCase().includes('session') ||
            c.name.toLowerCase().includes('token') ||
            c.name.toLowerCase().includes('auth') ||
            c.name.toLowerCase().includes('sid') ||
            c.name.toLowerCase().includes('login')
          );
          const url = page.url();
          const isLoggedIn = hasSession && !url.includes('login') && !url.includes('signin') && !url.includes('auth');
          results.push({ platform: platform.id, name: platform.name, loggedIn: isLoggedIn, cookieCount: cookies.length });
          console.log(`  ${isLoggedIn ? '✅' : '❌'} ${platform.name} (cookies: ${cookies.length})`);
          await page.close();
        } catch (e) {
          results.push({ platform: platform.id, name: platform.name, loggedIn: false, error: e.message });
          console.log(`  ⚠️ ${platform.name} 扫描失败: ${e.message.slice(0, 60)}`);
        }
      }
      allResults.push({ profile, results });
      await browser.close();
    } catch (e) {
      console.log(`  ⚠️ 无法打开 Profile ${profile}: ${e.message.slice(0, 80)}`);
    }
  }
  return allResults;
}

async function extractTokensFromProfile(profileName) {
  console.log(`\n=== 从 ${profileName} 提取 Token ===`);
  let browser;
  const tokens = {};
  try {
    browser = await chromium.launchPersistentContext(
      `${CHROME_USER_DATA}\\${profileName}`,
      {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      }
    );
    for (const platform of PLATFORMS) {
      try {
        const page = await browser.newPage();
        await page.goto(platform.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
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
        const sessionStorage = await page.evaluate(() => {
          const items = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            items[key] = sessionStorage.getItem(key);
          }
          return items;
        }).catch(() => ({}));
        tokens[platform.id] = {
          cookies,
          localStorage,
          sessionStorage,
          url: page.url(),
        };
        console.log(`  ✅ ${platform.name} - cookies: ${cookies.length}, localStorage: ${Object.keys(localStorage).length}`);
        await page.close();
      } catch (e) {
        console.log(`  ⚠️ ${platform.name}: ${e.message.slice(0, 60)}`);
        tokens[platform.id] = { error: e.message };
      }
    }
    await browser.close();
  } catch (e) {
    console.log(`  ❌ 无法打开 Profile: ${e.message}`);
  }
  return tokens;
}

async function main() {
  const action = process.argv[2] || 'scan';
  if (action === 'scan') {
    console.log('扫描本机 Chrome 所有 Profile 的 AI 平台登录状态...\n');
    const results = await scanAllProfiles();
    console.log('\n=== 汇总 ===');
    for (const { profile, results: r } of results) {
      const loggedIn = r.filter(x => x.loggedIn).length;
      console.log(`Profile ${profile}: ${loggedIn}/${r.length} 已登录`);
    }
    const bestProfile = results
      .map(({ profile, results: r }) => ({ profile, count: r.filter(x => x.loggedIn).length }))
      .sort((a, b) => b.count - a.count)[0];
    if (bestProfile && bestProfile.count > 0) {
      console.log(`\n最佳 Profile: ${bestProfile.profile} (${bestProfile.count} 个平台已登录)`);
      console.log(`提取 Token 命令: node lib/scan-chrome-login.js extract ${bestProfile.profile}`);
    }
  } else if (action === 'extract') {
    const profile = process.argv[3] || 'Default';
    const tokens = await extractTokensFromProfile(profile);
    const outPath = `C:\\Users\\User\\.openclaw\\zero_token_tokens.json`;
    require('fs').writeFileSync(outPath, JSON.stringify(tokens, null, 2), 'utf8');
    console.log(`\n✅ Token 已保存到: ${outPath}`);
    console.log(`共提取 ${Object.keys(tokens).length} 个平台的数据`);
  }
}

if (require.main === module) main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
module.exports = { scanAllProfiles, extractTokensFromProfile };
