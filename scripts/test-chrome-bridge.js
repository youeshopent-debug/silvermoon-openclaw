/**
 * test-chrome-bridge.js
 * 验证 Chrome CDP 桥接是否正常工作
 *
 * 用法：node scripts/test-chrome-bridge.js
 */

const chrome = require('../lib/chrome-cdp-bridge');

async function main() {
  console.log('=== Chrome CDP 桥接通电测试 ===\n');

  // 1. 发现 CDP 端
  console.log('[1/5] 扫描 CDP 端点 (127.0.0.1:9222)...');
  try {
    const wsEndpoint = await chrome.discoverCDPEndpoint();
    console.log(`  ✅ CDP 发现成功: ${wsEndpoint.substring(0, 60)}...`);
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    console.log('\n⚠️ 你的 Chrome 没有开启远程调试端口。')
    console.log('请运行以下命令启动 Chrome CDP 模式：')
    console.log('  .\\scripts\\start-chrome-cdp.ps1')
    console.log('\n或者手动关闭所有 Chrome，然后用这个命令启动：')
    console.log('  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222')
    process.exit(1);
  }

  // 2. 连接
  console.log('[2/5] 连接 CDP...');
  const r = await chrome.connect();
  console.log(`  ✅ 已连接 (${r.tabs} 个标签页)`);

  // 3. 获取当前页面信息
  console.log('[3/5] 获取页面信息...');
  const info = await chrome.getPageInfo();
  console.log(`  📄 标题: ${info.title}`);
  console.log(`  🔗 URL: ${info.url}`);

  // 4. 列出所有标签
  console.log('[4/5] 列出标签页...');
  const tabs = await chrome.listTabs();
  tabs.forEach((t) => {
    console.log(`  [${t.index}] ${t.title}`);
    console.log(`        ${t.url}`);
  });

  // 5. 截图验证
  console.log('[5/5] 截图测试...');
  const shot = await chrome.screenshot('test_connection');
  console.log(`  ✅ 截图成功 (${(shot.buffer.length / 1024).toFixed(1)} KB)`);

  // 断开
  await chrome.disconnect();
  console.log('\n=== 🎉 Chrome CDP 桥接验证通过 ===');
}

main().catch((e) => {
  console.error('\n❌ 测试失败:', e.message);
  process.exit(1);
});
