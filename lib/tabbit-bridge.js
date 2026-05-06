const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TABBIT_QUEUE = path.join(__dirname, '..', '.silvermoon_core', 'tabbit_queue.json');
const TABBIT_EXE = path.join(process.env.LOCALAPPDATA || '', 'Tabbit Browser', 'Application', 'Tabbit Browser.exe');

function getTabbitPath() {
  const customPath = process.env.TABBIT_PATH;
  if (customPath && fs.existsSync(customPath)) return customPath;
  if (fs.existsSync(TABBIT_EXE)) return TABBIT_EXE;
  return null;
}

function enqueueTask(task) {
  try {
    const dir = path.dirname(TABBIT_QUEUE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const queue = fs.existsSync(TABBIT_QUEUE)
      ? JSON.parse(fs.readFileSync(TABBIT_QUEUE, 'utf8'))
      : { tasks: [], results: [] };
    const entry = {
      id: Date.now().toString(36),
      type: task.type || 'browse',
      url: task.url || '',
      query: task.query || '',
      instruction: task.instruction || '',
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    queue.tasks.push(entry);
    fs.writeFileSync(TABBIT_QUEUE, JSON.stringify(queue, null, 2), 'utf8');
    return entry;
  } catch { return null; }
}

function launchTabbit(url) {
  const tabbitPath = getTabbitPath();
  if (!tabbitPath) return { ok: false, reason: 'tabbit_not_found' };
  try {
    spawn(tabbitPath, url ? [url] : [], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, pid: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function pollResult(taskId, timeoutMs = 300_000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      try {
        if (!fs.existsSync(TABBIT_QUEUE)) { setTimeout(check, 2000); return; }
        const queue = JSON.parse(fs.readFileSync(TABBIT_QUEUE, 'utf8'));
        const result = (queue.results || []).find(r => r.taskId === taskId);
        if (result) {
          queue.results = (queue.results || []).filter(r => r.taskId !== taskId);
          fs.writeFileSync(TABBIT_QUEUE, JSON.stringify(queue, null, 2), 'utf8');
          resolve(result);
          return;
        }
        if (Date.now() - start > timeoutMs) { resolve({ status: 'timeout', taskId }); return; }
      } catch {}
      setTimeout(check, 2000);
    };
    check();
  });
}

function submitResult(taskId, data) {
  try {
    if (!fs.existsSync(TABBIT_QUEUE)) return false;
    const queue = JSON.parse(fs.readFileSync(TABBIT_QUEUE, 'utf8'));
    const task = (queue.tasks || []).find(t => t.id === taskId);
    if (task) task.status = 'completed';
    queue.results = queue.results || [];
    queue.results.push({ taskId, data, submittedAt: new Date().toISOString() });
    fs.writeFileSync(TABBIT_QUEUE, JSON.stringify(queue, null, 2), 'utf8');
    return true;
  } catch { return false; }
}

module.exports = { enqueueTask, launchTabbit, pollResult, submitResult, getTabbitPath };
