'use strict';

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

class OpenClawKeeper {
  constructor(opts = {}) {
    this.mainScript = opts.mainScript || path.join(__dirname, '..', 'main.js');
    this.workDir = opts.workDir || path.join(__dirname, '..');
    this.tgToken = opts.tgToken || '';
    this.tgChatId = opts.tgChatId || '';
    this.checkInterval = opts.checkInterval || 30000;
    this.port = opts.port || 18791;
    this.maxRestarts = opts.maxRestarts || 5;
    this.restartWindow = opts.restartWindow || 300000;

    this.child = null;
    this.restartCount = 0;
    this.firstRestartAt = null;
    this.lastNotifyAt = null;
    this.startTime = new Date();
    this.status = 'stopped';
    this._timer = null;
    this._shuttingDown = false;
  }

  start() {
    console.log(`[Keeper] Starting OpenClaw Keeper`);
    console.log(`[Keeper] Main script: ${this.mainScript}`);
    console.log(`[Keeper] Check interval: ${this.checkInterval}ms`);
    console.log(`[Keeper] Max restarts: ${this.maxRestarts} / ${this.restartWindow}ms`);

    this._log('startup', { pid: process.pid });
    this._spawn();
    this._timer = setInterval(() => this._check(), this.checkInterval);
    this.status = 'running';
    console.log(`[Keeper] Keeper running (PID: ${process.pid})`);
  }

  _spawn() {
    if (this.child) {
      try { this.child.kill('SIGTERM'); } catch {}
      this.child = null;
    }

    console.log(`[Keeper] Spawning: node ${this.mainScript}`);
    this.child = spawn('node', [this.mainScript], {
      cwd: this.workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
      windowsHide: true,
    });

    const pid = this.child.pid;
    console.log(`[Keeper] Spawned PID: ${pid}`);

    this.child.stdout.on('data', (data) => {
      process.stdout.write(`[main:${pid}] ${data}`);
    });

    this.child.stderr.on('data', (data) => {
      process.stderr.write(`[main:${pid}] ${data}`);
    });

    this.child.on('exit', (code, signal) => {
      console.log(`[Keeper] Main process exited (code: ${code}, signal: ${signal})`);
      this.child = null;

      if (this._shuttingDown) {
        console.log(`[Keeper] Shutdown in progress, not restarting`);
        return;
      }

      this._handleCrash(code, signal);
    });

    this.child.on('error', (err) => {
      console.error(`[Keeper] Failed to spawn main process: ${err.message}`);
      if (!this._shuttingDown) {
        this._handleCrash(-1, err.message);
      }
    });

    this._notify(`🚀 银月钱庄网关已启动（PID: ${pid}）`);
  }

  _handleCrash(code, signal) {
    this.status = 'crashed';
    const now = Date.now();

    if (!this.firstRestartAt || (now - this.firstRestartAt) > this.restartWindow) {
      this.restartCount = 0;
      this.firstRestartAt = now;
    }

    this.restartCount++;

    if (this.restartCount > this.maxRestarts) {
      const msg = `💀 网关崩溃超过 ${this.maxRestarts} 次，停止自动重启！`;
      console.error(`[Keeper] ${msg}`);
      this._notify(`🚨 银月钱庄 ${msg}\n最后退出码: ${code}\n信号: ${signal}`);
      this.status = 'dead';
      return;
    }

    const waitMs = Math.min(5000 * this.restartCount, 60000);
    console.log(`[Keeper] Restart ${this.restartCount}/${this.maxRestarts} in ${waitMs}ms`);

    this._notify(
      `⚠️ 银月钱庄网关异常退出（码: ${code}, 信号: ${signal}）\n` +
      `🔄 第 ${this.restartCount}/${this.maxRestarts} 次重启（${waitMs}ms 后）`
    );

    setTimeout(() => this._spawn(), waitMs);
  }

  _check() {
    const mainAlive = this.child !== null && this.child.exitCode === null;
    if (mainAlive) {
      this._httpCheck();
    }
  }

  _httpCheck() {
    const req = http.get(`http://127.0.0.1:${this.port}/health`, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 404) {
        console.log(`[Keeper] Health check returned ${res.statusCode}`);
      }
      res.resume();
    });
    req.on('error', () => {
      // 健康端点可能未注册，不算崩溃
    });
    req.setTimeout(3000, () => req.destroy());
  }

  _notify(text) {
    if (!this.tgToken || !this.tgChatId) return;
    this.lastNotifyAt = new Date();

    const body = JSON.stringify({
      chat_id: this.tgChatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const req = http.request({
      hostname: 'api.telegram.org',
      path: `/bot${this.tgToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    });
    req.on('error', () => {});
    req.write(body);
    req.end();
  }

  _log(event, data) {
    try {
      const logFile = path.join(this.workDir, 'logs', 'keeper.log');
      const dir = path.dirname(logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const line = JSON.stringify({
        t: new Date().toISOString(),
        event,
        ...(data || {}),
      }) + '\n';
      fs.appendFileSync(logFile, line);
    } catch {}
  }

  stop() {
    this._shuttingDown = true;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this.child) {
      console.log(`[Keeper] Sending SIGTERM to main process`);
      this.child.kill('SIGTERM');
      setTimeout(() => {
        if (this.child) {
          try { this.child.kill('SIGKILL'); } catch {}
        }
      }, 10000);
    }
    this.status = 'stopped';
    this._notify('🛑 银月钱庄网关已停止');
  }

  getStatus() {
    return {
      keeperPid: process.pid,
      mainPid: this.child ? this.child.pid : null,
      mainAlive: this.child !== null && this.child.exitCode === null,
      status: this.status,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      lastNotifyAt: this.lastNotifyAt,
    };
  }
}

module.exports = { OpenClawKeeper };
