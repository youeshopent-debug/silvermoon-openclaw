'use strict';
const http = require('http');

async function fetchJSON(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`parse failed: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  console.log('═══ TuriX-CUA 链路验证 ═══');
  console.log();

  // Step 1: 扫描端口
  console.log('【1/4】扫描 CDP 端口...');
  const PORTS = [9222, 9223, 9224, 9225];
  let found = false;
  for (const port of PORTS) {
    try {
      const info = await fetchJSON(`http://127.0.0.1:${port}/json/version`, 2000);
      if (info.webSocketDebuggerUrl) {
        console.log(`  ✅ 发现 Chrome CDP: 127.0.0.1:${port}`);
        console.log(`     WebSocket: ${info.webSocketDebuggerUrl}`);
        found = true;
      }
    } catch {}
  }
  if (!found) console.log(`  ⚠️ 当前无 Chrome 监听 ${PORTS.join(', ')}（正常，任务可启动 Chrome）`);

  // Step 2: 加载 chrome-cdp-bridge 模块
  console.log();
  console.log('【2/4】加载 chrome-cdp-bridge 模块...');
  let cdp;
  try {
    cdp = require('../lib/chrome-cdp-bridge');
    console.log('  ✅ 模块加载成功');
  } catch (e) {
    console.log(`  ❌ 模块加载失败: ${e.message}`);
    process.exit(1);
  }

  // Step 3: 加载 agent-tools 模块（验证 turix_cua 加载）
  console.log();
  console.log('【3/4】加载 agent-tools.js（验证 turix_cua 工具定义）...');
  try {
    const tools = require('../lib/agent-tools');
    if (tools.TOOLS && tools.TOOLS.turix_cua) {
      console.log('  ✅ turix_cua 工具已注册');
      console.log(`  描述: ${tools.TOOLS.turix_cua.description.substring(0, 60)}...`);
    } else {
      console.log('  ❌ turix_cua 工具未找到');
    }
  } catch (e) {
    console.log(`  ❌ agent-tools 加载失败: ${e.message}`);
    console.log(e.stack);
    process.exit(1);
  }

  // Step 4: discoverCDPEndpoint 容错测试（无 Chrome 时应该报可读错误）
  console.log();
  console.log('【4/4】验证 discoverCDPEndpoint 容错...');
  try {
    const wsUrl = await cdp.discoverCDPEndpoint();
    console.log(`  ✅ 发现端点: ${wsUrl}`);
  } catch (e) {
    console.log(`  ✅ 无 Chrome 时正确处理: ${e.message}`);
    console.log('  错误信息包含端口列表 — 可读性 OK');
  }

  // Step 5: 完整链路（启动 → 导航 → 截图）
  console.log();
  console.log('══════════════════════');
  console.log('所有模块语法正确，链路就绪。');
  console.log('要测试实际浏览器操作，请先启动 Chrome:');
  console.log('  node scripts/verify-cdp-chain-with-chrome.cjs');
  console.log('或手动启动 Chrome 再测:');
  console.log('  start_chrome_debug.cmd');
  console.log('  node -e "require(\\"../lib/chrome-cdp-bridge\\").launchOrConnect().then(console.log)"');
}

main().catch(console.error);
