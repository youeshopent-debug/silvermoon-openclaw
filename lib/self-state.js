'use strict';

const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', '.silvermoon_core', 'self_state.json');

const DEFAULTS = {
  version: 1,
  uptime_hours: 0,
  queue_depth: 0,
  error_rate_24h: 0,
  total_errors_24h: 0,
  total_calls_24h: 0,
  reflection_count: 0,
  mood: 'normal',
  master_mood_detected: 'neutral',
  task_success_rate_7d: 1.0,
  total_tasks_7d: 0,
  successful_tasks_7d: 0,
  last_reflection_at: null,
  last_plan_effectiveness: 0.5,
  total_tasks_completed: 0,
  last_restart_at: new Date().toISOString(),
  consecutive_errors: 0,
  consecutive_owner_displeasure: 0,
};

let _state = null;

function load() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = fs.readFileSync(STATE_PATH, 'utf8');
      _state = { ...DEFAULTS, ...JSON.parse(raw) };
    } else {
      _state = { ...DEFAULTS };
    }
  } catch {
    _state = { ...DEFAULTS };
  }
  return _state;
}

function save() {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    _state.last_updated = new Date().toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify(_state, null, 2), 'utf8');
  } catch (e) {
    console.error('[self-state] save failed:', e.message);
  }
}

function get(key) {
  if (!_state) load();
  return key ? _state[key] : _state;
}

function set(key, value) {
  if (!_state) load();
  _state[key] = value;
  save();
}

function increment(key, by = 1) {
  if (!_state) load();
  _state[key] = (_state[key] || 0) + by;
  save();
}

function recordCall(success) {
  if (!_state) load();
  _state.total_calls_24h = (_state.total_calls_24h || 0) + 1;
  if (!success) {
    _state.total_errors_24h = (_state.total_errors_24h || 0) + 1;
    _state.consecutive_errors = (_state.consecutive_errors || 0) + 1;
  } else {
    _state.consecutive_errors = 0;
  }
  _state.error_rate_24h = _state.total_calls_24h > 0
    ? _state.total_errors_24h / _state.total_calls_24h
    : 0;
  save();
}

function recordTaskCompletion(success) {
  if (!_state) load();
  _state.total_tasks_7d = (_state.total_tasks_7d || 0) + 1;
  _state.total_tasks_completed = (_state.total_tasks_completed || 0) + 1;
  if (success) {
    _state.successful_tasks_7d = (_state.successful_tasks_7d || 0) + 1;
  }
  _state.task_success_rate_7d = _state.total_tasks_7d > 0
    ? _state.successful_tasks_7d / _state.total_tasks_7d
    : 1.0;
  save();
}

function recordOwnerFeedback(positive) {
  if (!_state) load();
  if (!positive) {
    _state.consecutive_owner_displeasure = (_state.consecutive_owner_displeasure || 0) + 1;
  } else {
    _state.consecutive_owner_displeasure = 0;
  }
  save();
}

function updateMood() {
  if (!_state) load();
  const er = _state.error_rate_24h || 0;
  const cd = _state.consecutive_errors || 0;
  const od = _state.consecutive_owner_displeasure || 0;
  const sr = _state.task_success_rate_7d || 1.0;

  if (od >= 3) _state.mood = 'anxious';
  else if (od >= 1) _state.mood = 'cautious';
  else if (er > 0.3 || cd >= 5) _state.mood = 'stressed';
  else if (er > 0.1 || cd >= 3) _state.mood = 'alert';
  else if (sr < 0.6) _state.mood = 'focused';
  else _state.mood = 'normal';

  save();
  return _state.mood;
}

function buildStateBlock() {
  if (!_state) load();
  updateMood();
  const lines = [
    '【银月自我认知状态】',
    `  运行时长: ${_state.uptime_hours.toFixed(1)}h`,
    `  错误率(24h): ${(_state.error_rate_24h * 100).toFixed(1)}%`,
    `  情绪状态: ${_state.mood}`,
    `  检测到主人情绪: ${_state.master_mood_detected}`,
    `  任务成功率(7d): ${(_state.task_success_rate_7d * 100).toFixed(0)}%`,
    `  连续错误次数: ${_state.consecutive_errors}`,
    `  主人连续不满意: ${_state.consecutive_owner_displeasure}`,
    `  反思次数: ${_state.reflection_count}`,
    `  累计完成任务: ${_state.total_tasks_completed}`,
    `  上次反思: ${_state.last_reflection_at || '从未'}`,
    `  上次重启: ${_state.last_restart_at || '未知'}`,
  ];
  return lines.join('\n');
}

function buildCompactState() {
  if (!_state) load();
  updateMood();
  return `[状态:${_state.mood}|错误率:${(_state.error_rate_24h*100).toFixed(0)}%|成功率:${(_state.task_success_rate_7d*100).toFixed(0)}%|连续错误:${_state.consecutive_errors}|主人连续不满:${_state.consecutive_owner_displeasure}]`;
}

setInterval(() => {
  if (_state) {
    const startTime = _state.last_restart_at ? new Date(_state.last_restart_at).getTime() : Date.now();
    _state.uptime_hours = (Date.now() - startTime) / 3600000;
    save();
  }
}, 60000);

load();

module.exports = {
  load,
  save,
  get,
  set,
  increment,
  recordCall,
  recordTaskCompletion,
  recordOwnerFeedback,
  updateMood,
  buildStateBlock,
  buildCompactState,
  STATE_PATH,
};
