const http = require('http');

class HeartbeatBridge {
  constructor({ controlCenterUrl, gatewayUrl, agentName, reconnectIntervalMs }) {
    this.controlCenterUrl = String(controlCenterUrl || 'http://127.0.0.1:4310').trim()
      .replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    this.gatewayUrl = String(gatewayUrl || '').trim();
    this.agentName = String(agentName || 'silvermoon').trim();
    this.reconnectIntervalMs = typeof reconnectIntervalMs === 'number' ? reconnectIntervalMs : 5000;
    this.connected = false;
    this.lastHeartbeatAt = null;
    this.heartbeatCount = 0;
    this.pendingMessages = [];
    this._pollTimer = null;
  }

  connect() {
    this._loggedError = false;
    this._doPoll();
    this._pollTimer = setInterval(() => this._doPoll(), 30000);
  }

  _doPoll() {
    const url = this.controlCenterUrl.replace(/\/+$/, '');
    const target = url + '/api/status';
    const req = http.get(target, (res) => {
      if (res.statusCode === 200) {
        if (!this.connected) {
          console.log(`[HeartbeatBridge] Connected to control center: ${this.controlCenterUrl}`);
          this._flushPending();
        }
        this._loggedError = false;
        this.connected = true;
      } else {
        this.connected = false;
      }
      res.resume();
    });
    req.on('error', (err) => {
      if (!this._loggedError) {
        console.log(`[HeartbeatBridge] Control center unreachable: ${err?.message || err} (will retry silently)`);
        this._loggedError = true;
      }
      if (this.connected) {
        console.log(`[HeartbeatBridge] Lost connection to control center`);
        this._loggedError = false;
      }
      this.connected = false;
    });
    req.setTimeout(5000, () => {
      if (!this._loggedTimeout) {
        console.log(`[HeartbeatBridge] Control center timeout (will retry silently)`);
        this._loggedTimeout = true;
      }
      req.destroy();
      this.connected = false;
    });
  }

  _flushPending() {
    const pending = this.pendingMessages.splice(0);
    for (const msg of pending) {
      this._httpPost(msg);
    }
  }

  _httpPost(data) {
    const url = this.controlCenterUrl.replace(/\/+$/, '');
    const body = JSON.stringify(data);
    const req = http.request(url + '/api/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Agent-Name': this.agentName,
      },
      timeout: 5000,
    });
    req.on('error', () => {});
    req.write(body);
    req.end();
  }

  send(data) {
    if (!this.connected) {
      this.pendingMessages.push(data);
      if (this.pendingMessages.length > 100) this.pendingMessages.shift();
      return false;
    }
    this._httpPost(data);
    return true;
  }

  sendHeartbeat(reason, extraData) {
    this.heartbeatCount++;
    this.lastHeartbeatAt = new Date();
    const payload = {
      type: 'heartbeat',
      agent: this.agentName,
      reason: String(reason || 'tick'),
      timestamp: new Date().toISOString(),
      sequence: this.heartbeatCount,
      ...(extraData || {}),
    };
    return this.send(payload);
  }

  sendAgentStatus(agents) {
    const statusList = (Array.isArray(agents) ? agents : []).map(a => ({
      name: String(a?.name || a || ''),
      status: a?.status || 'unknown',
      lastActive: a?.lastActive || null,
    }));
    return this.send({
      type: 'agent_status',
      agent: this.agentName,
      agents: statusList,
      timestamp: new Date().toISOString(),
    });
  }

  sendMetrics(metrics) {
    return this.send({
      type: 'metrics',
      agent: this.agentName,
      metrics: metrics || {},
      timestamp: new Date().toISOString(),
    });
  }

  sendTaskProgress(taskData) {
    return this.send({
      type: 'task_progress',
      agent: this.agentName,
      task: taskData || {},
      timestamp: new Date().toISOString(),
    });
  }

  disconnect() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = { HeartbeatBridge };
