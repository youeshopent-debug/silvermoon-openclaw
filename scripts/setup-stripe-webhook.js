const https = require('https');
const fs = require('fs');
const path = require('path');

const STRIPE_SECRET = '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';
const WEBHOOK_URL = 'https://hourly-everybody-ranging-basement.trycloudflare.com/api/cashclaw/stripe/webhook';
const ENV_PATH = path.resolve(__dirname, '..', '.env');

function stripeApi(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const buf = body ? Buffer.from(body, 'utf-8') : null;
    const opts = {
      hostname: 'api.stripe.com',
      path, method,
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = buf.length;
    }
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error(`解析失败: ${d.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    if (buf) req.write(buf);
    req.end();
  });
}

async function main() {
  // 1. 删掉已有同名端点
  console.log('1️⃣ 检查并清理旧 webhook...');
  const list = await stripeApi('GET', '/v1/webhook_endpoints?limit=20');
  const old = (list.data || []).filter(e => e.url === WEBHOOK_URL);
  for (const e of old) {
    console.log(`   删除旧端点: ${e.id}`);
    await stripeApi('DELETE', `/v1/webhook_endpoints/${e.id}`);
  }

  // 2. 创建新端点
  console.log('2️⃣ 创建 webhook 端点...');
  const events = ['checkout.session.completed', 'payment_intent.succeeded', 'charge.succeeded'];
  const body = `url=${encodeURIComponent(WEBHOOK_URL)}&${events.map(e => `enabled_events[]=${encodeURIComponent(e)}`).join('&')}`;
  const r = await stripeApi('POST', '/v1/webhook_endpoints', body);
  if (r.error) {
    console.error(`❌ ${r.error.message}`);
    process.exit(1);
  }
  console.log(`   端点ID: ${r.id}`);
  console.log(`   响应字段: ${Object.keys(r).join(', ')}`);

  // 3. 提取 signing secret
  const raw = JSON.stringify(r, null, 2);
  console.log(`   完整响应:\n${raw.slice(0, 1000)}`);

  let whsec = null;
  if (r.secret) {
    if (typeof r.secret === 'string') whsec = r.secret;
    else if (typeof r.secret === 'object') {
      whsec = r.secret.value || (r.secret.secrets?.[0]?.value) || JSON.stringify(r.secret);
    }
  }
  if (!whsec) {
    // Stripe API v2: secret 可能是嵌套的
    const match = raw.match(/whsec_[a-zA-Z0-9]+/);
    if (match) whsec = match[0];
  }
  if (!whsec) {
    console.error('❌ 无法提取 signing secret');
    process.exit(1);
  }
  console.log(`   Signing secret: ${whsec.slice(0, 20)}...`);

  // 4. 写入 .env
  let env = fs.readFileSync(ENV_PATH, 'utf-8');
  if (env.includes('STRIPE_WEBHOOK_SECRET=')) {
    env = env.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET="${whsec}"`);
  } else {
    // 插入到 STRIPE_SECRET_KEY 下面
    env = env.replace(
      /^(STRIPE_SECRET_KEY=.*)$/m,
      `$1\nSTRIPE_WEBHOOK_SECRET="${whsec}"`
    );
  }
  fs.writeFileSync(ENV_PATH, env, 'utf-8');
  console.log('✅ STRIPE_WEBHOOK_SECRET 已写入 .env');
}

main().catch(e => { console.error('❌', e); process.exit(1); });
