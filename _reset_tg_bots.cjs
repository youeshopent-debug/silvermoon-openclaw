const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKENS = [
  { name: '银月', token: process.env.TELEGRAM_BOT_TOKEN || '' },
  { name: '药老', token: '8293216457:AAGV3r9GFSp6c5WUO4hWtkWhqkmrb41HsNQ' },
  { name: '墨影', token: '8578069442:AAF2Lxy0iZJDV1xg9TANu16CCv_1_lJGSx0' },
  { name: '小医仙', token: '8417018816:AAGEFSKhBAeEd3skw2XnxbDyK4rwaoVGOSg' },
  { name: '韩立', token: '8615524626:AAEV6UML-bLw3X2IDn_0MLSiP_1V-_tExFA' },
];

function apiCall(token, method) {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ ok: false, error: data.slice(0, 200) }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.end();
  });
}

async function main() {
  console.log('=== 重置所有 Bot Token 的 Telegram Polling 连接 ===\n');
  for (const bot of TOKENS) {
    if (!bot.token || bot.token.length < 10) {
      console.log(`[${bot.name}] 跳过（无 Token）`);
      continue;
    }
    // 1. 获取 Webhook 信息
    const wh = await apiCall(bot.token, 'getWebhookInfo');
    console.log(`[${bot.name}] Webhook:`, wh.ok ? JSON.stringify(wh.result) : wh.error);

    // 2. 删除 Webhook（清除旧连接）
    const del = await apiCall(bot.token, 'deleteWebhook?drop_pending_updates=true');
    console.log(`[${bot.name}] deleteWebhook:`, del.ok ? '✅ 成功' : `❌ ${del.error || del.description}`);

    // 3. 获取 Updates（清空 polling 队列）
    const up = await apiCall(bot.token, 'getUpdates?offset=-1&timeout=1');
    console.log(`[${bot.name}] getUpdates:`, up.ok ? `✅ 成功 (${(up.result || []).length} pending)` : `❌ ${up.error || up.description}`);

    console.log('');
  }
  console.log('=== 全部完成 ===');
  console.log('现在重启银月网关即可消除 409 Conflict');
}

main().catch(console.error);
