'use strict';
const { spawn } = require('child_process');
const cdp = require('../lib/chrome-cdp-bridge');

function waitForPort(port, timeout = 15000) {
  const net = require('net');
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      if (Date.now() - start > timeout) return resolve(false);
      const s = net.createConnection(port, '127.0.0.1', () => { s.end(); resolve(true); });
      s.on('error', () => {});
      s.on('close', () => setTimeout(tryConnect, 300));
    }
    tryConnect();
  });
}

async function main() {
  console.log('═══ 带 Chrome 的完整链路验证 ═══\n');

  // Step 1: 启动或发现 Chrome
  let startedByUs = false;
  let wsUrl;
  try { wsUrl = await cdp.discoverCDPEndpoint(); }
  catch {
    console.log('📌 Chrome 未运行，启动临时测试 Chrome...');
    const chrome = spawn(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ['--remote-debugging-port=9222', '--no-first-run', '--no-default-browser-check', '--user-data-dir=C:\\Users\\User\\AppData\\Local\\Temp\\cdp-test'],
      { detached: true, stdio: 'ignore' }
    );
    chrome.unref();
    startedByUs = true;
    console.log('  等待 Chrome 就绪...');
    const ok = await waitForPort(9222, 15000);
    if (!ok) { console.log('❌ Chrome 启动超时'); process.exit(1); }
    console.log('✅ Chrome 已就绪 (port 9222)');
    await new Promise(r => setTimeout(r, 1000));
  }

  let chromePid = null;
  try {
    // Step 2: launchOrConnect
    console.log('\n【1/4】launchOrConnect...');
    const result = await cdp.launchOrConnect();
    console.log(`  ✅ 模式: ${result.mode}`);

    // Step 3: 先导航到真实网页（chrome://newtab 不支持截图和 evaluate）
    console.log('\n【2/4】导航到真实网页...');
    const navResult = await cdp.navigate('https://example.com');
    console.log(`  ✅ 导航完成，URL: ${navResult.url || 'unknown'}`);
    await new Promise(r => setTimeout(r, 2000));

    // Step 4: 获取页面信息
    console.log('\n【3/4】获取页面信息...');
    const info = await cdp.getPageInfo();
    console.log(`  ✅ 标题: "${info.title}"`);
    console.log(`  URL: ${info.url}`);

    // Step 5: 截图
    console.log('\n【4/4】截图...');
    const shot = await cdp.screenshot('verify_pass');
    console.log(`  ✅ 截图成功: ${shot.name} (${(shot.buffer.length / 1024).toFixed(1)} KB)`);

    console.log('\n══════════════════════');
    console.log('🎉 完整链路验证通过！');
  } catch (e) {
    console.log(`\n❌ 链路测试失败: ${e.message}`);
    console.log(e.stack);
  } finally {
    // 清理
    if (startedByUs) {
      try {
        const { execSync } = require('child_process');
        execSync('taskkill /F /IM chrome.exe /T 2>nul', { timeout: 3000 });
      } catch {}
    }
  }
}

main().catch(console.error);
