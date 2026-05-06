/**
 * cron.js — 定时任务管理器
 * 管理所有定时任务：早报、夜报、记忆整理、情报收集等
 * 替代原有硬编码在 main.js 中的 setInterval / cron 逻辑
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── 任务注册表 ─────────────────────────────────────────────

/** @type {Map<string, CronTask>} */
const tasks = new Map();

/** @type {Map<string, NodeJS.Timeout>} 运行中的定时器 */
const timers = new Map();

/**
 * @typedef {object} CronTask
 * @property {string}   name       - 任务名称
 * @property {string}   schedule   - 执行时间描述（如 "08:00", "23:55", "every 6h"）
 * @property {Function} handler    - 异步处理函数 () => Promise<void>
 * @property {boolean}  [enabled]  - 是否启用（默认 true）
 * @property {string}   [timezone] - 时区（默认 Asia/Kuala_Lumpur）
 * @property {number}   [_lastRun] - 上次运行时间戳
 */

// ─── 注册任务 ───────────────────────────────────────────────

/**
 * 注册一个定时任务
 * @param {CronTask} task
 */
function register(task) {
  if (!task.name || !task.handler) {
    throw new Error(`[cron] Invalid task: missing name or handler`);
  }
  tasks.set(task.name, {
    ...task,
    enabled: task.enabled !== false,
    timezone: task.timezone || 'Asia/Kuala_Lumpur',
    _lastRun: 0,
  });
  console.log(`[cron] 注册任务: ${task.name} (${task.schedule})`);
}

/**
 * 注册一个基于脚本路径的定时任务
 * 到点自动 require 脚本并调用指定导出函数
 * @param {string} name - 任务名称（唯一）
 * @param {string} schedule - 执行时间，如 "09:00" / "every 6h"
 * @param {string} scriptPath - 脚本路径，相对于项目根目录，如 "lib/news-digest.js"
 * @param {string} [exportFn='fetchNewsDigest'] - 要调用的导出函数名
 * @param {string} [description] - 任务描述
 */
function registerByPath(name, schedule, scriptPath, exportFn = 'fetchNewsDigest', description = '') {
  const absPath = path.resolve(__dirname, '..', scriptPath);
  register({
    name,
    schedule,
    handler: async () => {
      console.log(`[cron] 执行脚本任务: ${name} (${absPath}#${exportFn})`);
      try {
        delete require.cache[absPath];
        const mod = require(absPath);
        if (typeof mod[exportFn] === 'function') {
          const result = await mod[exportFn]();
          const snippet = JSON.stringify(result).slice(0, 200);
          console.log(`[cron] ${name} 完成:`, snippet);
          return result;
        } else {
          console.error(`[cron] ${name}: 导出函数 ${exportFn} 不存在于 ${absPath}`);
        }
      } catch (e) {
        console.error(`[cron] ${name} 执行失败:`, e.message);
      }
    },
    enabled: true,
  });
  console.log(`[cron] 注册脚本任务: ${name} | ${schedule} | ${scriptPath}#${exportFn}`);
}

/**
 * 注册一个定时分派任务（到点自动写 dispatched_tasks.jsonl → dispatch-consumer 投递）
 * @param {string} name - 任务名称（唯一）
 * @param {string} schedule - 执行时间，如 "09:00" / "every 6h"
 * @param {string} target - 目标 Agent 名称
 * @param {string} task - 任务描述内容
 * @param {string} [priority='medium'] - 优先级 high/medium/low
 * @param {string} [description] - 任务描述
 */
function registerByDispatch(name, schedule, target, task, priority = 'medium', description = '') {
  const SILVERMOON_CORE = path.resolve(__dirname, '..', '.silvermoon_core');
  const DISPATCH_LOG = path.join(SILVERMOON_CORE, 'dispatched_tasks.jsonl');

  register({
    name,
    schedule,
    handler: async () => {
      console.log(`[cron] 定时分派: ${name} → ${target}`);
      try {
        const entry = {
          at: new Date().toISOString(),
          target,
          task,
          priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
          status: 'pending',
          source: 'cron_auto',
        };
        fs.mkdirSync(SILVERMOON_CORE, { recursive: true });
        fs.appendFileSync(DISPATCH_LOG, JSON.stringify(entry) + '\n', 'utf-8');
        console.log(`[cron] 定时分派成功: ${name} → ${target}`);
      } catch (e) {
        console.error(`[cron] 定时分派失败 ${name}:`, e.message);
      }
    },
    enabled: true,
  });
  console.log(`[cron] 注册分派任务: ${name} | ${schedule} | → ${target} | ${task.slice(0, 60)}`);
}

