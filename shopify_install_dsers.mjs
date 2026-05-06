import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function waitForEnter(msg) {
  return new Promise(resolve => {
    console.log(`\n📌 ${msg}`);
    rl.question('   完成后按 Enter 继续... ', () => resolve());
  });
}

function openUrl(url) {
  // Windows: start, macOS: open, Linux: xdg-open
  try { execSync(`start "" "${url}"`, { shell: 'cmd.exe' }); }
  catch { try { execSync(`open "${url}"`); } catch { execSync(`xdg-open "${url}"`); } }
}

async function main() {
  console.log('='.repeat(50));
  console.log('  银月钱庄 · DSers 手动安装引导');
  console.log('  模式: 全手动（用你默认浏览器操作）');
  console.log('='.repeat(50));

  // ── 1. 打开 Shopify 后台 ──
  console.log('\n--- 步骤 1: 登录 Shopify 后台 ---');
  openUrl('https://aigenie-hub.myshopify.com/admin');
  await waitForEnter('请登录 Shopify（如果还没登录的话）');

  // ── 2. 打开 DSers App Store 页面 ──
  console.log('\n--- 步骤 2: 安装 DSers ---');
  openUrl('https://apps.shopify.com/dsers');
  await waitForEnter('请点击 "Add app" 按钮安装 DSers，然后授权安装');

  // ── 3. 等待 DSers 安装完成 ──
  await waitForEnter('如果跳转到了 DSers 注册页，请用 Shopify 同邮箱注册');

  // ── 4. 绑定 AliExpress ──
  console.log('\n--- 步骤 4: 绑定 AliExpress 账号 ---');
  openUrl('https://www.dsers.com/');
  await waitForEnter('请在 DSers 后台找到 "Link to AliExpress" 或 "Connect AliExpress" 并点击');

  // ── 5. AliExpress 登录 ──
  console.log('\n⚠️  重要提醒 ⚠️');
  console.log('  浏览器会跳转到 AliExpress 登录页。');
  console.log('  如果出现滑块验证码或设备验证，请手动完成。');
  console.log('  登录后授权 DSers 连接你的 AliExpress 账号。');
  await waitForEnter('请完成 AliExpress 登录和授权');

  // ── 6. 设置货币 USD ──
  console.log('\n--- 步骤 6: 设置 DSers 货币为 USD ---');
  openUrl('https://www.dsers.com/user/setting');
  await waitForEnter('请在 DSers Settings 中把货币设为 USD（默认一般是 USD）');

  // ── 完成 ──
  console.log('\n' + '='.repeat(50));
  console.log('  🎉 DSers 安装引导完成！');
  console.log('  接下来你可以：');
  console.log('    1. 在 DSers 中搜索产品 → Add to Import List');
  console.log('    2. 编辑标题/价格/图片 → Push to Shopify');
  console.log('    3. 客户下单后 → DSers 自动同步到 AliExpress 采购');
  console.log('='.repeat(50));

  rl.close();
}

main().catch(err => {
  console.error('❌ 出错:', err.message);
  process.exit(1);
});
