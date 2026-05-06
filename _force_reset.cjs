const fs = require('fs');
const path = require('path');
const https = require('https');

// 手搓读取 .env，不依赖 dotenv 包
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const proxyUrl = 'http://127.0.0.1:7890';
const proxyParts = new URL(proxyUrl);

async function apiCall(botToken, method, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
    const data = JSON.stringify(payload);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      rejectUnauthorized: false,
      agent: false,
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const bots = [
    { token: env.TELEGRAM_BOT_TOKEN, name: '银月' },
    { token: env.YAOLAO_BOT_TOKEN, name: '药老' },
    { token: env.MOYING_BOT_TOKEN, name: '墨影' },
    { token: env.XIAOYIXIAN_BOT_TOKEN, name: '小医仙' },
    { token: env.HANLI_BOT_TOKEN, name: '韩立' },
  ];
  for (const bot of bots) {
    if (!bot.token) { console.log(`[reset] ${bot.name} 无 Token，跳过`); continue; }
    try {
      const r = await apiCall(bot.token, 'deleteWebhook', { drop_pending_updates: true });
      if (r.ok) {
        console.log(`[reset] ${bot.name} Webhook 已清除`);
        const r2 = await apiCall(bot.token, 'getUpdates', { offset: -1 });
        console.log(`[reset] ${bot.name} getUpdates OK (pending=${(r2.result||[]).length})`);
      } else {
        console.log(`[reset] ${bot.name} 失败: ${r.description}`);
      }
    } catch (e) {
      console.log(`[reset] ${bot.name} 错误: ${e.message}`);
    }
  }
}
main().catch(e => console.error('[reset] 异常:', e.message));