// ─── 预设任务模板 ───────────────────────────────────────────

/**
 * 注册常用预设任务
 * 注意：早报/夜报由 main.js 的独立 Scheduler 调度，不在此注册
 * 此处仅注册日志监控类定时任务（记忆整理、情报收集）
 * @param {object} deps - 依赖注入
 * @param {Function} [deps.consolidateMemory]   - 整理记忆
 * @param {Function} [deps.fetchJobIntel]       - 情报收集
 */
function registerPresets(deps = {}) {
  // 记忆整理 — 每 6 小时
  if (deps.consolidateMemory) {
    register({
      name: 'memory_consolidation',
      schedule: 'every 6h',
      handler: async () => {
        console.log('[cron] 执行记忆整理...');
        try {
          await deps.consolidateMemory();
        } catch (e) {
          console.error('[cron] 记忆整理失败:', e.message);
        }
      },
    });
  }

  // 情报收集 — 每 4 小时
  if (deps.fetchJobIntel) {
    register({
      name: 'job_intel',
      schedule: 'every 4h',
      handler: async () => {
        console.log('[cron] 执行情报收集...');
        try {
          await deps.fetchJobIntel();
        } catch (e) {
          console.error('[cron] 情报收集失败:', e.message);
        }
      },
    });
  }
}

// ─── 调度引擎 ───────────────────────────────────────────────

/**
 * 启动所有已注册的定时任务
 * 使用每分钟检查一次的主循环，匹配时间后执行
 */
function startAll() {
  // 清除已有定时器
  stopAll();

  // 主调度循环：每 60 秒检查一次
  const mainLoop = setInterval(() => {
    tick();
  }, 60 * 1000);

  timers.set('__main_loop__', mainLoop);

  // 处理 interval 类任务（every Xh / every Xm）
  for (const [name, task] of tasks.entries()) {
    if (!task.enabled) continue;

    const intervalMs = parseIntervalSchedule(task.schedule);
    if (intervalMs > 0) {
      const timer = setInterval(async () => {
        if (!task.enabled) return;
        console.log(`[cron] 触发间隔任务: ${name}`);
        task._lastRun = Date.now();
        try {
          await task.handler();
        } catch (e) {
          console.error(`[cron] 任务 ${name} 执行出错:`, e.message);
        }
      }, intervalMs);

      timers.set(name, timer);
      console.log(`[cron] 启动间隔任务: ${name} (每 ${intervalMs / 1000}s)`);
    }
  }

  console.log(`[cron] 调度器已启动，${tasks.size} 个任务已加载`);
}

/**
 * 每分钟执行一次的检查：匹配定点任务
 */
function tick() {
  const now = new Date();

  for (const [name, task] of tasks.entries()) {
    if (!task.enabled) continue;

    // 跳过 interval 类任务（已由独立 setInterval 管理）
    if (parseIntervalSchedule(task.schedule) > 0) continue;

    // 检查定点时间
    if (shouldRunAt(task, now)) {
      // 防止同一分钟内重复执行
      const minuteKey = `${now.getHours()}:${now.getMinutes()}`;
      const lastMinuteKey = task._lastRunMinute;
      if (lastMinuteKey === minuteKey) continue;

      task._lastRunMinute = minuteKey;
      task._lastRun = Date.now();
      console.log(`[cron] 触发定点任务: ${name} (${task.schedule})`);

      // 异步执行，不阻塞主循环
      task.handler().catch((e) => {
        console.error(`[cron] 任务 ${name} 执行出错:`, e.message);
      });
    }
  }
}

/**
 * 检查任务是否应该在当前时间执行
 * @param {CronTask} task
 * @param {Date} now
 * @returns {boolean}
 */
function shouldRunAt(task, now) {
  const schedule = String(task.schedule || '').trim();
  const tz = task.timezone || 'Asia/Kuala_Lumpur';

  // 获取目标时区的当前时间
  const localTime = now.toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // 获取目标时区的当前星期几（0=Sun, 1=Mon ... 6=Sat）
  const localDay = now.toLocaleDateString('en-GB', {
    timeZone: tz,
    weekday: 'short',
  });

  // 支持 "Sun 03:00" / "Mon 01:00" 格式（星期+时间）
  const dayTimeMatch = schedule.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2}):(\d{2})$/i);
  if (dayTimeMatch) {
    const dayAbbr = dayTimeMatch[1].charAt(0).toUpperCase() + dayTimeMatch[1].slice(1).toLowerCase();
    const timeStr = `${dayTimeMatch[2].padStart(2, '0')}:${dayTimeMatch[3]}`;
    return localDay === dayAbbr && localTime === timeStr;
  }

  // 简单时间匹配：HH:MM
  const timeMatch = schedule.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    return localTime === schedule.padStart(5, '0');
  }

  return false;
}

