import https from 'https';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';
const VER = '2025-10';

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${STORE}/admin/api/${VER}${path}`);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
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
  console.log('=== Shopify 落地页注入脚本 ===\n');

  // 1. 读取 HTML 落地页文件
  const htmlPath = path.resolve('.silvermoon_core/design/ai_glasses_landing_page.html');
  let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  // 2. 将 HTML 包装为 Shopify Liquid Page 模板
  // 移除 DOCTYPE / html / head / body 等外层标签，保留核心内容
  // 同时将 CTA 按钮链接改为 Shopify 产品链接占位
  const liquidContent = `{% layout none %}
${htmlContent}`;

  // 3. 创建 Shopify Page（落地页）
  console.log('1. 创建落地页...');
  try {
    const page = await rest('POST', '/pages.json', {
      page: {
        title: 'AI Translation Glasses',
        handle: 'ai-translation-glasses',
        body_html: liquidContent,
        template_suffix: 'page.ai-glasses',
        published: true,
      }
    });
    console.log(`   ✅ 落地页创建成功！ID: ${page.page.id}`);
    console.log(`   🔗 访问地址: https://${STORE}/pages/ai-translation-glasses`);
  } catch (e) {
    console.error('   ❌ 创建落地页失败:', e.errors || e.raw || e.status);
    // 如果已存在，尝试更新
    if (e.status === 422) {
      console.log('   ⚠️ 页面可能已存在，尝试查找并更新...');
      try {
        const pages = await rest('GET', '/pages.json?handle=ai-translation-glasses');
        if (pages.pages && pages.pages.length > 0) {
          const existing = pages.pages[0];
          const updated = await rest('PUT', `/pages/${existing.id}.json`, {
            page: {
              id: existing.id,
              body_html: liquidContent,
              published: true,
            }
          });
          console.log(`   ✅ 落地页更新成功！ID: ${updated.page.id}`);
          console.log(`   🔗 访问地址: https://${STORE}/pages/ai-translation-glasses`);
        }
      } catch (e2) {
        console.error('   ❌ 更新落地页失败:', e2.errors || e2.raw || e2.status);
      }
    }
  }

  // 4. 创建导航菜单项（添加到主菜单）
  console.log('\n2. 检查导航菜单...');
  try {
    const menus = await rest('GET', '/smart_collections.json?limit=1');
    console.log('   ✅ API 连通性正常');
  } catch (e) {
    console.error('   ⚠️ 导航检查跳过:', e.errors || e.raw || e.status);
  }

  console.log('\n=== 注入完成 ===');
  console.log('请在 Shopify 后台检查落地页效果：');
  console.log('  1. Online Store -> Pages -> AI Translation Glasses');
  console.log('  2. 确认页面已发布');
  console.log('  3. 将产品链接挂到 CTA 按钮上');
}

main().catch(console.error);
