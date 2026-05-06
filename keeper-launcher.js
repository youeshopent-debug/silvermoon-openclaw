const path = require('path');
const { OpenClawKeeper } = require('./lib/openclaw-keeper');

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8627247747:AAHLCNrw2vIbEZme2zlXDlRr-OXJxPfWmEI';
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const keeper = new OpenClawKeeper({
  mainScript: path.join(__dirname, 'main.js'),
  workDir: __dirname,
  tgToken: TG_TOKEN,
  tgChatId: TG_CHAT_ID,
  checkInterval: 30000,
  port: 18791,
  maxRestarts: 5,
  restartWindow: 300000,
});

keeper.start();

process.on('SIGINT', () => { keeper.stop(); process.exit(0); });
process.on('SIGTERM', () => { keeper.stop(); process.exit(0); });

setInterval(() => {
  const s = keeper.getStatus();
  console.log(`[keeper] 状态: ${s.running ? '🟢 运行中' : '🔴 已停止'} 重启: ${s.restartCount}次`);
}, 60000);
