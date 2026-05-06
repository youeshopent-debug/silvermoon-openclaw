'use strict';

const http = require('http');

class ControlCenter {
  constructor(port = 4310) {
    this.port = port;
    this.heartbeats = [];
    this.agentStatus = {};
    this.maxHeartbeats = 500;
    this.server = null;
    this._startedAt = new Date().toISOString();
  }

  start() {
    this.metricsData = {};
    this.server = http.createServer((req, res) => {
      const method = req.method.toUpperCase();
      const url = new URL(req.url, `http://127.0.0.1:${this.port}`);
      const path = url.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Name');

      if (method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (method === 'GET' && path === '/') {
        this._serveDashboard(req, res);
        return;
      }

      if (method === 'GET' && path === '/api/status') {
        this._serveStatus(req, res);
        return;
      }

      if (method === 'GET' && path === '/api/heartbeats') {
        this._serveHeartbeats(req, res);
        return;
      }

      if (method === 'GET' && path === '/api/metrics') {
        this._serveMetrics(req, res);
        return;
      }

      if (method === 'POST' && path === '/api/heartbeat') {
        this._handleHeartbeat(req, res);
        return;
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'not_found', path }));
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`[ControlCenter] 启动成功 → http://127.0.0.1:${this.port}`);
        resolve();
      });
      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[ControlCenter] 端口 ${this.port} 已被占用，跳过`);
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  _serveDashboard(req, res) {
    const agents = Object.entries(this.agentStatus);
    const recentHeartbeats = this.heartbeats.slice(-20).reverse();

    // 构建指标行
    const metricsEntries = Object.entries(this.metricsData);
    let metricsRows = '<tr><td colspan="6" style="text-align:center;color:#888;">暂无指标数据（需网关连接后自动推送）</td></tr>';
    if (metricsEntries.length) {
      metricsRows = metricsEntries.map(([name, m]) => {
        const t = m.updatedAt ? new Date(m.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '-';
        return `<tr>
          <td>${name}</td>
          <td>${(m.totalTokens ?? '-').toLocaleString()}</td>
          <td>${(m.llmCalls ?? '-').toLocaleString()}</td>
          <td>${(m.totalMessages ?? '-').toLocaleString()}</td>
          <td>${m.avgResponseTimeMs ?? '-'}ms</td>
          <td>${t}</td>
        </tr>`;
      }).join('');
    }

    const agentRows = agents.length
      ? agents.map(([name, info]) => {
          const lastSeen = info.lastHeartbeatAt
            ? new Date(info.lastHeartbeatAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            : '从未';
          const statusColor = info.connected ? '#00ff88' : '#ff4444';
          return `<tr>
            <td>${name}</td>
            <td><span style="color:${statusColor}">●</span> ${info.connected ? '在线' : '离线'}</td>
            <td>${info.heartbeatCount}</td>
            <td>${lastSeen}</td>
            <td>${info.lastReason || '-'}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:#888;">暂无 Agent 心跳数据</td></tr>';

    const heartbeatRows = recentHeartbeats.length
      ? recentHeartbeats.map((hb, i) => {
          const t = new Date(hb.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
          return `<tr>
            <td>${hb.agent || '-'}</td>
            <td>${hb.reason || 'tick'}</td>
            <td>${t}</td>
            <td>#${hb.sequence || '-'}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#888;">暂无心跳记录</td></tr>';

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>银月钱庄 · 控制面板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e0e0e0;padding:20px}
h1{font-size:24px;color:#00d4ff;margin-bottom:8px}
.sub{color:#888;font-size:13px;margin-bottom:24px}
h2{font-size:18px;color:#ccc;margin:20px 0 10px}
table{width:100%;border-collapse:collapse;background:#111;border-radius:8px;overflow:hidden}
th{background:#1a1a2e;padding:10px 12px;text-align:left;font-size:13px;color:#00d4ff;font-weight:600}
td{padding:8px 12px;border-top:1px solid #222;font-size:13px}
tr:hover{background:#1a1a20}
.status-ok{color:#00ff88}
.status-err{color:#ff4444}
.meta{color:#666;font-size:12px;margin-top:16px}
</style>
</head><body>
<h1>🌙 银月钱庄 · 控制面板</h1>
<p class="sub">Control Center — Agent 心跳监控与状态管理</p>
<h2>🤖 Agent 状态</h2>
<table><thead><tr>
<th>Agent</th><th>状态</th><th>心跳数</th><th>最后活跃</th><th>最后原因</th>
</tr></thead><tbody>${agentRows}</tbody></table>
<h2>💓 最近心跳</h2>
<table><thead><tr>
<th>Agent</th><th>原因</th><th>时间</th><th>序列</th>
</tr></thead><tbody>${heartbeatRows}</tbody></table>
<h2>📊 Token 消耗 & 系统指标</h2>
<table><thead><tr>
<th>Agent</th><th>Token 总消耗</th><th>LLM 调用</th><th>消息总数</th><th>平均响应</th><th>更新时间</th>
</tr></thead><tbody>${metricsRows}</tbody></table>
<p class="meta">控制中心已启动: ${new Date(this._startedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} | 总心跳: ${this.heartbeats.length} 次 | 端口: ${this.port}</p>
<script>setTimeout(()=>location.reload(),10000)</script>
</body></html>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  }

  _serveStatus(req, res) {
    const data = {
      ok: true,
      startedAt: this._startedAt,
      uptime: Date.now() - new Date(this._startedAt).getTime(),
      agents: this.agentStatus,
      totalHeartbeats: this.heartbeats.length,
      port: this.port,
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }

  _serveHeartbeats(req, res) {
    const limit = Math.min(parseInt(req.url.split('?')[1]?.split('=')[1]) || 50, 200);
    const data = this.heartbeats.slice(-limit).reverse();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }

  _serveMetrics(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(this.metricsData));
  }

  _handleHeartbeat(req, res) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const agentName = data.agent || req.headers['x-agent-name'] || 'unknown';

        // metrics 类型：存储到 metricsData，不记入心跳表
        if (data.type === 'metrics') {
          this.metricsData[agentName] = {
            ...(data.metrics || {}),
            updatedAt: new Date().toISOString(),
          };
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, agent: agentName }));
          return;
        }

        this.heartbeats.push({
          agent: agentName,
          type: data.type || 'heartbeat',
          reason: data.reason || 'tick',
          timestamp: data.timestamp || new Date().toISOString(),
          sequence: data.sequence || this.heartbeats.length + 1,
        });

        if (this.heartbeats.length > this.maxHeartbeats) {
          this.heartbeats = this.heartbeats.slice(-this.maxHeartbeats);
        }

        if (!this.agentStatus[agentName]) {
          this.agentStatus[agentName] = { connected: true, heartbeatCount: 0, lastHeartbeatAt: null, lastReason: null };
        }
        this.agentStatus[agentName].connected = true;
        this.agentStatus[agentName].heartbeatCount++;
        this.agentStatus[agentName].lastHeartbeatAt = data.timestamp || new Date().toISOString();
        this.agentStatus[agentName].lastReason = data.reason || 'tick';

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, agent: agentName, sequence: this.heartbeats.length }));
      } catch (e) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'invalid_json', detail: e.message }));
      }
    });
  }
}

module.exports = { ControlCenter };
