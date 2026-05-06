// 银月钱庄 · Zero Token 看门狗 (Node.js 静默版)
// 每 60 秒检查一次，断线自动重启
// 无窗口弹窗，日志写入文件

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const INTERVAL_MS = 60_000;
const LOG_DIR = path.join(process.env.USERPROFILE, '.openclaw', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'watchdog-zero-token.log');
const SCRIPT_DIR = path.join(process.env.USERPROFILE, '.openclaw', '.silvermoon_core');
const WSL_DISTRO = 'Ubuntu';
const ZT_PORT = 3001;
const SM_PORT = 18791;

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `${t} [watchdog] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf-8');
  // 同时输出到 stderr（不会弹窗），方便调试
  process.stderr.write(`[watchdog] ${msg}\n`);
}

function isZeroTokenAlive() {
  try {
    const out = execSync(
      `wsl -d ${WSL_DISTRO} -u alan bash -c "source ~/.nvm/nvm.sh && lsof -i :${ZT_PORT} 2>/dev/null | grep LISTEN | head -1"`,
      { timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    ).toString().trim();
    return out.length > 0;
  } catch { return false; }
}

function isSilvermoonAlive() {
  try {
    const out = execSync(
      `netstat -ano 2>nul | findstr ":${SM_PORT}" | findstr "LISTENING"`,
      { timeout: 5_000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    ).toString().trim();
    return out.length > 0;
  } catch { return false; }
}

function restartZeroToken() {
  try {
    const script = path.join(SCRIPT_DIR, 'start-zero-token.ps1');
    if (fs.existsSync(script)) {
      execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" -Action start`,
        { timeout: 30_000, stdio: 'pipe', windowsHide: true }
      );
      log('✅ Zero Token 重启命令已发送');
    } else {
      log('❌ 找不到 start-zero-token.ps1');
    }
  } catch (e) {
    log(`❌ Zero Token 重启失败: ${e.message}`);
  }
}

function restartSilvermoon() {
  try {
    const script = path.join(process.env.USERPROFILE, '.openclaw', 'start-silvermoon.ps1');
    if (fs.existsSync(script)) {
      execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${script}"`,
        { timeout: 30_000, stdio: 'pipe', windowsHide: true }
      );
      log('✅ 银月重启命令已发送');
    } else {
      log('❌ 找不到 start-silvermoon.ps1');
    }
  } catch (e) {
    log(`❌ 银月重启失败: ${e.message}`);
  }
}

log('=== 看门狗启动 (间隔: ' + (INTERVAL_MS / 1000) + 's) ===');

function tick() {
  // 检查 Zero Token
  const ztAlive = isZeroTokenAlive();
  if (!ztAlive) {
    log('⚠️ Zero Token 断线！尝试重启...');
    restartZeroToken();
    setTimeout(() => {
      if (isZeroTokenAlive()) log('✅ Zero Token 已恢复');
      else log('❌ Zero Token 恢复失败');
    }, 10_000);
  }

  // 检查银月
  const smAlive = isSilvermoonAlive();
  if (!smAlive) {
    log('⚠️ 银月断线！尝试重启...');
    restartSilvermoon();
    setTimeout(() => {
      if (isSilvermoonAlive()) log('✅ 银月已恢复');
      else log('❌ 银月恢复失败');
    }, 10_000);
  }
}

// 首次执行
tick();
// 定时循环
setInterval(tick, INTERVAL_MS);

// 优雅退出
process.on('SIGINT', () => { log('=== 看门狗停止 ==='); process.exit(0); });
process.on('SIGTERM', () => { log('=== 看门狗停止 ==='); process.exit(0); });
