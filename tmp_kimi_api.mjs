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
    const client = new WebSocket(wsUrl, { timeout: 10000 });
    const msg = JSON.stringify({ id: 1, method, params });
    client.on('open', () => client.send(msg));
    client.on('message', (data) => {
      try {
        const resp = JSON.parse(data.toString());
        if (resp.id === 1) { client.close(); resolve(resp.result); }
      } catch(e) {}
    });
    client.on('error', reject);
    setTimeout(() => { try{client.close()}catch(e){}; reject(new Error('timeout')); }, 10000);
  });
}

const pages = await getPages();
const kimiPage = pages.find(p => p.url.includes('kimi'));

if (!kimiPage) {
  console.log('Kimi page not found');
  process.exit(1);
}

// Get Kimi's cookies
const result = await cdpCall(kimiPage.webSocketDebuggerUrl, 'Network.getAllCookies');
const cookies = result.cookies || [];
const kimiCookies = cookies.filter(c => (c.domain||'').includes('kimi'));
console.log('Kimi cookies:', kimiCookies.length);

// Try to get the API endpoint by checking what fetch requests Kimi makes
const apiResult = await cdpCall(kimiPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
  expression: `
    (() => {
      // Check if Kimi has any global API config
      const apis = window.__NEXT_DATA__ || window.__NUXT__ || window.__INITIAL_STATE__;
      return JSON.stringify({
        nextData: typeof window.__NEXT_DATA__ !== 'undefined' ? 'found' : 'not found',
        location: window.location.href,
        apiEndpoint: window._env_?.API_BASE_URL || 'unknown'
      });
    })()
  `
});

if (apiResult.result && apiResult.result.value) {
  console.log('Kimi page info:', apiResult.result.value);
}

// Also check network requests - enable Network tracking
await cdpCall(kimiPage.webSocketDebuggerUrl, 'Network.enable');

// Make a small fetch to see what API Kimi uses
const fetchResult = await cdpCall(kimiPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
  expression: `
    (async () => {
      try {
        const resp = await fetch('/api/chat/list', { method: 'GET' });
        return 'API /api/chat/list: ' + resp.status;
      } catch(e) {
        try {
          const resp = await fetch('/api/v1/chat/list', { method: 'GET' });
          return 'API /api/v1/chat/list: ' + resp.status;
        } catch(e2) {
          return 'No API found: ' + e2.message;
        }
      }
    })()
  `,
  awaitPromise: true
});

if (fetchResult.result && fetchResult.result.value) {
  console.log('Kimi API test:', fetchResult.result.value);
}

// Get the cookie string
const cookieStr = kimiCookies.map(c => c.name+'='+c.value).join('; ');
console.log('\nCookie (first 100 chars):', cookieStr.slice(0, 100));
