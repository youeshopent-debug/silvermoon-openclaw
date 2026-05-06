import https from 'https';
import { URL } from 'url';
import fs from 'fs';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';
const VER = '2025-10';
const PAGE_ID = 124156674147;

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${STORE}/admin/api/${VER}${path}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject({ status: res.statusCode, errors: parsed.errors || parsed });
          else resolve(parsed);
        } catch (e) { reject({ status: res.statusCode, raw: data.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const html = fs.readFileSync('.silvermoon_core/design/ai_glasses_landing_page.html', 'utf-8');

  console.log('🔄 更新落地页...');
  const result = await rest('PUT', `/pages/${PAGE_ID}.json`, {
    page: {
      id: PAGE_ID,
      body_html: html,
      published: true,
    }
  });

  const p = result.page;
  console.log('✅ 落地页更新成功！');
  console.log('   ID:', p.id);
  console.log('   标题:', p.title);
  console.log('   已发布:', p.published_at ? '是' : '否');
  console.log('   URL: https://' + STORE + '/pages/' + p.handle);
  console.log('\n📌 商品链接已指向:');
  console.log('   https://' + STORE + '/products/ai-smart-translation-glasses');
}

main().catch(err => console.error('❌ 失败:', JSON.stringify(err, null, 2)));
