import { readFileSync } from 'fs';
import https from 'https';
import { dirname, resolve } from 'path';
import { fileURLToPath, URL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(resolve(__dirname, '.env'), 'utf-8');
const env = {};
envRaw.split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const STORE = env.SHOPIFY_STORE;
const TOKEN = env.SHOPIFY_TOKEN;
const API = '2025-10';

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${STORE}/admin/api/${API}${path}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, timeout: 30000,
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, raw: d.slice(0, 1000) }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const pages = await req('GET', '/pages.json?limit=50');
  const toPublish = pages.data?.pages?.filter(p => !p.published) || [];
  
  for (const p of toPublish) {
    const r = await req('PUT', `/pages/${p.id}.json`, {
      page: { published: true, published_at: new Date().toISOString() }
    });
    if (r.status === 200) {
      console.log(`✅ 已发布: ${p.title} (${p.handle})`);
    } else {
      console.log(`❌ 发布失败 ${p.title}:`, JSON.stringify(r.data || r.raw).slice(0, 200));
    }
  }

  // 查导航菜单
  console.log('\n=== 查导航 ===');
  const nav = await req('GET', '/smart_collections.json');
  console.log('智能分类:', JSON.stringify(nav.data || nav.raw).slice(0, 500));

  // 查菜单（GraphQL）
  const gql = `{
    menus(first: 10) {
      edges {
        node {
          id
          title
          handle
          itemsCount
        }
      }
    }
  }`;
  const gqlR = await req('POST', '/graphql.json', { query: gql });
  console.log('菜单:', JSON.stringify(gqlR.data || gqlR.raw, null, 2));

  console.log('\n🎉 完成！');
}

main().catch(console.error);
