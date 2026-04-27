'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const TRADE_LOG_DIR = path.join(__dirname, '..', 'workspace', 'CASHCLAW', 'trades');
const PENDING_APPROVAL_FILE = path.join(TRADE_LOG_DIR, 'pending_approval.json');
const POSITIONS_FILE = path.join(TRADE_LOG_DIR, 'positions_cache.json');
const TRADE_HISTORY_FILE = path.join(TRADE_LOG_DIR, 'trade_history.json');

if (!fs.existsSync(TRADE_LOG_DIR)) {
  fs.mkdirSync(TRADE_LOG_DIR, { recursive: true });
}

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 7890;

const CASHCLAW_PROXY = String(process.env.CASHCLAW_PROXY || '').trim();
const MT4_API_BASE = String(process.env.XIAOYAN_MT4_API_BASE || '').trim();
const MT4_API_KEY = String(process.env.XIAOYAN_MT4_API_KEY || '').trim();

function getProxyConfig() {
  if (CASHCLAW_PROXY) {
    try {
      const u = new URL(CASHCLAW_PROXY);
      return { host: u.hostname, port: parseInt(u.port, 10) || 7890 };
    } catch {}
  }
  return { host: PROXY_HOST, port: PROXY_PORT };
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const mod = options.protocol === 'https:' ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function appendToHistory(entry) {
  const history = [];
  if (fs.existsSync(TRADE_HISTORY_FILE)) {
    try { history.push(...JSON.parse(fs.readFileSync(TRADE_HISTORY_FILE, 'utf8'))); } catch {}
  }
  history.push(entry);
  if (history.length > 200) history.splice(0, history.length - 200);
  fs.writeFileSync(TRADE_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
}

class XiaoyanTradeGuard {

  constructor() {
    this._approvalGate = null;
  }

  setApprovalGate(gate) {
    this._approvalGate = gate;
  }

  async submitTradePlan(plan) {
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry = {
      tradeId,
      status: 'pending_approval',
      plan,
      submittedAt: new Date().toISOString(),
      approvedAt: null,
      response: null,
    };

    fs.writeFileSync(PENDING_APPROVAL_FILE, JSON.stringify(entry, null, 2), 'utf8');

    const planSummary = [
      `📋 **交易计划 #${tradeId}**`,
      ``,
      `**标的**: ${plan.symbol}`,
      `**方向**: ${plan.direction === 'buy' ? '做多 📈' : '做空 📉'}`,
      `**入场点位**: ${plan.entry}`,
      `**止盈**: ${plan.takeProfit}`,
      `**止损**: ${plan.stopLoss}`,
      `**交易量**: ${plan.volume || '待定'}`,
      `**原因**: ${plan.reason}`,
      ``,
      `🛑 **等待主人批准中...**`,
      `请回复 "批准"、"同意" 或 "执行" 以授权交易`,
    ].join('\n');

    if (this._approvalGate) {
      const gatePlan = this._approvalGate.createPlan({
        channelId: plan.channelId || 'unknown',
        requestedBy: plan.requestedBy || 'xiaoyan',
        kind: 'trade',
        args: { tradeId, symbol: plan.symbol, direction: plan.direction, entry: plan.entry },
        reason: `交易计划：${plan.symbol} ${plan.direction} @ ${plan.entry}`,
      });
      if (gatePlan.ok) {
        entry.approvalId = gatePlan.approvalId;
        fs.writeFileSync(PENDING_APPROVAL_FILE, JSON.stringify(entry, null, 2), 'utf8');
      }
    }

    appendToHistory({ type: 'plan_submitted', tradeId, plan, submittedAt: entry.submittedAt });

    return { approved: false, tradeId, planSummary, entry };
  }

  checkApproval() {
    if (!fs.existsSync(PENDING_APPROVAL_FILE)) {
      return { approved: false, entry: null };
    }
    try {
      const entry = JSON.parse(fs.readFileSync(PENDING_APPROVAL_FILE, 'utf8'));
      if (entry.status === 'approved') return { approved: true, entry };
      return { approved: false, entry };
    } catch {
      return { approved: false, entry: null };
    }
  }

  approveTrade(tradeId) {
    if (!fs.existsSync(PENDING_APPROVAL_FILE)) return false;
    try {
      const entry = JSON.parse(fs.readFileSync(PENDING_APPROVAL_FILE, 'utf8'));
      if (entry.tradeId !== tradeId) return false;
      entry.status = 'approved';
      entry.approvedAt = new Date().toISOString();
      entry.response = 'approved';
      fs.writeFileSync(PENDING_APPROVAL_FILE, JSON.stringify(entry, null, 2), 'utf8');
      appendToHistory({ type: 'approved', tradeId, approvedAt: entry.approvedAt });
      return true;
    } catch {
      return false;
    }
  }

  rejectTrade(tradeId, reason) {
    if (!fs.existsSync(PENDING_APPROVAL_FILE)) return false;
    try {
      const entry = JSON.parse(fs.readFileSync(PENDING_APPROVAL_FILE, 'utf8'));
      if (entry.tradeId !== tradeId) return false;
      entry.status = 'rejected';
      entry.response = reason || 'rejected';
      fs.writeFileSync(PENDING_APPROVAL_FILE, JSON.stringify(entry, null, 2), 'utf8');
      appendToHistory({ type: 'rejected', tradeId, reason, rejectedAt: new Date().toISOString() });
      return true;
    } catch {
      return false;
    }
  }

  async executeTrade(plan) {
    const approval = this.checkApproval();
    if (!approval.approved) {
      return { success: false, message: '🛑 交易未获批准！请先提交交易计划并等待主人授权。' };
    }

    const tradeLog = {
      tradeId: approval.entry.tradeId,
      symbol: plan.symbol,
      direction: plan.direction,
      entry: plan.entry,
      takeProfit: plan.takeProfit,
      stopLoss: plan.stopLoss,
      volume: plan.volume,
      executedAt: new Date().toISOString(),
      status: 'executed',
    };

    const logFile = path.join(TRADE_LOG_DIR, `${approval.entry.tradeId}.json`);
    fs.writeFileSync(logFile, JSON.stringify(tradeLog, null, 2), 'utf8');

    if (fs.existsSync(PENDING_APPROVAL_FILE)) {
      fs.unlinkSync(PENDING_APPROVAL_FILE);
    }

    appendToHistory({ type: 'executed', tradeId: approval.entry.tradeId, plan, executedAt: tradeLog.executedAt });

    return { success: true, message: `✅ 交易 ${approval.entry.tradeId} 已执行！标的: ${plan.symbol}, 方向: ${plan.direction}` };
  }

  getPendingSummary() {
    if (!fs.existsSync(PENDING_APPROVAL_FILE)) return null;
    try {
      const entry = JSON.parse(fs.readFileSync(PENDING_APPROVAL_FILE, 'utf8'));
      if (entry.status !== 'pending_approval') return null;
      return entry;
    } catch {
      return null;
    }
  }

  async sendOrderToMT4(order) {
    if (!MT4_API_BASE || !MT4_API_KEY) {
      return { success: false, message: 'MT4/5 未配置（XIAOYAN_MT4_API_BASE / XIAOYAN_MT4_API_KEY）' };
    }

    const approval = this.checkApproval();
    if (!approval.approved) {
      return { success: false, message: '🛑 交易未获批准，禁止发送到 MT4/5！' };
    }

    const proxy = getProxyConfig();
    const body = JSON.stringify({
      apiKey: MT4_API_KEY,
      symbol: order.symbol,
      type: order.direction === 'buy' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
      volume: order.volume || 0.01,
      price: order.entry,
      sl: order.stopLoss,
      tp: order.takeProfit,
      comment: `xiaoyan_${approval.entry.tradeId}`,
    });

    try {
      const resp = await httpRequest({
        hostname: proxy.host,
        port: proxy.port,
        path: MT4_API_BASE,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 15000,
      }, body);

      const logEntry = {
        tradeId: approval.entry.tradeId,
        order,
        mt4Response: resp,
        sentAt: new Date().toISOString(),
      };
      const logFile = path.join(TRADE_LOG_DIR, `mt4_${approval.entry.tradeId}.json`);
      fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2), 'utf8');

      appendToHistory({ type: 'mt4_order_sent', tradeId: approval.entry.tradeId, response: resp.status });

      if (resp.status >= 200 && resp.status < 300) {
        return { success: true, message: `✅ MT4/5 订单已发送，响应: ${JSON.stringify(resp.data)}` };
      }
      return { success: false, message: `❌ MT4/5 返回错误: ${resp.status} ${JSON.stringify(resp.data)}` };
    } catch (err) {
      return { success: false, message: `❌ MT4/5 连接失败: ${err.message}` };
    }
  }

  async getMT4AccountInfo() {
    if (!MT4_API_BASE || !MT4_API_KEY) {
      return { success: false, message: 'MT4/5 未配置' };
    }

    const proxy = getProxyConfig();
    try {
      const resp = await httpRequest({
        hostname: proxy.host,
        port: proxy.port,
        path: `${MT4_API_BASE}/account`,
        method: 'GET',
        headers: { 'X-API-Key': MT4_API_KEY },
        timeout: 10000,
      });

      if (resp.status >= 200 && resp.status < 300) {
        return { success: true, data: resp.data };
      }
      return { success: false, message: `MT4/5 账户查询失败: ${resp.status}` };
    } catch (err) {
      return { success: false, message: `MT4/5 连接失败: ${err.message}` };
    }
  }

  async getOpenPositions() {
    if (!MT4_API_BASE || !MT4_API_KEY) {
      return { success: false, message: 'MT4/5 未配置' };
    }

    const proxy = getProxyConfig();
    try {
      const resp = await httpRequest({
        hostname: proxy.host,
        port: proxy.port,
        path: `${MT4_API_BASE}/positions`,
        method: 'GET',
        headers: { 'X-API-Key': MT4_API_KEY },
        timeout: 10000,
      });

      if (resp.status >= 200 && resp.status < 300) {
        const positions = resp.data;
        fs.writeFileSync(POSITIONS_FILE, JSON.stringify({ positions, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
        return { success: true, data: positions };
      }
      return { success: false, message: `MT4/5 持仓查询失败: ${resp.status}` };
    } catch (err) {
      return { success: false, message: `MT4/5 连接失败: ${err.message}` };
    }
  }

  async closePosition(positionId) {
    if (!MT4_API_BASE || !MT4_API_KEY) {
      return { success: false, message: 'MT4/5 未配置' };
    }

    const approval = this.checkApproval();
    if (!approval.approved) {
      return { success: false, message: '🛑 平仓操作未获批准！' };
    }

    const proxy = getProxyConfig();
    try {
      const resp = await httpRequest({
        hostname: proxy.host,
        port: proxy.port,
        path: `${MT4_API_BASE}/positions/${positionId}`,
        method: 'DELETE',
        headers: { 'X-API-Key': MT4_API_KEY },
        timeout: 10000,
      });

      const logEntry = {
        action: 'close_position',
        positionId,
        response: resp,
        closedAt: new Date().toISOString(),
      };
      const logFile = path.join(TRADE_LOG_DIR, `close_${positionId}_${Date.now()}.json`);
      fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2), 'utf8');

      appendToHistory({ type: 'position_closed', positionId, response: resp.status });

      if (resp.status >= 200 && resp.status < 300) {
        return { success: true, message: `✅ 持仓 ${positionId} 已平仓` };
      }
      return { success: false, message: `❌ 平仓失败: ${resp.status}` };
    } catch (err) {
      return { success: false, message: `❌ 平仓连接失败: ${err.message}` };
    }
  }

  getCachedPositions() {
    if (!fs.existsSync(POSITIONS_FILE)) return null;
    try {
      return JSON.parse(fs.readFileSync(POSITIONS_FILE, 'utf8'));
    } catch {
      return null;
    }
  }

  getTradeHistory(limit = 20) {
    if (!fs.existsSync(TRADE_HISTORY_FILE)) return [];
    try {
      const history = JSON.parse(fs.readFileSync(TRADE_HISTORY_FILE, 'utf8'));
      return history.slice(-limit);
    } catch {
      return [];
    }
  }

  getPortfolioSummary() {
    const positions = this.getCachedPositions();
    const pending = this.getPendingSummary();
    const history = this.getTradeHistory(5);

    return {
      positions: positions?.positions || [],
      positionsUpdatedAt: positions?.updatedAt || null,
      pendingApproval: pending,
      recentTrades: history,
      mt4Configured: !!(MT4_API_BASE && MT4_API_KEY),
    };
  }
}

module.exports = new XiaoyanTradeGuard();
