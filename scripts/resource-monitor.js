#!/usr/bin/env node
'use strict';

/**
 * resource-monitor.js — 资源监控CRON脚本
 * 采集CPU/内存/磁盘/进程健康度，超阈值触发告警
 * 用法: node scripts/resource-monitor.js [--interval=60000]
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'resource-monitor.log');

// ─── 阈值配置 ──────────────────────────────────────────────

const THRESHOLDS = {
  cpuPercent: 80,    // CPU 使用率 > 80% 告警
  memPercent: 85,    // 内存使用率 > 85% 告警
  diskPercent: 90,   // 磁盘使用率 > 90% 告警
  heapMB: 600,       // 堆内存 > 600MB 告警
};

// ─── CPU 采集（Windows 兼容）─────────────────────────────

let _prevCpus = null;

function getCPUUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }

  if (_prevCpus) {
    const idleDelta = totalIdle - _prevCpus.idle;
    const tickDelta = totalTick - _prevCpus.tick;
    _prevCpus = { idle: totalIdle, tick: totalTick };
    if (tickDelta === 0) return 0;
    return Math.round((1 - idleDelta / tickDelta) * 100);
  }

  _prevCpus = { idle: totalIdle, tick: totalTick };
  return 0; // 首次采样，返回0
}

// ─── 内存采集 ──────────────────────────────────────────────

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percent = Math.round((used / total) * 100);
  return {
    totalMB: Math.round(total / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    percent,
  };
}

// ─── 磁盘采集（Windows wmic）──────────────────────────────

function getDiskUsage() {
  const disks = [];
  try {
    const raw = execSync(
      'wmic logicaldisk get size,freespace,caption /format:csv',
      { timeout: 5000, encoding: 'utf8' }
    );
    const lines = raw.trim().split('\n').slice(1); // 跳过标题
    for (const line of lines) {
      const parts = line.trim().split(',');
      if (parts.length < 3) continue;
      const caption = (parts[1] || '').trim();
      const freeSpace = BigInt(parts[2] || '0');
      const size = BigInt(parts[3] || '0');
      if (size === 0n) continue;
      const used = size - freeSpace;
      const percent = Number((used * 100n) / size);
      disks.push({
        drive: caption,
        totalGB: Number(size / 1073741824n),
        usedGB: Number(used / 1073741824n),
        freeGB: Number(freeSpace / 1073741824n),
        percent,
      });
    }
  } catch {
    // fallback: 只用当前工作目录所在盘
    const stat = fs.statSync(ROOT);
    disks.push({
      drive: path.parse(ROOT).root,
      totalGB: 0,
      usedGB: 0,
      freeGB: 0,
      percent: 0,
      error: 'wmic不可用，跳过磁盘采集',
    });
  }
  return disks;
}

// ─── 进程健康检查 ──────────────────────────────────────────

function getProcessHealth() {
  const result = { mainJs: false, nodeCount: 0, pids: [] };
  try {
    const raw = execSync(
      'tasklist /fo csv /nh /fi "IMAGENAME eq node.exe"',
      { timeout: 5000, encoding: 'utf8' }
    );
    const lines = raw.trim().split('\n').filter(Boolean);
    result.nodeCount = lines.length;
    for (const line of lines) {
      const parts = line.replace(/"/g, '').split(',');
      if (parts.length > 0) {
        result.pids.push(parts[1] || '?');
      }
    }
    // 检查 main.js 进程
    try {
      const mainRaw = execSync(
        'tasklist /fo csv /nh /fi "WINDOWTITLE eq main.js"',
        { timeout: 5000, encoding: 'utf8' }
      );
      result.mainJs = mainRaw.trim().split('\n').filter(Boolean).length > 0;
    } catch {
      // 换另一种方式检查
      try {
        const netRaw = execSync(
          'netstat -ano | findstr :18791',
          { timeout: 5000, encoding: 'utf8' }
        );
        result.mainJs = netRaw.trim().length > 0;
      } catch {
        result.mainJs = false;
      }
    }
  } catch {
    result.error = '进程检查失败';
  }
  return result;
}

// ─── 告警检查 ──────────────────────────────────────────────

function checkThresholds(cpu, mem, disks, processHealth, heapMB) {
  const alerts = [];

  if (cpu > THRESHOLDS.cpuPercent) {
    alerts.push({ level: 'WARN', module: 'CPU', message: `CPU 使用率 ${cpu}% (阈值 ${THRESHOLDS.cpuPercent}%)` });
  }
  if (mem.percent > THRESHOLDS.memPercent) {
    alerts.push({ level: 'WARN', module: 'MEM', message: `内存使用率 ${mem.percent}% (${mem.usedMB}/${mem.totalMB}MB)` });
  }
  if (heapMB > THRESHOLDS.heapMB) {
    alerts.push({ level: 'WARN', module: 'HEAP', message: `Node 堆内存 ${heapMB}MB (阈值 ${THRESHOLDS.heapMB}MB)` });
  }
  for (const disk of disks) {
    if (disk.percent > THRESHOLDS.diskPercent) {
      alerts.push({ level: 'WARN', module: 'DISK', message: `磁盘 ${disk.drive} 使用率 ${disk.percent}% (${disk.usedGB}/${disk.totalGB}GB)` });
    }
  }
  if (!processHealth.mainJs) {
    alerts.push({ level: 'CRIT', module: 'PROCESS', message: 'main.js 网关进程未检测到' });
  }

  return alerts;
}

// ─── 告警发送 ──────────────────────────────────────────────

async function sendAlert(alert) {
  try {
    const alertFn = require('./alert');
    await alertFn('failure', `monitor-${alert.module}`, alert.message);
  } catch {
    // alert 模块不可用时，直接控制台输出
    const prefix = alert.level === 'CRIT' ? '🚨' : '⚠️';
    console.warn(`${prefix} [${alert.module}] ${alert.message}`);
  }
}

// ─── 日志写入 ──────────────────────────────────────────────

function logResult(data) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] CPU:${data.cpu}% MEM:${data.memPercent}% HEAP:${data.heapMB}MB DISK:${data.disks.map(d => `${d.drive}=${d.percent}%`).join(',')} ALERTS:${data.alerts}`;
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch (e) {
    console.error('[resource-monitor] 日志写入失败:', e.message);
  }
}

// ─── 主函数 ──────────────────────────────────────────────

async function run() {
  const timestamp = new Date().toISOString();
  const cpu = getCPUUsage();
  const mem = getMemoryUsage();
  const disks = getDiskUsage();
  const processHealth = getProcessHealth();
  const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  const data = {
    timestamp,
    cpu,
    memPercent: mem.percent,
    memUsedMB: mem.usedMB,
    memTotalMB: mem.totalMB,
    heapMB,
    disks,
    processHealth,
    hostname: os.hostname(),
    uptime: Math.floor(os.uptime()),
  };

  const alerts = checkThresholds(cpu, mem, disks, processHealth, heapMB);
  data.alerts = alerts.length;

  // 记录日志
  logResult(data);

  // 发送告警
  if (alerts.length > 0) {
    for (const alert of alerts) {
      console.warn(`[resource-monitor] ${alert.level} ${alert.module}: ${alert.message}`);
      await sendAlert(alert);
    }
  } else {
    console.log(`[resource-monitor] OK cpu=${cpu}% mem=${mem.percent}% heap=${heapMB}MB`);
  }

  return data;
}

// ─── 命令行入口 ──────────────────────────────────────────

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    let interval = 0;

    for (const arg of args) {
      const m = arg.match(/^--interval=(\d+)$/);
      if (m) interval = parseInt(m[1], 10);
    }

    if (interval > 0) {
      console.log(`[resource-monitor] 定时模式启动, 间隔 ${interval}ms`);
      await run();
      setInterval(() => {
        run().catch(e => console.error('[resource-monitor] 采集异常:', e.message));
      }, interval);
    } else {
      await run();
    }
  })().catch(e => {
    console.error('[resource-monitor] 致命错误:', e.message);
    process.exit(1);
  });
}

module.exports = { run, getCPUUsage, getMemoryUsage, getDiskUsage, getProcessHealth, checkThresholds };
