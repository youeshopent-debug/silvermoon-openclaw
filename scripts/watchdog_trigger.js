const http = require('http');
const https = require('https');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18791';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || '';
const INTERVAL_MS = 30 * 60 * 1000;

function pingGateway() {
  return new Promise((resolve) => {
    const req = http.get(GATEWAY_URL, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

function sendPatrolSignal() {
  if (!DISCORD_WEBHOOK) {
    console.log('[watchdog] 未配置 DISCORD_WEBHOOK，跳过巡店信号');
    return;
  }
  const body = JSON.stringify({
    content: '⏰ 看门狗定时巡检：银月钱庄状态检查',
  });
  const url = new URL(DISCORD_WEBHOOK);
  const client = url.protocol === 'https:' ? https : http;
  const req = client.request(
    url.href,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => { res.resume(); console.log('[watchdog] 巡店信号已发送'); }
  );
  req.on('error', (e) => console.error('[watchdog] 巡店信号发送失败:', e.message));
  req.write(body);
  req.end();
}

async function patrol() {
  console.log(`[watchdog] 巡店检查: ${new Date().toISOString()}`);
  const alive = await pingGateway();
  if (alive) {
    console.log('[watchdog] 银月网关在线');
  } else {
    console.log('[watchdog] 银月网关离线，尝试发送告警');
    sendPatrolSignal();
  }
}

console.log(`[watchdog] 看门狗启动，每 ${INTERVAL_MS / 60000} 分钟巡检一次`);
patrol();
setInterval(patrol, INTERVAL_MS);
