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

const wsUrl = kimiPage.webSocketDebuggerUrl;

// Get all storage
const checks = [
  { name: 'localStorage', expr: 'JSON.stringify(window.localStorage)' },
  { name: 'sessionStorage', expr: 'JSON.stringify(window.sessionStorage)' },
  { name: 'document.cookie', expr: 'document.cookie' },
  { name: 'window.__NEXT_DATA__', expr: 'window.__NEXT_DATA__ ? JSON.stringify(window.__NEXT_DATA__).slice(0,500) : "N/A"' },
  { name: 'window.__INITIAL_STATE__', expr: 'window.__INITIAL_STATE__ ? JSON.stringify(window.__INITIAL_STATE__).slice(0,500) : "N/A"' },
];

for (const check of checks) {
  try {
    const result = await cdpCall(wsUrl, 'Runtime.evaluate', {
      expression: check.expr,
      returnByValue: false
    });
    if (result.result && result.result.value) {
      console.log(`\n=== ${check.name} ===`);
      const val = result.result.value;
      // Try to parse and pretty print
      try {
        const parsed = JSON.parse(val);
        if (typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            const vStr = typeof v === 'string' ? v.slice(0, 100) : JSON.stringify(v).slice(0, 100);
            if (k.toLowerCase().includes('token') || k.toLowerCase().includes('auth') || k.toLowerCase().includes('key') || k.toLowerCase().includes('access')) {
              console.log(`  ${k}: ${vStr} <<< IMPORTANT`);
            } else {
              console.log(`  ${k}: ${vStr}`);
            }
          });
        } else {
          console.log('  ' + val.slice(0, 200));
        }
      } catch {
        console.log('  ' + val.slice(0, 200));
      }
    }
  } catch(e) {
    console.log(`${check.name}: ERROR - ${e.message}`);
  }
}
