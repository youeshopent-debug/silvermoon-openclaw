'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HEAL_LOG = path.join(__dirname, '..', '.silvermoon_core', 'self_heal_log.json');

// ─── 熔断配置 ──────────────────────────────────────────────
const CIRCUIT_BREAKER = {
  threshold: 5,          // 同一类型连续 N 次 → 熔断
  cooldownMs: 120_000,   // 熔断冷却 2 分钟
  _state: new Map(),     // type -> { count, trippedAt }
};

// ─── 根因分类器 ────────────────────────────────────────────

const PATTERNS = [
  {
    type: 'network',
    patterns: [/ECONNREFUSED/, /ENOTFOUND/, /ETIMEDOUT/, /fetch failed/, /network error/i, /socket hang up/i, /request timeout/i, /connect ETIMEDOUT/, /read ETIMEDOUT/],
    severity: 'medium',
    repair: 'retry_with_proxy',
    description: '网络连接失败',
  },
  {
    type: 'config',
    patterns: [/ENOENT/, /Cannot find module/, /is not defined/, /invalid json/i, /Unexpected token/, /SyntaxError/],
    severity: 'high',
    repair: 'restart_and_retry',
    description: '配置文件或模块缺失',
  },
  {
    type: 'auth',
    patterns: [/unauthorized/i, /forbidden/i, /invalid key/i, /token expired/i, /401/, /403/, /invalid api key/i],
    severity: 'high',
    repair: 'notify_owner',
    description: '认证授权失败',
  },
  {
    type: 'resource',
    patterns: [/ENOSPC/, /out of memory/i, /heap out of memory/i, /cannot allocate/i, /EMFILE/, /EADDRINUSE/],
    severity: 'critical',
    repair: 'emergency_cleanup',
    description: '系统资源耗尽',
  },
  {
    type: 'logic',
    patterns: [/TypeError/, /ReferenceError/, /undefined is not/, /Cannot read property/, /Cannot read properties/, /Cannot destructure/],
    severity: 'medium',
    repair: 'log_and_continue',
    description: '代码逻辑错误',
  },
  {
    type: 'ollama',
    patterns: [/ollama/i, /model not found/i, /model .* not found/i, /pull model/i, /Ollama/i, /localhost:11434/],
    severity: 'high',
    repair: 'notify_owner',
    description: 'Ollama 模型问题',
  },
  {
    type: 'rate_limit',
    patterns: [/rate limit/i, /too many requests/i, /429/, /quota exceeded/i],
    severity: 'medium',
    repair: 'backoff_retry',
    description: 'API 速率限制',
  },
  {
    type: 'unknown',
    patterns: [/.*/],
    severity: 'low',
    repair: 'log_and_continue',
    description: '未分类错误',
  },
];

function classifyError(errorMessage) {
  for (const rule of PATTERNS) {
    for (const pat of rule.patterns) {
      if (pat.test(errorMessage)) {
        return { type: rule.type, severity: rule.severity, repair: rule.repair, description: rule.description };
      }
    }
  }
  return { type: 'unknown', severity: 'low', repair: 'log_and_continue', description: '未分类错误' };
}

// ─── 熔断检查 ──────────────────────────────────────────────

function isCircuitTripped(type) {
  const entry = CIRCUIT_BREAKER._state.get(type);
  if (!entry) return false;
  if (entry.trippedAt && (Date.now() - entry.trippedAt) > CIRCUIT_BREAKER.cooldownMs) {
    CIRCUIT_BREAKER._state.delete(type); // 冷却过期，自动恢复
    return false;
  }
  return !!entry.trippedAt;
}

function recordFailure(type) {
  const entry = CIRCUIT_BREAKER._state.get(type) || { count: 0, trippedAt: null };
  entry.count++;
  if (entry.count >= CIRCUIT_BREAKER.threshold && !entry.trippedAt) {
    entry.trippedAt = Date.now();
    console.error(`[self-heal] 熔断触发: ${type} (连续 ${entry.count} 次)`);
  }
  CIRCUIT_BREAKER._state.set(type, entry);
}

function recordSuccess(type) {
  const entry = CIRCUIT_BREAKER._state.get(type);
  if (entry && !entry.trippedAt) {
    CIRCUIT_BREAKER._state.delete(type); // 恢复成功，清零
  }
}

// ─── 修复策略执行 ──────────────────────────────────────────

