import { chromium } from 'playwright';

async function main() {
  // 直接启动浏览器（不依赖已经打开的 Chrome）
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();

  console.log('✅ 浏览器已启动');

  // 1. 打开 Shopify 登录页
  await page.goto('https://aigenie-hub.myshopify.com/admin');
  console.log('请手动登录 Shopify...');
  console.log('登录邮箱: alanlsl8208@gmail.com');
  console.log('登录完成后，按 Enter 键继续...');

  // 等待用户按 Enter
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });

  console.log('开始配置...');

  // 2. 设置店铺基本信息
  await page.goto('https://aigenie-hub.myshopify.com/admin/settings/general');
  await page.waitForTimeout(2000);

  const nameInput = page.locator('input[name="shop[name]"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('AIGenie Hub');
    console.log('✅ 店铺名称已设置');
  }

  const saveBtn = page.locator('button[type="submit"]:has-text("Save")');
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ 店铺设置已保存');
  }

  // 3. 创建 About Us 页面
  await page.goto('https://aigenie-hub.myshopify.com/admin/pages/new');
  await page.waitForTimeout(2000);

  const titleInput = page.locator('input[name="page[title]"]');
  if (await titleInput.isVisible()) {
    await titleInput.fill('About Us');
    console.log('✅ About Us 标题已填');
  }

  // 内容区域
  const editor = page.frameLocator('iframe.tox-edit-area__iframe').locator('body');
  if (await editor.isVisible()) {
    await editor.fill(`We're AIGenie Hub — and we believe the future of work shouldn't feel like work.

We hand-pick every product in our store to solve one problem: how to work smarter, not harder. From AI-enhanced desk setups to digital productivity tools that actually deliver, we're here to upgrade your workflow.

🧠 AI-Powered. Every product integrates with your AI workflow.
📦 Zero Inventory. We handle fulfillment, you get paid.
⚡ Instant Digital Delivery. Buy hardware, get software bonuses instantly.

Built for builders. Powered by AI. Shipped worldwide.`);
    console.log('✅ About Us 内容已填');
  }

  const savePageBtn = page.locator('button:has-text("Save")');
  if (await savePageBtn.isVisible()) {
    await savePageBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ About Us 页面已保存');
  }

  console.log('\n🎉 配置完成！');
  console.log('接下来请手动设置首页 Hero 文案：');
  console.log('  Online Store → Themes → Customize');
  console.log('  Hero Title: Your Desk. But Make It AI-Powered.');
  console.log('  Hero Subtitle: Smart gear + digital tools for the modern creator.');
  console.log('  CTA: Explore the Future →');

  await browser.close();
}

main().catch(err => {
  console.error('❌ 出错:', err.message);
  process.exit(1);
});
