#!/usr/bin/env node
'use strict';

/**
 * audit-summary.js — 每日审计摘要生成器
 * 汇总 exec-audit、日志、监控数据，生成结构化 JSON 报告
 *
 * 用法:
 *   node scripts/audit-summary.js              # 输出到 logs/audit/daily/YYYY-MM-DD.json
 *   node scripts/audit-summary.js --console    # 同时打印到控制台
 *
 *   作为库:
 *   const audit = require('./scripts/audit-summary');
 *   const report = await audit.generateSummary();
 *   console.log(report);
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const AUDIT_DIR = path.join(LOG_DIR, 'audit', 'daily');
const EXEC_AUDIT_LOG = path.join(ROOT, 'exec-audit.log');
const CRON_WORKSPACE = path.join(ROOT, 'workspace', 'CRON');

// ─── 工具 ──────────────────────────────────────────────────

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); return true; } catch { return false; }
}

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${M}-${d}`;
}

function isToday(ts) {
  try {
    const d = new Date(ts);
    const t = todayStr();
    const y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    return `${y}-${M}-${D}` === t;
  } catch {
    return false;
  }
}

// ─── 今日文件中的行数 ──────────────────────────────────────

function countLines(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    // 读取最后 5MB，避免大文件卡死
    const stat = fs.statSync(filePath);
    const readSize = Math.min(stat.size, 5 * 1024 * 1024);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    const bytesRead = fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);

    const tail = buf.slice(0, bytesRead).toString('utf8');
    return (tail.match(/\n/g) || []).length;
  } catch {
    return 0;
  }
}

// ─── 读取日志并按级别统计 ──────────────────────────────────

function countLogByLevel(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { total: 0, byLevel: {} };

    const stat = fs.statSync(filePath);
    const readSize = Math.min(stat.size, 5 * 1024 * 1024);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(readSize);
    const bytesRead = fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);

    const tail = buf.slice(0, bytesRead).toString('utf8');
    const lines = tail.split('\n').filter(Boolean);

    let total = 0;
    const byLevel = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!isToday(entry.ts)) continue;
        total++;
        const lvl = (entry.level || 'INFO').toUpperCase();
        if (byLevel[lvl] !== undefined) byLevel[lvl]++;
      } catch {
        // 非 JSON 行格式，按文本匹配
        if (line.includes('[ERROR]') || line.includes(' ERROR ')) {
          byLevel.ERROR++;
          total++;
        } else if (line.includes('[WARN]') || line.includes(' WARN ')) {
          byLevel.WARN++;
          total++;
        } else {
          total++;
        }
      }
    }

    return { total, byLevel };
  } catch {
    return { total: 0, byLevel: {} };
  }
}

// ─── 统计今日 CRON 管线执行次数 ────────────────────────────

function countCronRuns() {
  const result = { total: 0, pipelines: {} };
  try {
    if (!fs.existsSync(CRON_WORKSPACE)) {
      return result;
    }

    const entries = fs.readdirSync(CRON_WORKSPACE, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pipelineDir = path.join(CRON_WORKSPACE, entry.name);
      const todayDir = path.join(pipelineDir, todayStr());
      if (!fs.existsSync(todayDir)) continue;

      const files = fs.readdirSync(todayDir).filter(f => f.endsWith('.log') || f.endsWith('.json'));
      result.pipelines[entry.name] = files.length;
      result.total += files.length;
    }
  } catch {
    // 目录可能不存在
  }
  return result;
}

// ─── 读取资源监控告警数 ────────────────────────────────────

function countAlerts(filePath) {
  try {
    if (!fs.existsSync(filePath)) return 0;
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    let alertCount = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (isToday(entry.ts) && entry.level === 'ALERT') {
          alertCount++;
        }
      } catch {
        if (line.includes('ALERT') && isToday(line)) {
          alertCount++;
        }
      }
    }
    return alertCount;
  } catch {
    return 0;
  }
}

// ─── 读取 exec-audit 今日条目 ──────────────────────────────

function countExecAudit() {
  try {
    if (!fs.existsSync(EXEC_AUDIT_LOG)) return 0;
    const raw = fs.readFileSync(EXEC_AUDIT_LOG, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    let count = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.ts && isToday(entry.ts)) count++;
      } catch {
        // 非 JSON 行，跳过
      }
    }
    return count;
  } catch {
    return 0;
  }
}

// ─── 健康状态评估 ──────────────────────────────────────────

function assessHealth(stats) {
  // 健康评分: 基于错误率、告警数
  let score = 100;
  if (stats.totalLogEntries > 0 && stats.errors > 0) {
    const errorRate = stats.errors / stats.totalLogEntries;
    score -= Math.min(50, Math.round(errorRate * 100));
  }
  if (stats.alerts > 5) score -= 10;
  if (stats.alerts > 20) score -= 15;
  if (stats.totalLogEntries === 0) score = 0; // 无日志 = 异常

  let status = 'healthy';
  if (score < 30) status = 'critical';
  else if (score < 60) status = 'degraded';
  else if (score < 80) status = 'warning';

  return { score: Math.max(0, score), status };
}

// ─── 主函数: 生成摘要 ──────────────────────────────────────

/**
 * 生成每日审计摘要报告
 * @returns {Object} 结构化摘要报告
 */
