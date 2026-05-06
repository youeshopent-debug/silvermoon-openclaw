import puppeteer from 'puppeteer';

const STORE_URL = 'https://admin.shopify.com/store/aigenie-hub/settings/general';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function findInput(page, patterns) {
  for (const p of patterns) {
    const el = await page.$(p);
    if (el) return el;
  }
  return null;
}

async function main() {
  console.log('=== 连接你的 Chrome 浏览器 ===\n');

  // 先找 Chrome 调试端口
  // 尝试常见端口
  let browser = null;
  for (const port of [9222, 9223, 9224, 9221, 9220]) {
    try {
      browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${port}`,
        defaultViewport: null,
      });
      console.log(`✅ 已连接到 Chrome (端口 ${port})`);
      break;
    } catch (e) {
      // 继续尝试
    }
  }

  if (!browser) {
    console.log('❌ 未找到 Chrome 调试端口');
    console.log('\n主人，请按以下步骤操作：');
    console.log('1. 关掉所有 Chrome 窗口');
    console.log('2. 按 Win+R，输入:');
    console.log('   chrome.exe --remote-debugging-port=9222');
    console.log('3. 打开 Shopify 后台并登录');
    console.log('4. 告诉我"好了"');
    return;
  }

  // 获取所有页面
  const pages = await browser.pages();
  console.log(`   当前标签页: ${pages.length} 个`);

  // 找 Shopify 后台页面
  let shopifyPage = null;
  for (const p of pages) {
    const url = p.url();
    if (url.includes('admin.shopify.com') || url.includes('shopify.com/admin')) {
      shopifyPage = p;
      console.log(`   ✅ 找到 Shopify 后台: ${url.slice(0, 80)}`);
      break;
    }
  }

  if (!shopifyPage) {
    console.log('   ⚠️ 未找到 Shopify 后台页面');
    console.log('   请在浏览器中打开 Shopify 后台并告诉我');
    await browser.disconnect();
    return;
  }

  // 导航到 General 设置
  console.log('\n1. 导航到 General 设置...');
  await shopifyPage.goto(STORE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);
  console.log(`   当前页面: ${shopifyPage.url()}`);

  // 截图看看页面
  await shopifyPage.screenshot({ path: 'shopify_before.png', fullPage: true });
  console.log('   📸 已截图 (shopify_before.png)');

  // 尝试填写店铺名称
  console.log('\n2. 尝试填写店铺资料...');
  
  // Shopify Polaris 组件用 label + input 结构
  // 尝试多种选择器
  const selectors = {
    name: [
      'input[name="name"]',
      'input[id*="name"]',
      'input[aria-label*="Store"]',
      'input[placeholder*="store"]',
      'input:not([type="hidden"])',
    ],
    email: [
      'input[type="email"]',
      'input[name="email"]',
      'input[id*="email"]',
      'input[aria-label*="Email"]',
    ],
  };

  // 获取页面所有 input 看看结构
  const inputs = await shopifyPage.evaluate(() => {
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
  console.log('   页面输入框:');
  inputs.forEach((inp, idx) => {
    console.log(`   [${idx}] id="${inp.id}" name="${inp.name}" value="${inp.value?.slice(0, 30)}" placeholder="${inp.placeholder}"`);
  });

  // 尝试填写
  for (const inp of inputs) {
    if (inp.value === 'AIGenie Vision') {
      console.log(`\n   🔍 找到店铺名称输入框 [${inp.id || inp.name}]`);
      try {
        await shopifyPage.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.value = '';
            el.value = 'SilverMoon Bank';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, inp.id);
        console.log('   ✅ 店铺名称已改为 SilverMoon Bank');
      } catch (e) {
        console.log('   ⚠️ 填写失败:', e.message);
      }
    }
    if (inp.value === 'upport@aigenievision.com') {
      console.log(`\n   🔍 找到邮箱输入框 [${inp.id || inp.name}]`);
      try {
        await shopifyPage.evaluate((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.value = '';
            el.value = 'hello@silvermoon.bank';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, inp.id);
        console.log('   ✅ 邮箱已改为 hello@silvermoon.bank');
      } catch (e) {
        console.log('   ⚠️ 填写失败:', e.message);
      }
    }
  }

  // 截图看看填写后
  await shopifyPage.screenshot({ path: 'shopify_after.png', fullPage: true });
  console.log('\n   📸 已截图 (shopify_after.png)');

  // 找 Save 按钮
  console.log('\n3. 查找 Save 按钮...');
  const saveBtn = await shopifyPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const save = btns.find(b => b.textContent.toLowerCase().includes('save'));
    return save ? { text: save.textContent, id: save.id } : null;
  });
  if (saveBtn) {
    console.log(`   ✅ 找到 Save 按钮: "${saveBtn.text}"`);
    console.log('   请在浏览器中手动点击 Save 保存更改');
  } else {
    console.log('   ⚠️ 未找到 Save 按钮（可能 Polaris 自动保存）');
  }

  console.log('\n=== 完成 ===');
  console.log('浏览器窗口已就绪，请在浏览器中：');
  console.log('1. 检查填写的资料是否正确');
  console.log('2. 点击 Save 保存');
  console.log('3. 然后去 Settings > Plan 关闭密码保护');
  console.log('4. 去 Online Store > Themes > Customize 配置品牌色');

  await browser.disconnect();
}

main().catch(console.error);
