import puppeteer from 'puppeteer';

const STORE_URL = 'https://admin.shopify.com/store/aigenie-hub/settings/general';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== 启动浏览器填店铺资料 ===\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();

  console.log('1. 打开 Shopify 后台...');
  await page.goto('https://admin.shopify.com/store/aigenie-hub', { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('   页面已加载');
  console.log('   请在浏览器中登录 Shopify（如果未登录）');
  console.log('   登录后按 Enter 键继续...');

  await new Promise(resolve => process.stdin.once('data', () => resolve()));

  // 导航到 General 设置
  console.log('\n2. 导航到 General 设置...');
  await page.goto(STORE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);

  // 获取页面所有输入框
  console.log('\n3. 扫描页面输入框...');
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input:not([type="hidden"])')).map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      placeholder: i.placeholder,
      value: i.value,
      ariaLabel: i.getAttribute('aria-label'),
      className: i.className?.slice(0, 60),
    }));
  });
  inputs.forEach((inp, idx) => {
    console.log(`   [${idx}] id="${inp.id}" name="${inp.name}" value="${(inp.value||'').slice(0, 40)}"`);
  });

  // 填写店铺名称
  console.log('\n4. 填写店铺资料...');
  let filled = 0;
  for (const inp of inputs) {
    if (inp.value === 'AIGenie Vision') {
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (el) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(el, 'SilverMoon Bank');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, inp.id);
      console.log('   ✅ 店铺名称 → SilverMoon Bank');
      filled++;
    }
    if (inp.value === 'upport@aigenievision.com') {
      await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (el) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(el, 'hello@silvermoon.bank');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, inp.id);
      console.log('   ✅ 联系邮箱 → hello@silvermoon.bank');
      filled++;
    }
  }

  if (filled === 0) {
    console.log('   ⚠️ 未找到匹配的输入框，可能页面结构不同');
    console.log('   请手动填写以下内容：');
    console.log('   - Store name: SilverMoon Bank');
    console.log('   - Customer email: hello@silvermoon.bank');
  }

  // 截图
  await page.screenshot({ path: 'shopify_filled.png', fullPage: true });
  console.log('\n   📸 已截图 (shopify_filled.png)');

  console.log('\n=== 浏览器已就绪 ===');
  console.log('请在浏览器中：');
  console.log('1. 检查填写的资料，点击 Save');
  console.log('2. 设置地址（Address）');
  console.log('3. 去 Settings > Plan 关闭密码保护');
  console.log('4. 去 Online Store > Themes > Customize 配置品牌色');
  console.log('\n浏览器窗口保持打开，填完告诉我。');
}

main().catch(console.error);
