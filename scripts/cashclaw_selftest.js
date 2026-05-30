const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: res.ok, status: res.status, text, json };
}

async function waitForStatus(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetchJson(`${baseUrl}/api/status`);
      if (r.ok) return r;
    } catch {}
    await sleep(250);
  }
  return null;
}

function stripeSigHeader(secret, payload) {
  const ts = Math.floor(Date.now() / 1000);
  const signed = `${ts}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return `t=${ts},v1=${sig}`;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const port = Number(process.env.CASHCLAW_SELFTEST_PORT || process.env.OPENCLAW_LINK_PORT || 18792);
  const baseUrl = `http://127.0.0.1:${port}`;
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || 'whsec_selftest_secret');
  const ledgerPath = path.join(root, 'workspace', 'CASHCLAW', 'stripe.events.jsonl');

  const child = spawn(process.execPath, [path.join(root, 'main.js')], {
    cwd: root,
    env: {
      ...process.env,
      OPENCLAW_DISABLE_DISCORD: '1',
      CASHCLAW_ENABLED: '1',
      STRIPE_WEBHOOK_SECRET: secret,
      OPENCLAW_LINK_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let childExited = false;
  let childExitCode = null;
  child.on('exit', (code) => {
    childExited = true;
    childExitCode = code;
  });

  const ready = await waitForStatus(baseUrl, 15_000);
  if (!ready) {
    try { child.kill(); } catch {}
    console.error(`[cashclaw_selftest] server not ready (${baseUrl})`);
    if (childExited) console.error(`[cashclaw_selftest] child exited code=${childExitCode}`);
    process.exit(2);
  }

  const eventId = `evt_selftest_${Date.now()}`;
  const event = {
    id: eventId,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_selftest', currency: 'usd', amount_total: 1234, client_reference_id: 'cashclaw_selftest' } },
  };
  const body = JSON.stringify(event);
  const sig = stripeSigHeader(secret, body);

  const res = await fetchJson(`${baseUrl}/api/cashclaw/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': sig },
    body,
  });

  if (!res.ok) {
    try { child.kill(); } catch {}
    console.error(`[cashclaw_selftest] webhook status=${res.status} body=${String(res.text || '').slice(0, 500)}`);
    process.exit(3);
  }

  await sleep(250);

  const raw = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf-8') : '';
  if (!raw.includes(eventId)) {
    try { child.kill(); } catch {}
    console.error(`[cashclaw_selftest] ledger missing eventId (${ledgerPath})`);
    process.exit(4);
  }

  try { child.kill(); } catch {}
  process.stdout.write(`[cashclaw_selftest] ok eventId=${eventId}\n`);
}

main().catch((e) => {
  console.error('[cashclaw_selftest] fatal', e?.message || e);
  process.exit(1);
});