async function generateSummary() {
  const date = todayStr();

  // 1. exec-audit 今日执行次数
  const totalExecutions = countExecAudit();

  // 2. gateway.log 今日条目
  const gatewayLog = path.join(LOG_DIR, 'gateway.log');
  const gatewayStats = countLogByLevel(gatewayLog);

  // 3. resource-monitor 告警
  const resourceLog = path.join(LOG_DIR, 'resource-monitor.log');
  const alerts = countAlerts(resourceLog);

  // 4. CRON 管线执行统计
  const cronStats = countCronRuns();

  // 5. 其他日志统计
  const appLog = path.join(LOG_DIR, 'app.log');
  const appStats = countLogByLevel(appLog);

  const totalLogEntries = gatewayStats.total + appStats.total;
  const errors = (gatewayStats.byLevel.ERROR || 0) + (appStats.byLevel.ERROR || 0);
  const warnings = (gatewayStats.byLevel.WARN || 0) + (appStats.byLevel.WARN || 0);

  const health = assessHealth({ totalLogEntries, errors, alerts });

  const report = {
    date,
    generatedAt: new Date().toISOString(),
    totalExecutions,
    totalLogEntries,
    errors,
    warnings,
    alerts,
    cronRuns: cronStats.total,
    pipelines: cronStats.pipelines,
    byLevel: {
      gateway: gatewayStats.byLevel,
      app: appStats.byLevel,
    },
    health,
    _meta: {
      version: 1,
      source: 'audit-summary.js',
    },
  };

  return report;
}

// ─── 运行入口 ──────────────────────────────────────────────

async function run() {
  const isConsole = process.argv.includes('--console');
  const report = await generateSummary();

  // 写入文件
  ensureDir(AUDIT_DIR);
  const outPath = path.join(AUDIT_DIR, `${report.date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  if (isConsole) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[audit-summary] 摘要已生成: ${outPath}`);
    console.log(`  执行: ${report.totalExecutions} | 日志: ${report.totalLogEntries} | 错误: ${report.errors} | 警告: ${report.warnings} | 告警: ${report.alerts}`);
    console.log(`  CRON管线: ${report.cronRuns} 次 | ${Object.keys(report.pipelines).length} 个管线`);
    console.log(`  健康状态: ${report.health.status} (评分: ${report.health.score})`);
  }

  return report;
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[audit-summary] 生成失败:', e.message);
      process.exit(1);
    });
}

module.exports = { generateSummary, run };
