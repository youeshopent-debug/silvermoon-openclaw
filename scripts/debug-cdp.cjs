'use strict';
const http = require('http');
const WebSocket = require('ws');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 5000 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  // 1. 先起 Chrome
  const { spawn } = require('child_process');
  const chrome = spawn(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ['--remote-debugging-port=9222', '--no-first-run', '--no-default-browser-check', '--user-data-dir=C:\\Users\\User\\AppData\\Local\\Temp\\cdp-debug'],
    { detached: true, stdio: 'ignore' }
  );
  chrome.unref();
  await new Promise(r => setTimeout(r, 3000));

  // 2. 获取 targets
  const ver = await fetchJSON('http://127.0.0.1:9222/json/version');
  console.log('=== /json/version ===');
  console.log(JSON.stringify(ver, null, 2));

  const targets = await fetchJSON('http://127.0.0.1:9222/json');
  console.log('\n=== /json (targets) ===');
  targets.forEach((t, i) => {
    console.log(`[${i}] type=${t.type} url=${t.url?.substring(0, 60)} ws=${t.webSocketDebuggerUrl?.substring(0, 50)}...`);
  });

  // 3. 连到第一个 page target 做 CDP 测试
  const page = targets.find(t => t.type === 'page');
  if (!page) { console.log('❌ 没有 page target'); process.exit(1); }

  console.log(`\n=== 连接 ${page.webSocketDebuggerUrl} ===`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.on('open', async () => {
    console.log('WS 已连接');

    // 测试 Page.captureScreenshot
    const id = 1;
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));

    ws.on('message', (raw) => {
      const resp = JSON.parse(raw.toString());
      if (resp.id === 1) {
        if (resp.result?.data) {
          console.log(`✅ 截图成功: ${(Buffer.from(resp.result.data, 'base64').length / 1024).toFixed(1)} KB`);
        } else {
          console.log('❌ 截图返回:', JSON.stringify(resp, null, 2));
        }
        ws.close();
        try { process.kill(chrome.pid); } catch {}
        process.exit(0);
      }
    });

    ws.on('error', (e) => { console.log('WS error:', e.message); });
  });
}

main().catch(e => { console.error(e); process.exit(1); });
