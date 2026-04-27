/**
 * openclaw-switch.js — 银月钱庄 · 宗门级高可用降级开关
 * ============================================================
 * 李长寿亲手炼制的"因果切割"阵法，确保任何一个 Agent 报错时，
 * 系统能自动降级而不崩溃，绝不波及整体系统。
 *
 * 核心能力：
 *   1. 断路器模式（Circuit Breaker）：连续失败 N 次后自动熔断
 *   2. 分级降级：按 Agent 优先级决定降级策略
 *   3. 健康探针：定期检测已熔断的 Agent 是否恢复
 *   4. 全链路隔离：每个 Agent 独立状态，互不影响
 *
 * 用法：
 *   const sw = require('./lib/openclaw-switch');
 *   const result = await sw.callWithDegrade('韩立', async () => {
 *     return await someRiskyOperation();
 *   });
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── 断路器状态 ─────────────────────────────────────────────

const STATE = {
  // Agent 断路器状态表
  // { agentName: { failures: 0, lastFailureAt: 0, trippedAt: 0, cooldownUntil: 0, halfOpen: false } }
  breakers: new Map(),

  // 全局降级模式
  globalDegrade: false,

  // 配置
  config: {
    // 连续失败多少次后熔断
    tripThreshold: 3,
    // 熔断后冷却时间（毫秒）
    cooldownMs: 30_000,
    // 半开状态超时（毫秒）
    halfOpenTimeout: 10_000,
    // 健康探针间隔（毫秒）
    probeIntervalMs: 60_000,
  },
};

// ─── Agent 注册表缓存 ───────────────────────────────────────

let _agentRegistry = null;

function getAgentRegistry() {
  if (_agentRegistry) return _agentRegistry;
  _agentRegistry = {};
  const sectsDir = path.resolve(__dirname, '..', 'sects');
  try {
    if (!fs.existsSync(sectsDir)) return _agentRegistry;
    const dirs = fs.readdirSync(sectsDir, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const taskFile = path.join(sectsDir, d.name, 'TASK.json');
      if (!fs.existsSync(taskFile)) continue;
      try {
        const raw = fs.readFileSync(taskFile, 'utf-8');
        const config = JSON.parse(raw);
        _agentRegistry[config.name] = config;
      } catch {}
    }
  } catch {}
  return _agentRegistry;
}

// ─── 断路器核心逻辑 ─────────────────────────────────────────

function getBreaker(agentName) {
  if (!STATE.breakers.has(agentName)) {
    STATE.breakers.set(agentName, {
      failures: 0,
      lastFailureAt: 0,
      trippedAt: 0,
      cooldownUntil: 0,
      halfOpen: false,
    });
  }
  return STATE.breakers.get(agentName);
}

/**
 * 检查 Agent 当前是否可用
 * @param {string} agentName
 * @returns {{ available: boolean, status: string, reason?: string }}
 */
function checkAgent(agentName) {
  const registry = getAgentRegistry();
  const config = registry[agentName];

  // 未注册的 Agent 视为可用（不拦截未知 Agent）
  if (!config) {
    return { available: true, status: 'unknown' };
  }

  const breaker = getBreaker(agentName);
  const now = Date.now();

  // 全局降级模式
  if (STATE.globalDegrade) {
    return {
      available: false,
      status: 'global_degrade',
      reason: '全局降级模式已激活',
      fallback: config.fallback || `${agentName}暂时无可奉告`,
    };
  }

  // 熔断状态
  if (breaker.trippedAt > 0) {
    // 冷却期未过
    if (now < breaker.cooldownUntil) {
      return {
        available: false,
        status: 'tripped',
        reason: `断路器已熔断，冷却中（还剩 ${Math.ceil((breaker.cooldownUntil - now) / 1000)} 秒）`,
        fallback: config.fallback || `${agentName}暂时无可奉告`,
        retryAfter: breaker.cooldownUntil - now,
      };
    }

    // 冷却期已过，进入半开状态
    if (!breaker.halfOpen) {
      breaker.halfOpen = true;
      breaker.halfOpenSince = now;
    }

    // 半开超时
    if (now - breaker.halfOpenSince > STATE.config.halfOpenTimeout) {
      // 超时未恢复，重新熔断
      breaker.trippedAt = now;
      breaker.cooldownUntil = now + STATE.config.cooldownMs;
      breaker.halfOpen = false;
      return {
        available: false,
        status: 'half_open_timeout',
        reason: '半开状态超时，重新熔断',
        fallback: config.fallback || `${agentName}暂时无可奉告`,
      };
    }

    return {
      available: true,
      status: 'half_open',
      reason: '半开状态，允许试探性请求',
    };
  }

  return { available: true, status: 'healthy' };
}

