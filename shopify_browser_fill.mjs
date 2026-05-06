import puppeteer from 'puppeteer';

const STORE_URL = 'https://admin.shopify.com/store/aigenie-hub';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== 启动浏览器连接 Shopify 后台 ===\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1280,900',
    ]
  });

  const page = await browser.newPage();
  
  console.log('1. 打开 Shopify 后台...');
  await page.goto(STORE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('   页面已加载，请在浏览器中登录 Shopify（如果未登录）');
  console.log('   登录后按 Enter 键继续...');

  // 等待用户手动登录
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });

  // 检查是否在 Shopify 后台
  const currentUrl = page.url();
  console.log(`   当前 URL: ${currentUrl}`);

  if (!currentUrl.includes('admin.shopify.com')) {
    console.log('   未检测到 Shopify 后台，尝试导航...');
    await page.goto(STORE_URL + '/settings/general', { waitUntil: 'networkidle2', timeout: 30000 });
  }

  // 导航到 General 设置
  console.log('\n2. 导航到 General 设置...');
  await page.goto(STORE_URL + '/settings/general', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);
  console.log('   页面标题:', await page.title());

  // 尝试填写店铺名称
  console.log('\n3. 填写店铺资料...');
  
  // 查找 Store name 输入框
  const storeNameInput = await page.$('input[name="name"], input[placeholder*="store"], input[id*="name"], input[aria-label*="Store"]');
  if (storeNameInput) {
    await storeNameInput.click({ clickCount: 3 });
    await storeNameInput.type('SilverMoon Bank', { delay: 50 });
    console.log('   ✅ 店铺名称已填写');
  } else {
    console.log('   ⚠️ 未找到店铺名称输入框');
  }

  // 查找邮箱输入框
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('hello@silvermoon.bank', { delay: 30 });
    console.log('   ✅ 邮箱已填写');
  }

  // 截图看看当前页面
  await page.screenshot({ path: 'shopify_general.png', fullPage: true });
  console.log('   📸 已截图保存到 shopify_general.png');

  console.log('\n=== 浏览器已就绪 ===');
  console.log('请在浏览器中手动完成以下操作：');
  console.log('1. 检查并保存 General 设置');
  console.log('2. 设置店铺地址');
  console.log('3. 配置品牌色（Online Store > Themes > Customize）');
  console.log('4. 关闭密码保护（Settings > Plan > 取消勾选 Password protect）');
  console.log('\n浏览器窗口保持打开，我在这里等你。');
}

main().catch(console.error);
