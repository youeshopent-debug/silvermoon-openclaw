'use strict';

/**
 * perf-metrics.js — 性能指标采集器
 * 滑动窗口记录请求延迟、错误率、吞吐量，支持按类型聚合和持久化
 *
 * 用法:
 *   const PerfMetrics = require('./lib/perf-metrics');
 *   const perf = new PerfMetrics({ windowSize: 2000 });
 *   perf.record('chat', 45, true);
 *   console.log(perf.getStats());
 */

const fs = require('fs');
const path = require('path');

class PerfMetrics {
  /**
   * @param {Object} options
   * @param {number} [options.windowSize=1000] - 滑动窗口最大记录数
   * @param {number} [options.warnLatencyMs=3000] - 慢请求告警阈值(ms)
   */
  constructor(options = {}) {
    this._windowSize = options.windowSize || 1000;
    this._warnLatencyMs = options.warnLatencyMs || 3000;
    this._records = [];
    this._startTime = Date.now();
    this._resetCounters();
  }

  // ─── 内部计数器重置 ──────────────────────────────────────

  _resetCounters() {
    this._totalRequests = 0;
    this._successCount = 0;
    this._failureCount = 0;
    this._totalDuration = 0;
    this._byType = {};
  }

  // ─── 记录一次请求 ────────────────────────────────────────

  /**
   * @param {string} type - 请求类型: 'health-check' | 'chat' | 'stress-test' | 'cron' | 'tool'
   * @param {number} duration - 耗时(ms)
   * @param {boolean} success - 是否成功
   * @param {Object} [meta] - 额外元数据
   */
  record(type, duration, success, meta = {}) {
    const entry = {
      ts: Date.now(),
      type,
      duration: Math.round(duration),
      success,
      meta,
    };

    this._records.push(entry);
    if (this._records.length > this._windowSize) {
      const removed = this._records.shift();
      // 从byType中移除过期记录
      this._decrementTypeCounter(removed);
    }

    // 更新聚合计数器
    this._totalRequests++;
    this._totalDuration += duration;
    if (success) {
      this._successCount++;
    } else {
      this._failureCount++;
    }

    if (!this._byType[type]) {
      this._byType[type] = { count: 0, success: 0, failure: 0, totalDuration: 0 };
    }
    this._byType[type].count++;
    this._byType[type].totalDuration += duration;
    if (success) {
      this._byType[type].success++;
    } else {
      this._byType[type].failure++;
    }

    // 慢请求告警
    if (duration > this._warnLatencyMs) {
      console.warn(`[perf-metrics] 慢请求: type=${type} duration=${duration}ms meta=${JSON.stringify(meta)}`);
    }

    return entry;
  }

  // ─── 从byType中移除过期记录 ─────────────────────────────

  _decrementTypeCounter(entry) {
    const t = this._byType[entry.type];
    if (!t) return;
    t.count--;
    t.totalDuration -= entry.duration;
    if (entry.success) {
      t.success--;
    } else {
      t.failure--;
    }
    // 清理空类型
    if (t.count <= 0) {
      delete this._byType[entry.type];
    }
  }

  // ─── 排序工具 ──────────────────────────────────────────

  _sortedDurations(filterFn) {
    return this._records
      .filter(filterFn || (() => true))
      .map(r => r.duration)
      .sort((a, b) => a - b);
  }

  // ─── 计算百分位 ──────────────────────────────────────────

  _percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  // ─── 获取统计摘要 ────────────────────────────────────────

