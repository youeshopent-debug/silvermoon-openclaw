import { chromium } from 'playwright';

const SHOP = 'https://aigenie-hub.myshopify.com/admin';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('='.repeat(50));
  console.log('  银月钱庄 · Shopify 店铺自动配置');
  console.log('  模式: 无头（不弹窗）');
  console.log('='.repeat(50));

  // ── 登录 ──
  await page.goto(SHOP, { waitUntil: 'networkidle' });
  console.log('\n📌 请在 Trae 浏览器中登录 Shopify（邮箱: alanlsl8208@gmail.com）');
  console.log('   登录完成后，按 Enter 键继续...');
  await new Promise(r => process.stdin.once('data', () => r()));

  // ── 通用设置 ──
  console.log('\n--- 设置通用信息 ---');
  await page.goto(`${SHOP}/settings/general`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const nameInput = page.locator('input[name="shop[name]"]');
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nameInput.fill('');
    await nameInput.fill('AIGenie Vision');
    console.log('  ✅ 店铺名称 → AIGenie Vision');
  }

  const saveBtn = page.locator('button[type="submit"]:has-text("Save")');
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    console.log('  ✅ 通用设置已保存');
  }

  // ── 货币 ──
  console.log('\n--- 设置结算货币 USD ---');
  await page.goto(`${SHOP}/settings/general`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const currencySel = page.locator('select[name="shop[currency]"]');
  if (await currencySel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await currencySel.selectOption('USD');
    console.log('  ✅ 结算货币 → USD');
  } else {
    console.log('  ⚠️ 未找到货币下拉框');
  }

  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }

  // ── 时区 ──
  console.log('\n--- 设置时区 EST ---');
  const tzSel = page.locator('select[name="shop[timezone]"]');
  if (await tzSel.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tzSel.selectOption('(GMT-05:00) Eastern Time (US & Canada)');
    console.log('  ✅ 时区 → EST');
  } else {
    console.log('  ⚠️ 未找到时区下拉框');
  }

  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }

  // ── 目标市场 ──
  console.log('\n--- 设置目标市场 ---');
  await page.goto(`${SHOP}/settings/markets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const addBtn = page.locator('button:has-text("Add market"), a:has-text("Add market")');
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBtn.click();
    await page.waitForTimeout(1000);
    for (const country of ['United States', 'Canada', 'United Kingdom', 'Germany', 'France']) {
      const cb = page.locator(`text=${country}`).first();
      if (await cb.isVisible({ timeout: 1000 }).catch(() => false)) await cb.click();
    }
    console.log('  ✅ 已添加目标市场：美国、加拿大、英国、德国、法国');
    const confirm = page.locator('button:has-text("Add"), button:has-text("Save")').first();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
    await page.waitForTimeout(1500);
  } else {
    console.log('  ⚠️ 未找到市场设置按钮');
  }

  // ── 客服邮箱 ──
  console.log('\n--- 设置客服邮箱 ---');
  await page.goto(`${SHOP}/settings/general`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const emailInput = page.locator('input[name="shop[email]"]');
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('');
    await emailInput.fill('support@aigenievision.com');
    console.log('  ✅ 客服邮箱 → support@aigenievision.com');
  }

  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }

  // ── About Us ──
  console.log('\n--- 创建 About Us 页面 ---');
  await page.goto(`${SHOP}/pages/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const titleInput = page.locator('input[name="page[title]"]');
  if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await titleInput.fill('About AIGenie Vision');
    console.log('  ✅ 页面标题 → About AIGenie Vision');
  }

  const editorFrame = page.frameLocator('iframe.tox-edit-area__iframe').first();
  const editorBody = editorFrame.locator('body');
  if (await editorBody.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editorBody.fill('');
    await editorBody.fill(`Welcome to AIGenie Vision, where cutting-edge technology meets everyday lifestyle.

We believe that language should never be a barrier to human connection. Born from a passion for innovation, AIGenie Vision specializes in next-generation AI Smart Glasses designed to seamlessly translate the world around you in real-time. Whether you are traveling the globe, conducting international business, or simply exploring new cultures, our ultra-lightweight smart eyewear ensures you never miss a beat.

Our Mission: To break down global communication barriers through sleek, wearable AI technology.

Why choose us?

Innovation First: We source only the most advanced AI translation chips.

Uncompromised Style: Technology shouldn't look clunky. Our glasses are designed for everyday elegance.

Global Guarantee: Secure shipping and a dedicated support team ready to assist you worldwide.

Step into the future with AIGenie Vision. Connect, communicate, and conquer.`);
    console.log('  ✅ About Us 内容已填充');
  } else {
    console.log('  ⚠️ 未找到编辑器');
  }

  const savePage = page.locator('button:has-text("Save")').first();
  if (await savePage.isVisible({ timeout: 3000 }).catch(() => false)) {
    await savePage.click();
    await page.waitForTimeout(2000);
    console.log('  ✅ About Us 页面已保存');
  }

  console.log('\n' + '='.repeat(50));
  console.log('  🎉 店铺配置完成！');
  console.log('  请检查：');
  console.log('    1. Settings > General: 名称/货币/时区');
  console.log('    2. Settings > Markets: 北美+欧洲');
  console.log('    3. Pages: About Us 内容');
  console.log('='.repeat(50));

  await browser.close();
}

main().catch(err => {
  console.error('❌ 出错:', err.message);
  process.exit(1);
});