/**
 * 解析 interval 格式的 schedule
 * @param {string} schedule - 如 "every 6h", "every 30m"
 * @returns {number} 毫秒数，0 表示不是 interval 格式
 */
function parseIntervalSchedule(schedule) {
  const match = String(schedule || '').match(/every\s+(\d+)\s*(h|m|s)/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === 'h') return num * 3600 * 1000;
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 's') return num * 1000;
  return 0;
}

// ─── 任务管理 ───────────────────────────────────────────────

/**
 * 停止所有定时任务
 */
function stopAll() {
  for (const [name, timer] of timers.entries()) {
    clearInterval(timer);
  }
  timers.clear();
  console.log('[cron] 所有定时任务已停止');
}

/**
 * 启用/禁用指定任务
 * @param {string} name
 * @param {boolean} enabled
 */
function setEnabled(name, enabled) {
  const task = tasks.get(name);
  if (task) {
    task.enabled = enabled;
    console.log(`[cron] 任务 ${name} ${enabled ? '已启用' : '已禁用'}`);

    // 如果禁用 interval 任务，清除对应定时器
    if (!enabled && timers.has(name)) {
      clearInterval(timers.get(name));
      timers.delete(name);
    }
  }
}

/**
 * 手动触发指定任务（用于测试/调试）
 * @param {string} name
 * @returns {Promise<boolean>}
 */
async function triggerManually(name) {
  const task = tasks.get(name);
  if (!task) {
    console.warn(`[cron] 任务不存在: ${name}`);
    return false;
  }
  console.log(`[cron] 手动触发: ${name}`);
  task._lastRun = Date.now();
  try {
    await task.handler();
    return true;
  } catch (e) {
    console.error(`[cron] 手动触发 ${name} 失败:`, e.message);
    return false;
  }
}

/**
 * 获取所有任务状态
 * @returns {Array<object>}
 */
function listTasks() {
  return [...tasks.entries()].map(([name, task]) => ({
    name,
    schedule: task.schedule,
    enabled: task.enabled,
    lastRun: task._lastRun ? new Date(task._lastRun).toISOString() : null,
    isRunning: timers.has(name) || timers.has('__main_loop__'),
  }));
}

/**
 * 注册三层记忆排程脚本
 * 对应 .silvermoon_core/scripts/ 下的三支脚本
 * Microsync: 10:00 / 13:00 / 16:00 / 19:00 / 22:00
 * Daily Wrap-up: 01:00 每天
 * Weekly Compound: Sun 03:00 每周日
 */
function registerMemoryTasks() {
  const SCRIPTS_DIR = require('path').join(__dirname, '..', '.silvermoon_core', 'scripts');
  const scriptRunner = (scriptName) => async () => {
    try {
      console.log(`[cron] 执行记忆脚本: ${scriptName}`);
      require(require('path').join(SCRIPTS_DIR, scriptName));
    } catch (e) {
      console.error(`[cron] 记忆脚本 ${scriptName} 失败:`, e.message);
    }
  };

  // Microsync — 5 次/天
  ['10:00', '13:00', '16:00', '19:00', '22:00'].forEach(time => {
    register({
      name: `microsync_${time.replace(':', '')}`,
      schedule: time,
      handler: scriptRunner('microsync.cjs'),
    });
  });

  // Daily Wrap-up — 每天 01:00
  register({
    name: 'daily_wrapup',
    schedule: '01:00',
    handler: scriptRunner('daily-wrapup.cjs'),
  });

  // Weekly Compound — 每周日 03:00
  register({
    name: 'weekly_compound',
    schedule: 'Sun 03:00',
    handler: scriptRunner('weekly-compound.cjs'),
  });

  console.log('[cron] 三层记忆排程已注册（microsync×5 + daily + weekly）');
}

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  register,
  registerByPath,
  registerByDispatch,
  registerPresets,
  registerMemoryTasks,
  startAll,
  stopAll,
  setEnabled,
  triggerManually,
  listTasks,
};