  getStats() {
    const allDurations = this._sortedDurations();
    const successDurations = this._sortedDurations(r => r.success);
    const failureDurations = this._sortedDurations(r => !r.success);

    const total = this._records.length;
    const successCount = this._records.filter(r => r.success).length;
    const failureCount = total - successCount;

    const now = Date.now();
    const uptimeMs = now - this._startTime;

    // 吞吐量：最近60秒的请求数
    const recentWindow = 60_000;
    const recentCount = this._records.filter(r => (now - r.ts) <= recentWindow).length;

    // 按类型统计
    const byType = {};
    for (const [type, t] of Object.entries(this._byType)) {
      if (t.count > 0) {
        byType[type] = {
          count: t.count,
          successRate: t.count > 0 ? Math.round((t.success / t.count) * 10000) / 100 : 0,
          avgDuration: t.count > 0 ? Math.round(t.totalDuration / t.count) : 0,
        };
      }
    }

    return {
      total,
      successCount,
      failureCount,
      successRate: total > 0 ? Math.round((successCount / total) * 10000) / 100 : 100,
      avgDuration: allDurations.length > 0 ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length) : 0,
      p50: this._percentile(allDurations, 50),
      p90: this._percentile(allDurations, 90),
      p99: this._percentile(allDurations, 99),
      min: allDurations.length > 0 ? allDurations[0] : 0,
      max: allDurations.length > 0 ? allDurations[allDurations.length - 1] : 0,
      successAvgDuration: successDurations.length > 0
        ? Math.round(successDurations.reduce((a, b) => a + b, 0) / successDurations.length)
        : 0,
      failureAvgDuration: failureDurations.length > 0
        ? Math.round(failureDurations.reduce((a, b) => a + b, 0) / failureDurations.length)
        : 0,
      throughput1m: recentCount,
      uptimeMs,
      uptime: Math.floor(uptimeMs / 1000),
      byType,
      windowSize: this._windowSize,
      windowUsage: Math.round((this._records.length / this._windowSize) * 100),
    };
  }

  // ─── 获取滑动窗口内所有记录 ──────────────────────────────

  getWindow() {
    return [...this._records];
  }

  // ─── 清空数据 ──────────────────────────────────────────

  reset() {
    this._records = [];
    this._startTime = Date.now();
    this._resetCounters();
  }

  // ─── 序列化 ──────────────────────────────────────────

  toJSON() {
    return {
      version: 1,
      windowSize: this._windowSize,
      warnLatencyMs: this._warnLatencyMs,
      startTime: this._startTime,
      records: this._records,
      totalRequests: this._totalRequests,
      successCount: this._successCount,
      failureCount: this._failureCount,
      totalDuration: this._totalDuration,
      byType: this._byType,
    };
  }

  // ─── 持久化到文件 ──────────────────────────────────────

  /**
   * @param {string} filePath - 保存路径
   */
  save(filePath) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[perf-metrics] 保存失败:', e.message);
      return false;
    }
  }

  // ─── 从文件加载 ──────────────────────────────────────────

  /**
   * @param {string} filePath - 加载路径
   * @returns {boolean} 是否成功加载
   */
  load(filePath) {
    try {
      if (!fs.existsSync(filePath)) return false;
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (!data.records || !Array.isArray(data.records)) return false;

      this._windowSize = data.windowSize || this._windowSize;
      this._warnLatencyMs = data.warnLatencyMs || this._warnLatencyMs;
      this._records = data.records.slice(-this._windowSize);
      this._startTime = data.startTime || Date.now();
      this._totalRequests = data.totalRequests || 0;
      this._successCount = data.successCount || 0;
      this._failureCount = data.failureCount || 0;
      this._totalDuration = data.totalDuration || 0;
      this._byType = data.byType || {};

      return true;
    } catch (e) {
      console.error('[perf-metrics] 加载失败:', e.message);
      return false;
    }
  }

  // ─── 获取格式化摘要文本 ──────────────────────────────────

  getSummaryBlock() {
    const s = this.getStats();
    const lines = [
      '【性能指标统计】',
      `  总请求: ${s.total} | 成功率: ${s.successRate}%`,
      `  延迟: avg=${s.avgDuration}ms p50=${s.p50}ms p90=${s.p90}ms p99=${s.p99}ms`,
      `  吞吐: ${s.throughput1m}/min | 窗口: ${s.windowUsage}%`,
      `  运行: ${s.uptime}s`,
    ];
    if (Object.keys(s.byType).length > 0) {
      lines.push('  按类型:');
      for (const [type, t] of Object.entries(s.byType)) {
        lines.push(`    ${type}: ${t.count}次 成功率${t.successRate}% 均值${t.avgDuration}ms`);
      }
    }
    return lines.join('\n');
  }
}

module.exports = PerfMetrics;
