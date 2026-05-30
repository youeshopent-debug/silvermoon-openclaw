const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18791';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || '';
const LOG_DIR = path.join(__dirname, '..', 'workspace', 'CRON');
const LOG_FILE = path.join(LOG_DIR, 'moying-nvidia-monitor.log');

const MODELS = [
  'deepseek-ai/deepseek-v4-flash',
  'meta/llama-4-maverick-17b-128e-instruct',
  'google/gemma-4-31b-it',
  'microsoft/phi-4-mini-instruct',
  'mistralai/codestral-22b-instruct-v0.1',
];

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

function nvidiaRequest(path) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'integrate.api.nvidia.com',
      port: 443,
      path,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

function sendDiscordAlert(msg) {
  if (!DISCORD_WEBHOOK) return;
  const body = JSON.stringify({ content: `🚨 墨影 nVidia 告警: ${msg}` });
  const url = new URL(DISCORD_WEBHOOK);
  const client = url.protocol === 'https:' ? https : http;
  const req = client.request(url.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => res.resume());
  req.on('error', () => {});
  req.write(body);
  req.end();
}

async function checkNvidiaHealth() {
  log('=== nVidia NIM 巡检开始 ===');
  if (!NVIDIA_API_KEY) {
    log('[FAIL] NVIDIA_API_KEY 未配置');
    sendDiscordAlert('NVIDIA_API_KEY 未配置');
    return;
  }

  const result = await nvidiaRequest('/v1/models');
  if (result.status === 200) {
    log(`[OK] nVidia API 可达 (HTTP ${result.status})`);
  } else {
    log(`[FAIL] nVidia API 不可达 (HTTP ${result.status || result.error})`);
    sendDiscordAlert(`nVidia API 不可达: ${result.status || result.error}`);
    return;
  }

  let okCount = 0;
  let failCount = 0;
  let failList = [];

  for (const model of MODELS) {
    const r = await nvidiaRequest(`/v1/models/${encodeURIComponent(model)}`);
    await new Promise(r => setTimeout(r, 500));
    if (r.status === 200) {
      okCount++;
      log(`[OK] ${model}`);
    } else {
      failCount++;
      failList.push(model);
      log(`[WARN] ${model} 不可用 (HTTP ${r.status})`);
    }
  }

  log(`--- 摘要: ${okCount} 在线 / ${failCount} 离线 ---`);
  if (failCount > 0) {
    sendDiscordAlert(`nVidia NIM 模型离线: ${failList.join(', ')}`);
  }
  log('=== nVidia NIM 巡检结束 ===');
}

checkNvidiaHealth().catch(e => log(`[ERROR] ${e.message}`));
