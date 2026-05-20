'use strict';

/**
 * health-dashboard.js — 健康仪表盘HTTP端点
 * 用法:
 *   const dashboard = require('./lib/health-dashboard');
 *   http.createServer(dashboard).listen(19999);
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GATEWAY_PORT = 18791;

// ─── 数据采集 ──────────────────────────────────────────────

function collectSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptime: os.uptime(),
    nodeVersion: process.version,
    pid: process.pid,
    cwd: process.cwd(),
    gatewayPort: GATEWAY_PORT,
  };
}

function collectCPU() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const t in cpu.times) totalTick += cpu.times[t];
    totalIdle += cpu.times.idle;
  }
  // 无缓存时返回近似值
  const usage = Math.round((1 - totalIdle / totalTick) * 100);
  return { usage, cores: cpus.length, model: cpus[0]?.model || 'unknown' };
}

function collectMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalMB: Math.round(total / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    percent: Math.round((used / total) * 100),
  };
}

function collectDisks() {
  const disks = [];
  try {
    const raw = execSync(
      'wmic logicaldisk get size,freespace,caption /format:csv',
      { timeout: 5000, encoding: 'utf8' }
    );
    const lines = raw.trim().split('\n').slice(1);
    for (const line of lines) {
      const parts = line.trim().split(',');
      if (parts.length < 3) continue;
      const caption = (parts[1] || '').trim();
      const freeSpace = BigInt(parts[2] || '0');
      const size = BigInt(parts[3] || '0');
      if (size === 0n) continue;
      disks.push({
        drive: caption,
        totalGB: Number(size / 1073741824n),
        freeGB: Number(freeSpace / 1073741824n),
        percent: Number(((size - freeSpace) * 100n) / size),
      });
    }
  } catch {
    disks.push({ drive: 'N/A', totalGB: 0, freeGB: 0, percent: 0, error: true });
  }
  return disks;
}

function collectProcesses() {
  const list = [];
  try {
    const raw = execSync(
      'tasklist /fo csv /nh /fi "IMAGENAME eq node.exe"',
      { timeout: 5000, encoding: 'utf8' }
    );
    const lines = raw.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.replace(/"/g, '').split(',');
      if (parts.length >= 5) {
        list.push({
          pid: parts[1],
          name: parts[0],
          session: parts[2],
          mem: parts[4],
        });
      }
    }
  } catch {
    list.push({ pid: '-', name: '无法获取', session: '-', mem: '-' });
  }
  return list;
}

function collectGateStatus() {
  try {
    const raw = execSync(
      `netstat -ano | findstr :${GATEWAY_PORT}`,
      { timeout: 3000, encoding: 'utf8' }
    );
    const lines = raw.trim().split('\n').filter(Boolean);
    return { listening: lines.length > 0, lines: lines.length };
  } catch {
    return { listening: false, lines: 0 };
  }
}

// ─── HTML 生成 ──────────────────────────────────────────────

function generateHTML(data) {
  const { sys, cpu, mem, disks, processes, gate, now } = data;

  const ringCSS = (percent, color) => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return `stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke="${color}"`;
  };

  const ringColor = (p) => p > 85 ? '#ff4444' : p > 70 ? '#ffaa00' : '#00e676';

  const memColor = ringColor(mem.percent);
  const cpuColor = ringColor(cpu.usage);

  const diskRows = disks.map(d => {
    const dc = ringColor(d.percent);
    return `
    <div class="card">
      <h3>${d.drive}</h3>
      <svg viewBox="0 0 100 100" class="ring">
        <circle cx="50" cy="50" r="36" class="ring-bg"/>
        <circle cx="50" cy="50" r="36" class="ring-fg"
          stroke-dasharray="${2 * Math.PI * 36}"
          stroke-dashoffset="${2 * Math.PI * 36 * (1 - d.percent / 100)}"
          stroke="${dc}"/>
      </svg>
      <div class="percent">${d.percent}%</div>
      <div class="label">${d.freeGB}G 空闲 / ${d.totalGB}G</div>
      ${d.error ? '<div class="warn">数据不可用</div>' : ''}
    </div>`;
  }).join('');

  const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  const heapTotal = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);

  const uptimeStr = (sec) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const processRows = processes.map(p => `
    <tr>
      <td>${p.pid}</td>
      <td>${p.name}</td>
      <td>${p.session}</td>
      <td>${p.mem}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>银月钱庄 · 系统健康仪表盘</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', monospace;
    background: #0a0e1a;
    color: #c8d6e5;
    padding: 24px;
    min-height: 100vh;
  }
  .header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 20px; border-bottom: 1px solid #1e2a4a; margin-bottom: 24px;
  }
  .header h1 {
    font-size: 22px; font-weight: 600; color: #e8eef5;
    background: linear-gradient(135deg, #00e676, #00bcd4);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .header .time { color: #5a7a9a; font-size: 13px; }
  .header .badge {
    background: #1a2a4a; padding: 4px 14px; border-radius: 12px;
    font-size: 12px; color: #7a9aba;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card {
    background: #111827; border: 1px solid #1e2a4a; border-radius: 12px;
    padding: 20px; text-align: center; position: relative;
  }
  .card h3 { font-size: 14px; color: #5a7a9a; margin-bottom: 12px; font-weight: 500; }
  .card .value { font-size: 28px; font-weight: 700; color: #e8eef5; }
  .card .sub { font-size: 12px; color: #4a6a8a; margin-top: 4px; }
  .card .warn { color: #ff6b6b; font-size: 11px; margin-top: 6px; }
  svg.ring { width: 80px; height: 80px; display: block; margin: 0 auto 8px; transform: rotate(-90deg); }
  .ring-bg { fill: none; stroke: #1e2a4a; stroke-width: 6; }
  .ring-fg { fill: none; stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.6s ease; }
  .percent { font-size: 22px; font-weight: 700; color: #e8eef5; margin-top: -54px; margin-bottom: 34px; }
  .label { font-size: 11px; color: #4a6a8a; }
  .section-title { font-size: 15px; color: #7a9aba; margin: 24px 0 12px; font-weight: 500; }
  table {
    width: 100%; border-collapse: collapse; background: #111827;
    border: 1px solid #1e2a4a; border-radius: 12px; overflow: hidden;
  }
  th { background: #1a2a4a; color: #7a9aba; font-weight: 500; font-size: 12px; padding: 10px 14px; text-align: left; }
  td { padding: 8px 14px; font-size: 13px; border-top: 1px solid #1a2a4a; color: #b0c4d8; }
  tr:hover td { background: #1a2538; }
  .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
  .info-item { background: #111827; border: 1px solid #1e2a4a; border-radius: 8px; padding: 10px 14px; }
  .info-item .key { font-size: 11px; color: #4a6a8a; }
  .info-item .val { font-size: 14px; color: #c8d6e5; margin-top: 2px; font-family: 'Courier New', monospace; }
  .gate-status { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .gate-on { background: #00e676; box-shadow: 0 0 6px #00e67688; }
  .gate-off { background: #ff4444; box-shadow: 0 0 6px #ff444488; }
  .row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 768px) { .row-2col { grid-template-columns: 1fr; } }
  .footer { text-align: center; color: #2a3a5a; font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #1a2a4a; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>银月钱庄 · 系统健康仪表盘</h1>
    <div style="margin-top:4px;color:#4a6a8a;font-size:12px;">
      银月网关 <span class="gate-status ${gate.listening ? 'gate-on' : 'gate-off'}"></span>
      ${gate.listening ? `:${GATEWAY_PORT} 运行中` : `:${GATEWAY_PORT} 未监听`}
    </div>
  </div>
  <div class="badge">${now} · 每30秒自动刷新</div>
</div>

<!-- 环形指标卡片 -->
<div class="grid">
  <div class="card">
    <h3>CPU 使用率</h3>
    <svg viewBox="0 0 100 100" class="ring">
      <circle cx="50" cy="50" r="36" class="ring-bg"/>
      <circle cx="50" cy="50" r="36" class="ring-fg" ${ringCSS(cpu.usage, cpuColor)}/>
    </svg>
    <div class="percent">${cpu.usage}%</div>
    <div class="label">${cpu.cores} 核 · ${cpu.model.split(' ').slice(0,3).join(' ')}</div>
  </div>

  <div class="card">
    <h3>内存使用率</h3>
    <svg viewBox="0 0 100 100" class="ring">
      <circle cx="50" cy="50" r="36" class="ring-bg"/>
      <circle cx="50" cy="50" r="36" class="ring-fg" ${ringCSS(mem.percent, memColor)}/>
    </svg>
    <div class="percent">${mem.percent}%</div>
    <div class="label">${mem.usedMB}MB / ${mem.totalMB}MB</div>
  </div>

  <div class="card">
    <h3>Node 堆内存</h3>
    <svg viewBox="0 0 100 100" class="ring">
      <circle cx="50" cy="50" r="36" class="ring-bg"/>
      <circle cx="50" cy="50" r="36" class="ring-fg"
        stroke-dasharray="${2 * Math.PI * 36}"
        stroke-dashoffset="${2 * Math.PI * 36 * (1 - Math.min(1, heapMB / heapTotal))}"
        stroke="${heapMB > 600 ? '#ff4444' : '#00bcd4'}"/>
    </svg>
    <div class="percent">${heapMB}MB</div>
    <div class="label">已用 / ${heapTotal}MB 总量</div>
  </div>

  <div class="card">
    <h3>系统运行</h3>
    <div class="value">${uptimeStr(sys.uptime)}</div>
    <div class="label">${sys.platform} ${sys.arch}</div>
    <div class="sub">Node ${sys.nodeVersion}</div>
  </div>
</div>

<!-- 磁盘 -->
<h2 class="section-title">磁盘使用率</h2>
<div class="grid">${diskRows}</div>

<!-- 系统信息 + 进程 -->
<div class="row-2col">
  <div>
    <h2 class="section-title">系统信息</h2>
    <div class="info-grid">
      <div class="info-item"><div class="key">主机名</div><div class="val">${sys.hostname}</div></div>
      <div class="info-item"><div class="key">平台</div><div class="val">${sys.platform} ${sys.release}</div></div>
      <div class="info-item"><div class="key">架构</div><div class="val">${sys.arch}</div></div>
      <div class="info-item"><div class="key">Node 版本</div><div class="val">${sys.nodeVersion}</div></div>
      <div class="info-item"><div class="key">PID</div><div class="val">${sys.pid}</div></div>
      <div class="info-item"><div class="key">工作目录</div><div class="val" style="font-size:11px">${sys.cwd}</div></div>
      <div class="info-item"><div class="key">网关端口</div><div class="val">${sys.gatewayPort}</div></div>
      <div class="info-item"><div class="key">CPU 模型</div><div class="val" style="font-size:11px">${cpu.model}</div></div>
    </div>
  </div>

  <div>
    <h2 class="section-title">Node 进程列表 (${processes.length})</h2>
    <table>
      <thead><tr><th>PID</th><th>名称</th><th>会话</th><th>内存</th></tr></thead>
      <tbody>${processRows || '<tr><td colspan="4" style="text-align:center;color:#4a6a8a">无数据</td></tr>'}</tbody>
    </table>
  </div>
</div>

<div class="footer">
  银月钱庄 · OpenClaw 运维面板 · 数据实时采集
</div>

<script>
  setTimeout(() => location.reload(), 30000);
</script>
</body>
</html>`;
}

// ─── HTTP 处理器 ──────────────────────────────────────────

function handler(req, res) {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  try {
    const data = {
      sys: collectSystemInfo(),
      cpu: collectCPU(),
      mem: collectMemory(),
      disks: collectDisks(),
      processes: collectProcesses(),
      gate: collectGateStatus(),
      now: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };

    const html = generateHTML(data);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(html);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`仪表盘生成失败: ${e.message}`);
  }
}

module.exports = handler;