/**
 * 记录 Agent 调用成功
 * @param {string} agentName
 */
function recordSuccess(agentName) {
  const breaker = getBreaker(agentName);
  breaker.failures = 0;
  breaker.lastFailureAt = 0;
  breaker.trippedAt = 0;
  breaker.cooldownUntil = 0;
  breaker.halfOpen = false;
  breaker.halfOpenSince = 0;
}

/**
 * 记录 Agent 调用失败
 * @param {string} agentName
 * @param {Error|string} error
 */
function recordFailure(agentName, error) {
  const breaker = getBreaker(agentName);
  breaker.failures += 1;
  breaker.lastFailureAt = Date.now();

  console.log(
    `[openclaw-switch] ${agentName} 失败 (${breaker.failures}/${STATE.config.tripThreshold}): ${String(error).slice(0, 120)}`
  );

  if (breaker.failures >= STATE.config.tripThreshold) {
    breaker.trippedAt = Date.now();
    breaker.cooldownUntil = Date.now() + STATE.config.cooldownMs;
    breaker.halfOpen = false;
    console.log(
      `[openclaw-switch] ⚠️ ${agentName} 断路器已熔断！冷却 ${STATE.config.cooldownMs / 1000} 秒`
    );
  }
}

/**
 * 带降级保护的 Agent 调用
 * @param {string} agentName - Agent 名称
 * @param {Function} fn - 实际执行函数
 * @param {object} [options]
 * @param {boolean} [options.force] - 强制调用（绕过断路器）
 * @returns {Promise<{ok: boolean, result?: any, error?: string, fallback?: string, degraded: boolean}>}
 */
async function callWithDegrade(agentName, fn, options = {}) {
  const check = checkAgent(agentName);

  // 断路器拦截（除非 force 模式）
  if (!check.available && !options.force) {
    console.log(`[openclaw-switch] 🔒 ${agentName} 被断路器拦截 (${check.status})`);
    return {
      ok: false,
      degraded: true,
      error: check.reason || 'Agent 不可用',
      fallback: check.fallback || `${agentName}暂时无可奉告`,
      status: check.status,
    };
  }

  try {
    const result = await fn();
    recordSuccess(agentName);
    return {
      ok: true,
      result,
      degraded: check.status === 'half_open',
    };
  } catch (err) {
    const errorMsg = String(err?.message || err || '未知错误');
    recordFailure(agentName, errorMsg);

    const registry = getAgentRegistry();
    const config = registry[agentName];

    return {
      ok: false,
      degraded: true,
      error: errorMsg,
      fallback: config?.fallback || `${agentName}暂时无可奉告`,
      status: 'failed',
    };
  }
}

/**
 * 批量调用多个 Agent（全链路隔离）
 * 任何一个 Agent 失败不影响其他 Agent 的执行
 * @param {Array<{name: string, fn: Function, force?: boolean}>} calls
 * @returns {Promise<Object<string, {ok: boolean, result?: any, error?: string, degraded: boolean}>>}
 */
async function batchCallWithDegrade(calls) {
  const results = {};
  const promises = [];

  for (const call of calls) {
    promises.push(
      callWithDegrade(call.name, call.fn, { force: call.force })
        .then((result) => {
          results[call.name] = result;
        })
        .catch((err) => {
          // 极端情况：连断路器本身都炸了
          results[call.name] = {
            ok: false,
            degraded: true,
            error: `断路器异常: ${String(err?.message || err)}`,
            fallback: `${call.name}暂时无可奉告`,
          };
        })
    );
  }

  await Promise.allSettled(promises);
  return results;
}

/**
 * 获取所有 Agent 的健康状态报告
 * @returns {object}
 */