function executeRepair(classification, errorContext = {}) {
  const repair = classification.repair;
  const result = { action: repair, success: false, detail: '' };

  try {
    switch (repair) {
      case 'retry_with_proxy': {
        try {
          const proxyCheck = execSync('curl -s -o /dev/null -w "%{http_code}" --proxy http://127.0.0.1:7890 --connect-timeout 5 https://www.google.com', { timeout: 8000, encoding: 'utf8' });
          result.success = proxyCheck.trim() === '200';
          result.detail = result.success ? '代理连接正常，可重试' : '代理不可用';
        } catch {
          result.detail = '代理检查失败';
        }
        break;
      }
      case 'restart_and_retry': {
        result.detail = '需要重启服务以加载最新配置';
        result.success = true;
        break;
      }
      case 'notify_owner': {
        result.detail = `需要主人介入处理：${classification.description}`;
        result.success = true;
        break;
      }
      case 'emergency_cleanup': {
        try {
          const used = process.memoryUsage();
          const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
          if (global.gc && heapUsedMB > 500) {
            global.gc();
            result.detail = `内存使用 ${heapUsedMB}MB，已触发 GC`;
          } else {
            result.detail = `内存使用 ${heapUsedMB}MB，建议重启`;
          }
          result.success = heapUsedMB < 800;
        } catch (e) {
          result.detail = `清理失败: ${e.message}`;
        }
        break;
      }
      case 'backoff_retry': {
        const waitMs = Math.min(30000, (errorContext.retryCount || 0) * 5000 + 5000);
        result.detail = `等待 ${waitMs}ms 后重试`;
        result.success = true;
        break;
      }
      case 'log_and_continue':
      default: {
        result.detail = '已记录错误，继续运行';
        result.success = true;
        break;
      }
    }
  } catch (e) {
    result.detail = `修复执行异常: ${e.message}`;
  }

  return result;
}

// ─── 日志系统 ──────────────────────────────────────────────

let healCounter = 0;

function logHeal(errorMessage, classification, repairResult, context = {}) {
  healCounter++;
  const log = readLog();
  log.incidents.push({
    id: `heal-${Date.now().toString(36)}-${healCounter}`,
    timestamp: new Date().toISOString(),
    error: (errorMessage || '').slice(0, 500),
    classification,
    repair: repairResult,
    context: JSON.stringify(context).slice(0, 1000),
  });
  if (log.incidents.length > 100) log.incidents = log.incidents.slice(-100);
  log.total_incidents = log.incidents.length;
  log.last_incident_at = new Date().toISOString();
  writeLog(log);
}

function readLog() {
  try {
    if (fs.existsSync(HEAL_LOG)) {
      return JSON.parse(fs.readFileSync(HEAL_LOG, 'utf8'));
    }
  } catch {}
  return { incidents: [], total_incidents: 0, last_incident_at: null };
}

