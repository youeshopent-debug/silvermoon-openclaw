const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const WHSEC = 'whsec_citQ4Q37UExkeL8EEyS5Qu5LFuef3Xbh';
const WEBHOOK_URL = 'https://hourly-everybody-ranging-basement.trycloudflare.com/api/cashclaw/stripe/webhook';

// 模拟 checkout.session.completed 事件 payload
const payload = JSON.stringify({
  id: 'evt_test_' + Date.now(),
  object: 'event',
  api_version: '2020-08-27',
  created: Math.floor(Date.now() / 1000),
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_' + Date.now(),
      object: 'checkout.session',
      amount_total: 2999,
      currency: 'usd',
      payment_status: 'paid',
      status: 'complete',
      customer_email: 'test@silvermoon.bank',
      created: Math.floor(Date.now() / 1000),
      livemode: true,
      metadata: {}
    }
  }
});

// 计算 Stripe 签名
function computeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

const signature = computeSignature(payload, WHSEC);

// 发送请求
function sendRequest() {
  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_URL);
    const body = Buffer.from(payload, 'utf-8');
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        'Stripe-Signature': signature
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('📤 发送测试 webhook 事件...');
  console.log(`   事件ID: ${JSON.parse(payload).id}`);
  console.log(`   类型: checkout.session.completed`);
  console.log(`   金额: USD $29.99`);
  console.log(`   签名: ${signature.slice(0, 40)}...\n`);

  const res = await sendRequest();
  console.log(`📥 响应: HTTP ${res.status}`);
  console.log(`   内容: ${res.body.slice(0, 200)}`);

  if (res.status === 200) {
    console.log('\n✅ 网关验签通过，事件已处理。');
  } else {
    console.log(`\n❌ 网关返回 ${res.status}`);
  }

  // 检查事件日志
  console.log('\n📁 检查最新事件日志...');
  const logPath = path.resolve(__dirname, '..', 'workspace', 'CASHCLAW', 'stripe.events.jsonl');
  if (fs.existsSync(logPath)) {
    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
    const last = lines.slice(-3).map(l => { try { const j = JSON.parse(l); return `   ${j.id} | ${j.type} | livemode:${j.livemode} | $${(j.data?.object?.amount_total || 0) / 100}`; } catch { return `   [parse error]`; } });
    console.log(`   共 ${lines.length} 条记录，最近 ${Math.min(3, last.length)} 条:`);
    last.forEach(l => console.log(l));
  } else {
    console.log('   ❌ 事件日志文件不存在');
  }

  // 检查 ledger
  console.log('\n📊 检查 ledger 最新记录...');
  const ledgerPath = path.resolve(__dirname, '..', 'workspace', 'CASHCLAW', 'ledger.sqlite');
  if (fs.existsSync(ledgerPath)) {
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(ledgerPath, sqlite3.OPEN_READONLY);
    db.all('SELECT id, amount, currency, status, created_at FROM payments ORDER BY created_at DESC LIMIT 3', (err, rows) => {
      if (err) console.log(`   ❌ ${err.message}`);
      else if (rows.length === 0) console.log('   ledger 暂无入账记录');
      else {
        rows.forEach(r => console.log(`   ${r.id} | ${r.amount} ${r.currency} | ${r.status} | ${r.created_at}`));
      }
      db.close();
    });
  } else {
    console.log('   ❌ ledger 文件不存在');
  }
}

main().catch(e => console.error('❌', e));
