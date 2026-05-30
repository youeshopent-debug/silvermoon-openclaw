'use strict';
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(ROOT, 'logs', 'gateway.lock');
const WATCHDOG_LOG = path.join(ROOT, 'logs', 'watchdog.log');
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:18791';

const CHECK_INTERVAL_MS = parseInt(process.env.WATCHDOG_CHECK_INTERVAL || '30000', 10);
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

let backoffMs = MIN_BACKOFF_MS;
let mainProc = null;
let shuttingDown = false;
let _startupRetries = 0;
const STARTUP_RETRY_COUNT = 3;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { fs.appendFileSync(WATCHDOG_LOG, line + '\n', 'utf8'); } catch {}
  console.log(line);
}

function getLockPid() {
  try {
    if (!fs.existsSync(LOCK_FILE)) return null;
    const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

function isPidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

function pingGateway() {
  return new Promise((resolve) => {
    const req = http.get(GATEWAY_URL, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function checkHealth() {
  const httpOk = await pingGateway();
  if (httpOk) return true;
  const lockPid = getLockPid();
  if (lockPid && isPidAlive(lockPid)) {
    log(`[看门狗] 锁 PID=${lockPid} 存活但网关无响应，视为僵尸`);
    return false;
  }
  return false;
}

async function spawnGateway() {
  if (shuttingDown) return;
  const httpOk = await pingGateway();
  if (httpOk) {
    log('[看门狗] 网关已在运行，跳过重复启动');
    _startupRetries = 0;
    return;
  }
  const lockPid = getLockPid();
  if (lockPid && isPidAlive(lockPid)) {
    // 进程存在但 HTTP 未就绪 —— 可能是启动中，等待 patrol 重试，不立即杀进程
    if (_startupRetries < STARTUP_RETRY_COUNT) {
      _startupRetries++;
      log(`[看门狗] 等待网关启动 (PID=${lockPid}, 重试 ${_startupRetries}/${STARTUP_RETRY_COUNT})`);
      return;
    }
    log(`[看门狗] 清场: 网关 PID=${lockPid} 连续 ${STARTUP_RETRY_COUNT} 次巡检无响应，视为僵尸重启`);
    try { process.kill(lockPid); } catch {}
    try { fs.unlinkSync(LOCK_FILE); } catch {}
    _startupRetries = 0;
  }
  const child = cp.spawn(process.execPath, [path.join(ROOT, 'main.js')], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
    env: { ...process.env, __SILVERMOON_CHILD__: '1' },
  });
  mainProc = child;

  const childOut = fs.createWriteStream(path.join(ROOT, 'logs', 'wd_child.stdout'), { flags: 'a' });
  const childErr = fs.createWriteStream(path.join(ROOT, 'logs', 'wd_child.stderr'), { flags: 'a' });

  child.stdout.on('data', (d) => childOut.write(d));
  child.stderr.on('data', (d) => childErr.write(d));

  child.on('exit', (code, sig) => {
    childOut.end();
    childErr.end();
    if (!shuttingDown) {
      const sigInfo = sig ? ` signal=${sig}` : '';
      log(`[看门狗] main.js 退出 (code=${code}${sigInfo})，${backoffMs}ms 后重启`);
      setTimeout(() => spawnGateway(), backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  });
  child.on('error', (err) => {
    childOut.end();
    childErr.end();
    if (!shuttingDown) {
      log(`[看门狗] main.js 启动失败: ${err.message}，${backoffMs}ms 后重试`);
      setTimeout(() => spawnGateway(), backoffMs);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  });
  // 写入锁定文件，确保 start-silvermoon.ps1 能正确识别实际 PID
  try { fs.writeFileSync(LOCK_FILE, String(child.pid), 'utf8'); } catch {}
  log(`[看门狗] main.js 已启动 (PID=${child.pid})`);
}

async function patrol() {
  if (shuttingDown) return;
  try {
    const alive = await checkHealth();
    if (alive) {
      backoffMs = MIN_BACKOFF_MS;
    } else {
      log(`[看门狗] 网关离线（lock PID=${getLockPid()}, HTTP ping 失败），启动恢复`);
      if (mainProc) {
        try { mainProc.kill(); } catch {}
        mainProc = null;
      }
      _startupRetries = 0;
      await spawnGateway();
    }
  } catch (err) {
    log(`[看门狗] 巡检异常: ${err.message}`);
  }
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`[看门狗] 收到 ${signal}，正在关闭...`);
  if (mainProc) {
    try { mainProc.kill(); } catch {}
    mainProc = null;
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  log(`[看门狗] 未捕获异常: ${err.message}`);
  shutdown('uncaughtException');
});

log(`[看门狗] 银月钱庄外挂守护启动 (PID=${process.pid})`);
log(`[看门狗] 巡检间隔=${CHECK_INTERVAL_MS}ms, 回退范围=${MIN_BACKOFF_MS}ms~${MAX_BACKOFF_MS}ms`);

spawnGateway();
setInterval(patrol, CHECK_INTERVAL_MS);
