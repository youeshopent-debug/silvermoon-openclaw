/**
 * MT5 桥接安装脚本
 * 1. 复制 EA 到 MT5 Experts 目录
 * 2. 创建 bridge-server 启动快捷方式
 */

const fs = require('fs');
const path = require('path');

const MT5_EXPERTS = 'C:\\Program Files\\MetaTrader 5\\MQL5\\Experts';
const EA_SRC = path.join(__dirname, '..', 'lib', 'mt5-bridge-ea.mq5');
const EA_DST = path.join(MT5_EXPERTS, 'mt5-bridge-ea.mq5');

const BRIDGE_SERVER = path.join(__dirname, '..', 'lib', 'mt5-bridge-server.js');

function main() {
  console.log('=== MT5 桥接安装 ===\n');

  if (!fs.existsSync(MT5_EXPERTS)) {
    console.error('❌ MT5 Experts 目录不存在:', MT5_EXPERTS);
    console.log('   请确认 MT5 已安装');
    process.exit(1);
  }

  fs.copyFileSync(EA_SRC, EA_DST);
  console.log('✅ EA 已复制到:', EA_DST);

  console.log('\n=== 下一步操作 ===');
  console.log('1️⃣  启动桥接服务器:');
  console.log(`   node "${BRIDGE_SERVER}"`);
  console.log('   或在 PowerShell 中运行:');
  console.log('   Start-Process -NoNewWindow node "' + BRIDGE_SERVER + '"');
  console.log('');
  console.log('2️⃣  打开 MT5 → 拖放 mt5-bridge-ea 到图表');
  console.log('   或: 文件 → 打开数据文件夹 → MQL5/Experts → 放入 EA');
  console.log('');
  console.log('3️⃣  在 MT5 中设置:');
  console.log('   工具 → 选项 → Expert Advisors');
  console.log('   ☑ 允许自动交易');
  console.log('   ☑ 允许 WebRequest for URL: http://127.0.0.1:5123');
  console.log('');
  console.log('4️⃣  把 EA 拖到图表上, 输入参数可根据需要调整:');
  console.log('   InpApiKey  → 与 XIAOYAN_MT4_API_KEY 一致');
  console.log('   InpMaxLot  → 最大单笔手数 (默认 0.5)');
  console.log('   InpSymbols → 允许交易的品种');
  console.log('');

  console.log('5️⃣  设置环境变量:');
  console.log('   XIAOYAN_MT4_API_BASE=http://localhost:5123/api/trade');
  console.log('   XIAOYAN_MT4_API_KEY=xiaoyan-mt5-bridge-default');
  console.log('   CASHCLAW_PROXY=http://127.0.0.1:7890');
  console.log('');
  console.log('=== 安装完成 ===');
}

main();
