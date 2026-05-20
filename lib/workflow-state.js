'use strict';

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'user_data', 'memory', 'workflow_state.json');

const DEFAULT_STATE = {
  currentStatus: 'idle',
  currentTask: '',
  pendingTasks: [],
  completedTasks: [],
  lastSessionEnd: null,
  lastUserMessage: '',
  workflowContext: '',
  updatedAt: null
};

function ensureDir(fp) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  try {
    if (!fs.existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) {
    console.error('[workflow-state] load error:', e.message);
    return { ...DEFAULT_STATE };
  }
}

function save(state) {
  try {
    ensureDir(STATE_FILE);
    const data = { ...DEFAULT_STATE, ...state, updatedAt: new Date().toISOString() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[workflow-state] save error:', e.message);
    return false;
  }
}

function getPromptBlock() {
  const st = load();
  if (st.currentStatus === 'idle' && !st.currentTask && st.pendingTasks.length === 0) {
    return '';
  }
  const lines = ['【银月当前工作状态】'];
  lines.push(`- 状态: ${st.currentStatus}`);
  if (st.currentTask) lines.push(`- 当前任务: ${st.currentTask}`);
  if (st.pendingTasks.length) lines.push(`- 待办任务: ${st.pendingTasks.join(' → ')}`);
  if (st.completedTasks.length) {
    const last3 = st.completedTasks.slice(-3);
    lines.push(`- 最近完成: ${last3.join(' → ')}`);
  }
  if (st.lastUserMessage) lines.push(`- 上一条用户消息: ${st.lastUserMessage.slice(0, 200)}`);
  if (st.workflowContext) lines.push(`- 上下文: ${st.workflowContext.slice(0, 500)}`);
  if (st.lastSessionEnd) lines.push(`- 上次会话结束: ${st.lastSessionEnd}`);
  lines.push('请根据以上状态继续推进，不要从头询问用户。');
  return '\n' + lines.join('\n');
}

function markStart(task, ctx) {
  const st = load();
  st.currentStatus = 'working';
  if (task) st.currentTask = task;
  if (ctx) st.workflowContext = ctx;
  return save(st);
}

function markDone(task) {
  const st = load();
  st.currentStatus = 'idle';
  if (task && st.currentTask === task) {
    st.completedTasks.push(task);
    if (st.completedTasks.length > 50) st.completedTasks = st.completedTasks.slice(-50);
  }
  st.currentTask = '';
  return save(st);
}

function markWaiting(task) {
  const st = load();
  st.currentStatus = 'waiting';
  if (task) st.currentTask = task;
  return save(st);
}

function addPending(task) {
  const st = load();
  if (!st.pendingTasks.includes(task)) st.pendingTasks.push(task);
  return save(st);
}

function removePending(task) {
  const st = load();
  st.pendingTasks = st.pendingTasks.filter(t => t !== task);
  return save(st);
}

function recordUserMessage(msg) {
  const st = load();
  st.lastUserMessage = (msg || '').slice(0, 500);
  return save(st);
}

function sessionEnd() {
  const st = load();
  st.lastSessionEnd = new Date().toISOString();
  st.currentStatus = 'idle';
  return save(st);
}

module.exports = {
  load,
  save,
  getPromptBlock,
  markStart,
  markDone,
  markWaiting,
  addPending,
  removePending,
  recordUserMessage,
  sessionEnd,
  DEFAULT_STATE
};
