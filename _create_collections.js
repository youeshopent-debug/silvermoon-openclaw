const https = require('https');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

let SHOPIFY_STORE = process.env.SHOPIFY_STORE || '';
let SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN || '';
const API_VERSION = '2025-10';

if (!SHOPIFY_STORE || !SHOPIFY_TOKEN) {
  const fallbackPath = path.join(__dirname, '.silvermoon_core', 'shopify_agent_keys.json');
  try {
    const creds = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    if (!SHOPIFY_STORE) SHOPIFY_STORE = creds.store || '';
    if (!SHOPIFY_TOKEN) SHOPIFY_TOKEN = creds.token || '';
  } catch (e) { /* silent */ }
}

function shopifyRequest(method, reqPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${SHOPIFY_STORE}/admin/api/${API_VERSION}${reqPath}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve(data); }
        } else {
          try {
            const parsed = JSON.parse(data);
            reject(new Error(`${res.statusCode}: ${JSON.stringify(parsed.errors || parsed)}`));
          } catch (e) {
            reject(new Error(`${res.statusCode}: ${data.slice(0, 500)}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const collections = [
  {
    title: 'AI Wearables',
    rules: [{ column: 'tag', relation: 'equals', condition: 'AI Wearables' }],
    body: 'Wearable AI technology — smart glasses, AI accessories, and hands-free devices powered by artificial intelligence.'
  },
  {
    title: 'AI Audio',
    rules: [{ column: 'tag', relation: 'equals', condition: 'AI Audio' }],
    body: 'AI-powered audio devices — real-time translation earbuds, smart voice recorders, and noise-cancelling audio gear.'
  },
  {
    title: 'AI Productivity Tools',
    rules: [{ column: 'tag', relation: 'equals', condition: 'AI Productivity' }],
    body: 'Boost your workflow with AI productivity tools — smart pens, digital notepads, and AI-powered scanning devices.'
  }
];

async function main() {
  console.log('===== 创建 AI 产品 Smart Collections =====\n');

  for (const c of collections) {
    try {
      const res = await shopifyRequest('POST', '/smart_collections.json', {
        smart_collection: {
          title: c.title,
          rules: c.rules,
          disjunctive: false,
          sort_order: 'best-selling',
          body_html: `<p>${c.body}</p>`,
          published: true
        }
      });
      console.log(`  ✅ [${c.title}] → handle: ${res.smart_collection.handle  }, id: ${res.smart_collection.id}`);
    } catch (e) {
      console.log(`  ❌ [${c.title}] ${e.message}`);
    }
  }

  console.log('\n===== 完成 =====');
}

main().catch(console.error);
