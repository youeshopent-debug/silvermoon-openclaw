import https from 'https';
import { URL } from 'url';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  // 1. 查现有 Contact 页面
  console.log('=== 查现有 Contact 页面 ===');
  const pages = await req('GET', '/pages.json');
  const contact = pages.data?.pages?.find(p => p.handle === 'contact');
  if (contact) {
    console.log(`找到 Contact 页面 ID: ${contact.id}, 标题: "${contact.title}"`);
    // 更新它
    const contactBody = `<div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #1a1a2e;">
  <h1 style="font-size: 2.5em; font-weight: 700; margin-bottom: 20px; color: #1a1a2e;">Contact Us</h1>
  <p style="font-size: 1.1em; color: #555; margin-bottom: 30px;">We'd love to hear from you. Whether you have a question about our products, need help with an order, or just want to say hi — we're here.</p>
  <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;">
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
    <div>
      <h2 style="font-size: 1.3em; font-weight: 600; margin-bottom: 15px; color: #1a1a2e;">Email</h2>
      <p><a href="mailto:hello@silvermoon.bank" style="color: #00d4ff; text-decoration: none;">hello@silvermoon.bank</a></p>
      <h2 style="font-size: 1.3em; font-weight: 600; margin-bottom: 15px; color: #1a1a2e; margin-top: 25px;">Social</h2>
      <p>X / Twitter: <a href="https://x.com/silverbank" style="color: #00d4ff; text-decoration: none;">@silverbank</a></p>
      <p>Discord: <a href="https://discord.gg/silvermoon" style="color: #00d4ff; text-decoration: none;">SilverMoon Community</a></p>
    </div>
    <div>
      <h2 style="font-size: 1.3em; font-weight: 600; margin-bottom: 15px; color: #1a1a2e;">Business Hours</h2>
      <p>Monday - Friday: 9:00 AM - 6:00 PM EST</p>
      <p>Saturday: 10:00 AM - 4:00 PM EST</p>
      <p>Sunday: Closed</p>
      <p style="margin-top: 20px; color: #888;">We aim to respond within 24 hours during business days.</p>
    </div>
  </div>
</div>`;
    const upd = await req('PUT', `/pages/${contact.id}.json`, {
      page: { title: 'Contact Us', body_html: contactBody, published: true }
    });
    if (upd.status === 200) {
      console.log(`✅ Contact Us 页面更新成功！`);
    } else {
      console.log(`❌ 更新失败:`, JSON.stringify(upd.data || upd.raw).slice(0, 300));
    }
  } else {
    console.log('未找到 Contact 页面');
  }

  // 2. 查所有页面
  console.log('\n=== 所有页面 ===');
  const allPages = await req('GET', '/pages.json?limit=50');
  if (allPages.data?.pages) {
    allPages.data.pages.forEach(p => {
      console.log(`  [${p.id}] ${p.title} — ${p.handle} — ${p.published ? '已发布' : '草稿'}`);
    });
  }

  console.log('\n🎉 完成！');
}

main().catch(console.error);
