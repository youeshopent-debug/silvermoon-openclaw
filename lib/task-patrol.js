'use strict';

const fs = require('fs');
const path = require('path');
const taskRadar = require('./task-radar');

const PATROL_LOG = path.join(__dirname, '..', 'workspace', 'CRON', 'task_patrol.log');
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;
const MOYING_INTERVAL_MS = 30 * 60 * 1000;
const STUCK_THRESHOLD = 2;

let heartbeatTimer = null;
let moyingTimer = null;
let lastPatrolSnapshot = {};
let onStuckReport = null;
let onHeartbeatPush = null;

function patrolLog(action, detail) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action,
      detail: String(detail).slice(0, 300),
    }) + '\n';
    fs.appendFileSync(PATROL_LOG, line, 'utf8');
  } catch {}
}

function takeSnapshot(tasks) {
  const snap = {};
  for (const t of tasks) {
    snap[t.taskId] = { status: t.status, title: t.title, owner: t.owner };
  }
  return snap;
}

function detectStuckTasks(currentTasks) {
  const stuck = [];
  const currentSnap = takeSnapshot(currentTasks);
  for (const t of currentTasks) {
    if (t.status === 'done' || t.status === 'approved' || t.status === 'review') continue;
    const prev = lastPatrolSnapshot[t.taskId];
    if (prev && prev.status === t.status) {
      t.stuckCount = (t.stuckCount || 0) + 1;
      taskRadar.updateTaskStatus(t.taskId, { stuckCount: t.stuckCount });
      if (t.stuckCount >= STUCK_THRESHOLD) {
        stuck.push(t);
      }
    } else {
      t.stuckCount = 0;
      taskRadar.updateTaskStatus(t.taskId, { stuckCount: 0 });
    }
  }
  lastPatrolSnapshot = currentSnap;
  return stuck;
}

async function heartbeatPatrol() {
  try {
    const tasks = taskRadar.readAllTasks();
    if (tasks.length === 0) {
      patrolLog('HEARTBEAT', 'no active tasks, idle');
      return;
    }
    patrolLog('HEARTBEAT', `scanning ${tasks.length} active tasks`);
    if (typeof onHeartbeatPush === 'function') {
      await onHeartbeatPush(tasks);
    }
  } catch (e) {
    patrolLog('HEARTBEAT_ERR', e.message);
  }
}

async function moyingPatrol() {
  try {
    const tasks = taskRadar.readAllTasks();
    if (tasks.length === 0) {
      patrolLog('MOYING', 'no active tasks, idle');
      return;
    }
    const stuck = detectStuckTasks(tasks);
    patrolLog('MOYING', `tasks:${tasks.length} stuck:${stuck.length}`);
    if (stuck.length > 0 && typeof onStuckReport === 'function') {
      await onStuckReport(stuck, tasks);
    }
  } catch (e) {
    patrolLog('MOYING_ERR', e.message);
  }
}

function startPatrol(callbacks) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (moyingTimer) clearInterval(moyingTimer);

  if (callbacks) {
    if (callbacks.onStuckReport) onStuckReport = callbacks.onStuckReport;
    if (callbacks.onHeartbeatPush) onHeartbeatPush = callbacks.onHeartbeatPush;
  }

  lastPatrolSnapshot = takeSnapshot(taskRadar.readAllTasks());

  heartbeatTimer = setInterval(heartbeatPatrol, HEARTBEAT_INTERVAL_MS);
  moyingTimer = setInterval(moyingPatrol, MOYING_INTERVAL_MS);

  patrolLog('START', `heartbeat:${HEARTBEAT_INTERVAL_MS}ms moying:${MOYING_INTERVAL_MS}ms`);
  heartbeatPatrol();
  moyingPatrol();
}

function stopPatrol() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (moyingTimer) {
    clearInterval(moyingTimer);
    moyingTimer = null;
  }
  patrolLog('STOP', 'patrol stopped');
}

module.exports = {
  startPatrol,
  stopPatrol,
  heartbeatPatrol,
  moyingPatrol,
  patrolLog,
};
