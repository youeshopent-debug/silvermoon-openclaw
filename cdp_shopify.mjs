import http from 'http';
import WebSocket from 'ws';

const CDP_PORT = 9222;

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    ws.send(JSON.stringify({ id, method, params }));
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.removeListener('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
    setTimeout(() => { ws.removeListener('message', handler); reject(new Error('Timeout: ' + method)); }, 10000);
  });
}

async function main() {
  // 连 browser websocket（不是 page websocket）
  const version = await httpGet('/json/version');
  const browserWS = version.webSocketDebuggerUrl;
  console.log('Browser WS:', browserWS);
  
  const ws = new WebSocket(browserWS);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  console.log('Connected to browser');
  
  // 用 Target.createTarget 打开新页面
  const newTab = await sendCDP(ws, 'Target.createTarget', {
    url: 'about:blank',
    width: 1280,
    height: 800
  });
  console.log('New tab ID:', newTab.result.targetId);
  
  // 连新 tab
  const tabInfo = await httpGet('/json');
  const newTabInfo = tabInfo.find(t => t.id === newTab.result.targetId);
  console.log('New tab WS:', newTabInfo?.webSocketDebuggerUrl);
  
  if (newTabInfo) {
    const ws2 = new WebSocket(newTabInfo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws2.on('open', resolve);
      ws2.on('error', reject);
    });
    
    // 导航到 Shopify 设置
    await sendCDP(ws2, 'Page.enable');
    await sendCDP(ws2, 'Page.navigate', { url: 'https://admin.shopify.com/store/aigenie-hub/settings' });
    console.log('Navigating to Shopify settings...');
    
    // 等页面加载
    await new Promise(r => setTimeout(r, 5000));
    
    const result = await sendCDP(ws2, 'Runtime.evaluate', {
      expression: 'document.title',
      returnByValue: true,
      awaitPromise: false
    });
    console.log('Page title:', result.result?.result?.value);
    
    ws2.close();
  }
  
  ws.close();
}

main().catch(console.error);