function writeLog(data) {
  try {
    const dir = path.dirname(HEAL_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HEAL_LOG, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[self-heal] write log failed:', e.message);
  }
}

// ─── 重试队列 ──────────────────────────────────────────────

const _retryQueue = [];

function enqueueRetry(fn, context = {}, maxRetries = 3) {
  _retryQueue.push({ fn, context, maxRetries, attempts: 0 });
  return _retryQueue.length;
}

function processRetryQueue() {
  let processed = 0;
  for (let i = _retryQueue.length - 1; i >= 0; i--) {
    const item = _retryQueue[i];
    if (item.attempts >= item.maxRetries) {
      _retryQueue.splice(i, 1);
      console.error(`[self-heal] 重试耗尽，丢弃: ${item.context?.label || 'unknown'}`);
      continue;
    }
    try {
      item.fn();
      _retryQueue.splice(i, 1);
      processed++;
    } catch {
      item.attempts++;
    }
  }
  return processed;
}

function retryQueueLength() {
  return _retryQueue.length;
}

// ─── 主动自愈循环 ──────────────────────────────────────────

let _healTimer = null;
let _onHealCallback = null;

function setOnHealCallback(cb) {
  _onHealCallback = typeof cb === 'function' ? cb : null;
}

function startAutoHeal(intervalMs = 60_000) {
  if (_healTimer) clearInterval(_healTimer);
  _healTimer = setInterval(() => {
    try {
      const result = doAutoHealRound();
      if (_onHealCallback) _onHealCallback(result);
    } catch (e) {
      console.error('[self-heal] autoHeal round error:', e.message);
    }
  }, intervalMs);
  _healTimer.unref();
  console.log(`[self-heal] 主动自愈循环已启动, 间隔 ${intervalMs}ms`);
}

function stopAutoHeal() {
  if (_healTimer) {
    clearInterval(_healTimer);
    _healTimer = null;
  }
}

function doAutoHealRound() {
  const result = {
    retryProcessed: 0,
    circuitBreakerStatus: {},
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };

  // 1. 处理重试队列
  result.retryProcessed = processRetryQueue();

  // 2. 检查熔断状态
  for (const [type, state] of CIRCUIT_BREAKER._state) {
    result.circuitBreakerStatus[type] = {
      count: state.count,
      tripped: !!state.trippedAt,
      remainingMs: state.trippedAt ? Math.max(0, CIRCUIT_BREAKER.cooldownMs - (Date.now() - state.trippedAt)) : 0,
    };
    // 自动恢复过期的熔断
    if (state.trippedAt && (Date.now() - state.trippedAt) > CIRCUIT_BREAKER.cooldownMs) {
      CIRCUIT_BREAKER._state.delete(type);
    }
  }

  // 3. 内存预警
  if (result.memoryMB > 700) {
    console.warn(`[self-heal] 内存预警: ${result.memoryMB}MB`);
    if (global.gc) global.gc();
  }

  return result;
}

// ─── 主要入口 ──────────────────────────────────────────────

function handleError(error, context = {}) {
  const errorMessage = typeof error === 'string' ? error : (error?.message || String(error));
  const classification = classifyError(errorMessage);

  // 熔断检查：如果已熔断，直接返回不执行修复
  if (isCircuitTripped(classification.type)) {
    const result = { action: 'circuit_open', success: false, detail: `熔断中，跳过修复: ${classification.type}` };
    logHeal(errorMessage, classification, result, context);
    return { classification, repair: result, circuited: true };
  }

  const repairResult = executeRepair(classification, context);

  // 记录成败到熔断器
  if (repairResult.success) {
    recordSuccess(classification.type);
  } else {
    recordFailure(classification.type);
  }

  logHeal(errorMessage, classification, repairResult, context);
  return { classification, repair: repairResult, circuited: false };
}

function getHealStats() {
  const log = readLog();
  const typeCount = {};
  let severityCount = { low: 0, medium: 0, high: 0, critical: 0 };
  let repairCount = {};
  for (const inc of log.incidents) {
    const t = inc.classification?.type || 'unknown';
    typeCount[t] = (typeCount[t] || 0) + 1;
    const s = inc.classification?.severity || 'unknown';
    if (severityCount[s] !== undefined) severityCount[s]++;
    const r = inc.repair?.action || 'unknown';
    repairCount[r] = (repairCount[r] || 0) + 1;
  }
  return {
    total: log.total_incidents,
    last: log.last_incident_at,
    byType: typeCount,
    bySeverity: severityCount,
    byRepair: repairCount,
    circuitBreaker: Object.fromEntries(CIRCUIT_BREAKER._state),
    retryQueueLength: _retryQueue.length,
    recent: log.incidents.slice(-5).map(i => ({
      type: i.classification?.type,
      severity: i.classification?.severity,
      repair: i.repair?.action,
      time: i.timestamp,
      error: (i.error || '').slice(0, 100),
    })),
  };
}

function getHealBlock() {
  const stats = getHealStats();
  if (stats.total === 0) return '';
  const lines = [
    '【故障自愈统计】',
    `  总自愈事件: ${stats.total}`,
    `  上次自愈: ${stats.last ? new Date(stats.last).toLocaleString('zh-CN') : '无'}`,
    `  重试队列: ${stats.retryQueueLength} 个待重试`,
    '',
    '  错误类型分布:',
  ];
  for (const [type, count] of Object.entries(stats.byType)) {
    lines.push(`    - ${type}: ${count}次`);
  }
  lines.push('', '  严重程度分布:');
  for (const [sev, count] of Object.entries(stats.bySeverity)) {
    if (count > 0) lines.push(`    - ${sev}: ${count}次`);
  }
  // 熔断状态
  const cbEntries = Object.entries(stats.circuitBreaker);
  if (cbEntries.length > 0) {
    lines.push('', '  熔断状态:');
    for (const [type, state] of cbEntries) {
      lines.push(`    - ${type}: ${state.tripped ? '已熔断(冷却中)' : '计数中'} (${state.count}次)`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  handleError,
  classifyError,
  getHealStats,
  getHealBlock,
  HEAL_LOG,
  // 新增导出
  isCircuitTripped,
  enqueueRetry,
  processRetryQueue,
  retryQueueLength,
  startAutoHeal,
  stopAutoHeal,
  doAutoHealRound,
  setOnHealCallback,
};
