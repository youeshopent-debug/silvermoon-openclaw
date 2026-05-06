const fs = require('fs');
const path = require('path');

const CORE_DIR = path.join(__dirname, '..', '.silvermoon_core');
const QUEUE_DIR = path.join(CORE_DIR, 'task_queue');
const PROCESSED_DIR = path.join(CORE_DIR, 'task_done');

let _timer = null;
let _handler = null;

function ensureDir(d) {
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
}

function readTasks(agentName) {
  const fp = path.join(QUEUE_DIR, `${agentName}.jsonl`);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    return raw.split('\n').filter(Boolean).map((l, i) => {
      try { return { ...JSON.parse(l), _lineIdx: i }; } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function clearQueue(agentName) {
  const fp = path.join(QUEUE_DIR, `${agentName}.jsonl`);
  try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
}

function archiveTasks(agentName, tasks) {
  if (!tasks.length) return;
  ensureDir(PROCESSED_DIR);
  const fp = path.join(PROCESSED_DIR, `${agentName}.jsonl`);
  try {
    const lines = tasks.map(t => JSON.stringify({
      ...t,
      _consumedAt: new Date().toISOString(),
      _status: 'consumed',
    }));
    fs.appendFileSync(fp, lines.join('\n') + '\n', 'utf-8');
  } catch {}
}

function poll() {
  try {
    ensureDir(QUEUE_DIR);
    const files = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.jsonl'));
    if (!files.length) return;

    for (const file of files) {
      const agentName = path.basename(file, '.jsonl');
      const tasks = readTasks(agentName);
      if (!tasks.length) continue;

      console.log(`[task-watcher] ${agentName} 有 ${tasks.length} 个待处理任务`);
      for (const t of tasks) {
        console.log(`[task-watcher]   → [${t.priority || 'medium'}] ${t.task} (来源: ${t.source || '银月'})`);
        if (typeof _handler === 'function') {
          try {
            _handler({ agent: agentName, task: t.task, priority: t.priority, source: t.source });
          } catch (e) {
            console.error(`[task-watcher] handler 异常:`, e.message);
          }
        }
      }
      archiveTasks(agentName, tasks);
      clearQueue(agentName);
    }
  } catch (e) {
    console.error(`[task-watcher] poll 异常:`, e.message);
  }
}

function getPending(agentName) {
  return readTasks(agentName);
}

function startTaskWatcher(handlerFn) {
  if (_timer) return;
  _handler = typeof handlerFn === 'function' ? handlerFn : null;
  ensureDir(QUEUE_DIR);
  ensureDir(PROCESSED_DIR);
  poll();
  _timer = setInterval(poll, 5 * 60 * 1000);
  console.log('[task-watcher] 已启动 (轮询间隔: 5分钟)');
}

function stopTaskWatcher() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startTaskWatcher, stopTaskWatcher, getPending };
