'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

class ControlCenter {
  constructor(port = 4310) {
    this.port = port;
    this.heartbeats = [];
    this.agentStatus = {};
    this.agentRoles = {};
    this.maxHeartbeats = 500;
    this.server = null;
    this._startedAt = new Date().toISOString();
  }

  setAgentRoles(roles) {
    this.agentRoles = roles;
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

      if (method === 'GET' && path === '/cultivation') {
        this._serveCultivation(req, res);
        return;
      }

      if (method === 'GET' && path === '/api/agents') {
        this._serveAgentRoles(req, res);
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

  _serveCultivation(req, res) {
    const filePath = path.join(__dirname, '..', 'dashboard', 'cultivation.html');
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('cultivation.html 未找到');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    });
  }

  _serveAgentRoles(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(this.agentRoles));
  }

  _serveDashboard(req, res) {
    const dashboardPath = path.join(__dirname, '..', 'dashboard', 'index.html');
    fs.readFile(dashboardPath, 'utf8', (err, html) => {
      if (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Dashboard 文件未找到，请确认 dashboard/index.html 存在');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    });
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
