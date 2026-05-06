const fs = require('fs');
const path = require('path');

const SILVERMOON_CORE = path.join(__dirname, '..', '..', '..', '.silvermoon_core');
const DISPATCH_LOG = path.join(SILVERMOON_CORE, 'dispatched_tasks.jsonl');
const HISTORY_FILE = path.join(SILVERMOON_CORE, 'dispatch_history.jsonl');
const CURSOR_FILE = path.join(SILVERMOON_CORE, '.dispatch_cursor');
const QUEUE_DIR = path.join(SILVERMOON_CORE, 'task_queue');
const HISTORY_CURSOR = path.join(SILVERMOON_CORE, '.history_cursor');

let _timer = null;
let _consumerTimer = null;
let _cursor = 0;
let _historyCursor = 0;
let _running = false;

function ensureDir(d) {
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
}

function loadCursor(fp) {
  try {
    if (!fs.existsSync(fp)) return 0;
    const raw = fs.readFileSync(fp, 'utf-8').trim();
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

function saveCursor(fp, n) {
  try { fs.writeFileSync(fp, String(n), 'utf-8'); } catch {}
}

function normalizeAgentName(name) {
  return String(name || '').replace(/[\s_\-]/g, '').toLowerCase();
}

function writeHistory(record) {
  try {
    ensureDir(SILVERMOON_CORE);
    fs.appendFileSync(HISTORY_FILE, JSON.stringify(record) + '\n', 'utf-8');
  } catch {}
}

function dispatchOne(entry, lineIndex) {
  const target = String(entry.target || '').trim();
  const task = String(entry.task || '').trim();
  const priority = String(entry.priority || 'medium').trim();
  if (!target || !task) return false;

  const normalized = normalizeAgentName(target);
  const queueFile = path.join(QUEUE_DIR, `${normalized}.jsonl`);
  const now = new Date().toISOString();

  const record = {
    at: now,
    source: entry.source || '银月',
    target,
    task,
    priority,
    originalLine: lineIndex,
    originalAt: entry.at || null,
    status: 'pending',
  };

  try {
    ensureDir(QUEUE_DIR);
    fs.appendFileSync(queueFile, JSON.stringify(record) + '\n', 'utf-8');
    writeHistory({ ...record, stage: 'queued', consumedAt: now });
    return true;
  } catch { return false; }
}

function pollDispatchLog() {
  if (_running) return;
  _running = true;
  try {
    if (!fs.existsSync(DISPATCH_LOG)) return;
    const raw = fs.readFileSync(DISPATCH_LOG, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length <= _cursor) return;

    let dispatched = 0;
    for (let i = _cursor; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.status === 'pending') {
          if (dispatchOne(entry, i)) dispatched++;
        }
      } catch {}
    }

    _cursor = lines.length;
    saveCursor(CURSOR_FILE, _cursor);
    if (dispatched > 0) console.log(`[dispatch-consumer] 派发了 ${dispatched} 个任务`);
  } finally {
    _running = false;
  }
}

function pollTaskQueue() {
  try {
    ensureDir(QUEUE_DIR);
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.jsonl'));
    if (!files.length) return;

    for (const file of files) {
      const agentName = path.basename(file, '.jsonl');
      const fp = path.join(QUEUE_DIR, file);
      try {
        const raw = fs.readFileSync(fp, 'utf-8');
        const lines = raw.split('\n').filter(Boolean);
        if (!lines.length) continue;
        for (const line of lines) {
          try {
            const task = JSON.parse(line);
            writeHistory({ ...task, stage: 'consumed', consumedAt: new Date().toISOString() });
          } catch {}
        }
        fs.unlinkSync(fp);
        console.log(`[dispatch-consumer] 已消费 ${agentName} 的 ${lines.length} 个任务`);
      } catch {}
    }
  } catch {}
}

function getDispatchHistory(limit) {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const all = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return all.slice(-(limit || 20));
  } catch { return []; }
}

function startDispatchConsumer(state) {
  if (_timer) return;
  ensureDir(QUEUE_DIR);
  _cursor = loadCursor(CURSOR_FILE);
  pollDispatchLog();
  _timer = setInterval(pollDispatchLog, 10000);
  _consumerTimer = setInterval(pollTaskQueue, 30000);
  if (state) state.dispatchConsumerActive = true;
  console.log('[dispatch-consumer] 已启动 (生产轮询10s, 消费轮询30s)');
}

function stopDispatchConsumer() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  if (_consumerTimer) { clearInterval(_consumerTimer); _consumerTimer = null; }
}

module.exports = { startDispatchConsumer, stopDispatchConsumer, getDispatchHistory };
