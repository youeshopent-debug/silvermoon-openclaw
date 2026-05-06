import http from 'http';
import WebSocket from 'ws';

const CDP_HOST = '127.0.0.1:9222';

async function getPages() {
  return new Promise((resolve, reject) => {
    http.get(`http://${CDP_HOST}/json`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function cdpCall(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(wsUrl, { timeout: 15000 });
    const msg = JSON.stringify({ id: 1, method, params });
    client.on('open', () => client.send(msg));
    
    const messages = [];
    client.on('message', (data) => {
      try {
        const resp = JSON.parse(data.toString());
        messages.push(resp);
        // Check for network events
        if (resp.method === 'Network.requestWillBeSent') {
          const req = resp.params.request;
          if (req.url.includes('/api/')) {
            console.log('API Request:', req.method, req.url);
            console.log('  Headers:', JSON.stringify(req.headers).slice(0, 200));
          }
        }
        if (resp.id === 1) {
          client.close();
          resolve(resp.result);
        }
      } catch(e) {}
    });
    client.on('error', reject);
    setTimeout(() => { try{client.close()}catch(e){}; reject(new Error('timeout')); }, 15000);
  });
}

const pages = await getPages();
const kimiPage = pages.find(p => p.url.includes('kimi'));

if (!kimiPage) {
  console.log('Kimi page not found');
  process.exit(1);
}

// Enable Network tracking
await cdpCall(kimiPage.webSocketDebuggerUrl, 'Network.enable');

// Reload the page to capture all API requests
console.log('Reloading Kimi page to capture API calls...');
await cdpCall(kimiPage.webSocketDebuggerUrl, 'Page.reload');

// Wait for network requests
await new Promise(r => setTimeout(r, 5000));

console.log('\nDone. Check output above for API endpoints.');
