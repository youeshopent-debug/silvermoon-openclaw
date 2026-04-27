'use strict';

const fs = require('fs');
const path = require('path');

const ACTIVE_TASKS_DIR = path.join(__dirname, '..', 'active_tasks');
const TASK_LOG = path.join(__dirname, '..', 'workspace', 'CRON', 'task_radar.log');

if (!fs.existsSync(ACTIVE_TASKS_DIR)) {
  fs.mkdirSync(ACTIVE_TASKS_DIR, { recursive: true });
}

const TASK_TRIGGERS = /(?:任务|去办|帮我|请帮我|我需要|我要|我想|给我|做一下|搞一下|弄一下|写一个|创建一个|生成一个|部署|配置|修改|检查|监控|查一下|找一下|看一下)/i;

const URGENCY_KEYWORDS = {
  high: [/紧急|立刻|马上|立即|加急|urgent|asap|immediately/i],
  medium: [/尽快|尽快|今天|today|soon/i],
  low: [/有空|不急|随便|有空时|whenever|later/i],
};

function detectUrgency(text) {
  for (const [level, patterns] of Object.entries(URGENCY_KEYWORDS)) {
    for (const p of patterns) {
      if (p.test(text)) return level;
    }
  }
  return 'medium';
}

function extractTaskInfo(text, meta) {
  const urgency = detectUrgency(text);
  const lines = text.split('\n').filter(Boolean);
  const title = lines[0] && lines[0].length > 10 ? lines[0].slice(0, 80) : text.slice(0, 80);
  const cleanTitle = title.replace(TASK_TRIGGERS, '').trim() || 'untitled_task';
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    taskId,
    title: cleanTitle.slice(0, 120),
    rawText: text.slice(0, 500),
    urgency,
    source: meta.source || 'unknown',
    channelId: meta.channelId || '',
    authorId: meta.authorId || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'todo',
    owner: meta.owner || 'unassigned',
    patrolCount: 0,
    stuckCount: 0,
  };
}

function writeTaskFile(taskInfo) {
  const filePath = path.join(ACTIVE_TASKS_DIR, `${taskInfo.taskId}.task`);
  fs.writeFileSync(filePath, JSON.stringify(taskInfo, null, 2), 'utf8');
  appendLog('CREATE', taskInfo.taskId, taskInfo.title);
  return filePath;
}

function readAllTasks() {
  const tasks = [];
  try {
    const files = fs.readdirSync(ACTIVE_TASKS_DIR);
    for (const f of files) {
      if (!f.endsWith('.task')) continue;
      try {
        const raw = fs.readFileSync(path.join(ACTIVE_TASKS_DIR, f), 'utf8');
        tasks.push(JSON.parse(raw));
      } catch {}
    }
  } catch {}
  return tasks;
}

function updateTaskStatus(taskId, updates) {
  const filePath = path.join(ACTIVE_TASKS_DIR, `${taskId}.task`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const task = JSON.parse(raw);
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    fs.writeFileSync(filePath, JSON.stringify(task, null, 2), 'utf8');
    appendLog('UPDATE', taskId, updates.status || 'modified');
    return task;
  } catch {
    return null;
  }
}

function removeTaskFile(taskId) {
  const filePath = path.join(ACTIVE_TASKS_DIR, `${taskId}.task`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    appendLog('REMOVE', taskId, 'approved_and_archived');
    return true;
  }
  return false;
}

function clearAllTasks() {
  let count = 0;
  try {
    const files = fs.readdirSync(ACTIVE_TASKS_DIR);
    for (const f of files) {
      if (f.endsWith('.task')) {
        fs.unlinkSync(path.join(ACTIVE_TASKS_DIR, f));
        count++;
      }
    }
  } catch {}
  appendLog('CLEAR_ALL', '', `cleared ${count} tasks`);
  return count;
}

function appendLog(action, taskId, detail) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action,
      taskId,
      detail: String(detail).slice(0, 200),
    }) + '\n';
    fs.appendFileSync(TASK_LOG, line, 'utf8');
  } catch {}
}

function scanTextForTask(text, meta) {
  if (!TASK_TRIGGERS.test(text)) return null;
  const taskInfo = extractTaskInfo(text, meta);
  writeTaskFile(taskInfo);
  return taskInfo;
}

module.exports = {
  ACTIVE_TASKS_DIR,
  scanTextForTask,
  extractTaskInfo,
  writeTaskFile,
  readAllTasks,
  updateTaskStatus,
  removeTaskFile,
  clearAllTasks,
  appendLog,
};
