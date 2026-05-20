const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'logs', 'diag_require.log');

function log(msg) {
  const t = new Date().toISOString();
  fs.appendFileSync(logFile, `[${t}] ${msg}\n`, 'utf8');
  console.log(`[${t}] ${msg}`);
}

log('=== 诊断开始 ===');

// 先加载 .env
process.env.TZ = 'Asia/Kuala_Lumpur';
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.substring(0, eq).trim();
    const v = t.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !process.env[k]) process.env[k] = v;
  }
  log('[env] 已加载');
}

const modules = [
  './lib/task-contract',
  './lib/reminder-intent',
  './lib/reminder-store',
  './lib/exec-audit',
  './lib/restricted-exec',
  './lib/approval-gate',
  './lib/silvermoon-evolution',
  './lib/heartbeat-bridge',
  './lib/control-center',
  './lib/stripe-ledger-ingest',
  './lib/model-down-guard',
  './lib/finance-fallback',
  './lib/llm-proxy',
  './lib/telegram-bridge',
  './lib/persona-silvermoon',
  './lib/brain-router',
  './lib/tabbit-bridge',
  './lib/vision',
  './lib/task-watcher',
  './silvermoon_local/silvermoon/lib/dispatch-consumer',
  './lib/tools',
  './lib/gemini-client',
  './lib/model-down-reply',
  './lib/env-parse',
  './lib/memory',
  './lib/openclaw-switch',
  './lib/evidence-dedupe',
  './lib/prompt-builder',
  './lib/agents',
  './lib/intent',
  './lib/tool-router',
  './lib/chrome-cdp-bridge',
  './lib/xiaoyan-trade-guard',
  './lib/xiaoyan-crawler',
];

for (const m of modules) {
  log(`🔄 require ${m}...`);
  try {
    const start = Date.now();
    const mod = require(m);
    const elapsed = Date.now() - start;
    log(`✅ require ${m} OK (${elapsed}ms)`);
  } catch (err) {
    log(`❌ require ${m} FAIL: ${err.message}`);
  }
}

log('=== 诊断完成 ===');
