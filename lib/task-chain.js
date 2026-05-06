'use strict';

const fs = require('fs');
const path = require('path');
const cron = require('./cron');
const taskRadar = require('./task-radar');

const CHAIN_DIR = path.join(__dirname, '..', '.silvermoon_core', 'task_chain');
const CHAIN_LOG = path.join(__dirname, '..', 'workspace', 'CRON', 'task_chain.log');

if (!fs.existsSync(CHAIN_DIR)) fs.mkdirSync(CHAIN_DIR, { recursive: true });

let moyingCallback = null;

function chainLog(action, detail) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action,
      detail: String(detail).slice(0, 300),
    }) + '\n';
    fs.appendFileSync(CHAIN_LOG, line, 'utf8');
  } catch {}
}

function generateTaskId() {
  return `chain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function registerCronTask(name, schedule, description) {
  const taskDef = { name, schedule, description, createdAt: new Date().toISOString() };
  const filePath = path.join(CHAIN_DIR, `${name}.chain`);
  fs.writeFileSync(filePath, JSON.stringify(taskDef, null, 2), 'utf8');

  cron.register({
    name: `chain_${name}`,
    schedule: schedule,
    handler: async () => {
      chainLog('CRON_FIRE', `任务 ${name} 触发`);

      const taskId = generateTaskId();
      const taskInfo = {
        taskId,
        title: description || name,
        rawText: `[定时任务] ${description || name}`,
        urgency: 'medium',
        source: 'cron_chain',
        channelId: '',
        authorId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'todo',
        owner: 'unassigned',
        patrolCount: 0,
        stuckCount: 0,
        cronTask: name,
      };

      taskRadar.writeTaskFile(taskInfo);
      chainLog('TASK_CREATED', `taskId=${taskId} name=${name}`);
    },
    enabled: true,
    timezone: 'Asia/Kuala_Lumpur',
  });

  chainLog('REGISTER', `name=${name} schedule=${schedule}`);
  return taskDef;
}

function onMoYing(callback) {
  moyingCallback = callback;
}

async function triggerMoYing(stuckTask, allTasks) {
  if (typeof moyingCallback === 'function') {
    try {
      await moyingCallback(stuckTask, allTasks);
    } catch (e) {
      chainLog('MOYING_ERR', e.message);
    }
  }
}

function listChainTasks() {
  const tasks = [];
  try {
    const files = fs.readdirSync(CHAIN_DIR);
    for (const f of files) {
      if (!f.endsWith('.chain')) continue;
      const raw = fs.readFileSync(path.join(CHAIN_DIR, f), 'utf8');
      tasks.push(JSON.parse(raw));
    }
  } catch {}
  return tasks;
}

function removeChainTask(name) {
  const filePath = path.join(CHAIN_DIR, `${name}.chain`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    chainLog('REMOVE', `name=${name}`);
    return true;
  }
  return false;
}

function buildPatrolCallbacks(originalCallbacks) {
  const wrapped = { ...originalCallbacks };

  if (wrapped.onStuckReport) {
    const origOnStuck = wrapped.onStuckReport;
    wrapped.onStuckReport = async (stuckTasks, allTasks) => {
      chainLog('PATROL_STUCK', `${stuckTasks.length} tasks stuck`);

      for (const task of stuckTasks) {
        if (task.source === 'cron_chain') {
          await triggerMoYing(task, allTasks);
        }
      }

      await origOnStuck(stuckTasks, allTasks);
    };
  }

  chainLog('LINK', 'task-chain callbacks built');
  return wrapped;
}

module.exports = {
  registerCronTask,
  onMoYing,
  triggerMoYing,
  listChainTasks,
  removeChainTask,
  buildPatrolCallbacks,
  CHAIN_DIR,
};
