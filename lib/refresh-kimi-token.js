const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME_USER_DATA = 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';
const PROFILE = 'Profile 3';
const AUTH_FILE = path.join(process.env.USERPROFILE || 'C:\\Users\\User', '.openclaw', 'auth-profiles.json');

async function main() {
  console.log('打开 Chrome Profile 3，提取 Kimi Token...\n');

  const browser = await chromium.launchPersistentContext(
    `${CHROME_USER_DATA}\\${PROFILE}`,
    { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  );

  const page = await browser.newPage();
  await page.goto('https://kimi.moonshot.cn', { waitUntil: 'domcontentloaded', timeout: 30000 });
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

  const kimiCookies = cookies.filter(c => c.domain.includes('kimi'));
  const authCookie = kimiCookies.find(x => x.name === 'kimi-auth' || x.name.toLowerCase().includes('auth'));
  const cookieStr = kimiCookies.map(c => `${c.name}=${c.value}`).join('; ');

  console.log(`  Kimi cookies: ${kimiCookies.length}`);
  console.log(`  kimi-auth: ${authCookie ? authCookie.value.slice(0, 40) + '...' : 'NOT FOUND'}`);

  if (!authCookie) {
    console.log('\n❌ kimi-auth cookie 未找到，请确认已登录 kimi.moonshot.cn');
    await browser.close();
    return;
  }

  const token = {
    accessToken: authCookie.value,
    cookie: cookieStr,
    localStorage: localStorage,
  };

  const authProfiles = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  authProfiles.profiles['kimi-web:default'] = {
    token: JSON.stringify(token),
    createdAt: new Date().toISOString(),
    source: 'chrome-profile3-refresh',
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authProfiles, null, 2), 'utf8');

  console.log(`\n✅ Kimi auth profile 已更新`);
  console.log(`   accessToken: ${token.accessToken.slice(0, 40)}...`);

  await browser.close();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