function getHealthReport() {
  const registry = getAgentRegistry();
  const report = {
    globalDegrade: STATE.globalDegrade,
    agents: {},
    summary: { total: 0, healthy: 0, tripped: 0, unknown: 0 },
  };

  for (const [name] of Object.entries(registry)) {
    const status = checkAgent(name);
    report.agents[name] = {
      status: status.status,
      available: status.available,
      failures: getBreaker(name).failures,
      trippedAt: getBreaker(name).trippedAt,
      cooldownUntil: getBreaker(name).cooldownUntil,
    };
    report.summary.total += 1;
    if (status.available) report.summary.healthy += 1;
    else if (status.status === 'tripped') report.summary.tripped += 1;
    else report.summary.unknown += 1;
  }

  return report;
}

/**
 * 手动重置指定 Agent 的断路器
 * @param {string} agentName
 */
function resetBreaker(agentName) {
  const breaker = getBreaker(agentName);
  breaker.failures = 0;
  breaker.lastFailureAt = 0;
  breaker.trippedAt = 0;
  breaker.cooldownUntil = 0;
  breaker.halfOpen = false;
  breaker.halfOpenSince = 0;
  console.log(`[openclaw-switch] ✅ ${agentName} 断路器已手动重置`);
}

/**
 * 重置所有断路器
 */
function resetAllBreakers() {
  for (const [name] of STATE.breakers) {
    resetBreaker(name);
  }
  STATE.globalDegrade = false;
  console.log('[openclaw-switch] ✅ 所有断路器已重置，全局降级已关闭');
}

/**
 * 设置全局降级模式
 * @param {boolean} enabled
 */
function setGlobalDegrade(enabled) {
  STATE.globalDegrade = !!enabled;
  console.log(`[openclaw-switch] 🌐 全局降级模式: ${STATE.globalDegrade ? '已激活' : '已关闭'}`);
}

/**
 * 更新断路器配置
 * @param {object} config
 */
function updateConfig(config = {}) {
  if (config.tripThreshold != null) STATE.config.tripThreshold = config.tripThreshold;
  if (config.cooldownMs != null) STATE.config.cooldownMs = config.cooldownMs;
  if (config.halfOpenTimeout != null) STATE.config.halfOpenTimeout = config.halfOpenTimeout;
  if (config.probeIntervalMs != null) STATE.config.probeIntervalMs = config.probeIntervalMs;
  console.log('[openclaw-switch] ⚙️ 配置已更新:', JSON.stringify(STATE.config));
}

// ─── 健康探针 ───────────────────────────────────────────────

let _probeTimer = null;

/**
 * 启动健康探针（定期检测已熔断的 Agent 是否恢复）
 * @param {Function} probeFn - 探针函数，接收 agentName，返回 Promise<boolean>
 */
function startHealthProbe(probeFn) {
  if (_probeTimer) {
    clearInterval(_probeTimer);
  }

  _probeTimer = setInterval(async () => {
    const registry = getAgentRegistry();
    for (const [name] of Object.entries(registry)) {
      const breaker = getBreaker(name);
      if (breaker.trippedAt === 0) continue;

      try {
        const ok = await probeFn(name);
        if (ok) {
          console.log(`[openclaw-switch] 🔄 ${name} 健康探针成功，恢复服务`);
          resetBreaker(name);
        }
      } catch {
        // 探针失败，保持熔断
      }
    }
  }, STATE.config.probeIntervalMs);

  console.log(`[openclaw-switch] 🔍 健康探针已启动（间隔 ${STATE.config.probeIntervalMs / 1000} 秒）`);
}

/**
 * 停止健康探针
 */
function stopHealthProbe() {
  if (_probeTimer) {
    clearInterval(_probeTimer);
    _probeTimer = null;
    console.log('[openclaw-switch] 🔍 健康探针已停止');
  }
}

module.exports = {
  callWithDegrade,
  batchCallWithDegrade,
  checkAgent,
  getHealthReport,
  resetBreaker,
  resetAllBreakers,
  setGlobalDegrade,
  updateConfig,
  startHealthProbe,
  stopHealthProbe,
  recordSuccess,
  recordFailure,
};