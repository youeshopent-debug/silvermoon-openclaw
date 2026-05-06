const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); return true; }
  catch { return false; }
}

function nowIso() {
  return new Date().toISOString();
}

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf-8'); }
  catch { return null; }
}

function safeWrite(p, content) {
  try { ensureDir(path.dirname(p)); fs.writeFileSync(p, content, 'utf-8'); return true; }
  catch { return false; }
}

function listDirRecursive(dir, maxDepth) {
  const results = [];
  const maxD = Math.max(1, Number(maxDepth || 3));
  function walk(d, depth) {
    if (depth > maxD) return;
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          if (!e.name.startsWith('.')) walk(full, depth + 1);
        } else {
          results.push(full);
        }
      }
    } catch {}
  }
  walk(dir, 0);
  return results;
}

async function toolTaskManager(args, ctx) {
  const action = String(args?.action || 'status').trim();
  const targetPath = String(args?.path || '').trim();
  const baseDir = String(ctx?.baseDir || process.cwd());

  try {
    if (action === 'status') {
      const mu = process.memoryUsage();
      return {
        ok: true,
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: Math.round(mu.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(mu.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(mu.heapTotal / 1024 / 1024) + 'MB',
        },
        node: process.version,
        platform: process.platform,
        cwd: process.cwd(),
      };
    }

    if (action === 'listFiles') {
      if (!targetPath) return { ok: false, reason: 'missing_path' };
      const abs = path.resolve(baseDir, targetPath);
      if (!abs.startsWith(baseDir)) return { ok: false, reason: 'path_escape' };
      if (!fs.existsSync(abs)) return { ok: false, reason: 'not_found', path: abs };
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        const files = listDirRecursive(abs, Number(args?.depth || 3));
        return { ok: true, path: abs, isDir: true, files: files.map(f => path.relative(baseDir, f)) };
      }
      const content = safeRead(abs);
      if (content === null) return { ok: false, reason: 'read_error', path: abs };
      const maxBytes = Number(args?.maxBytes || 64 * 1024);
      const truncated = content.length > maxBytes ? content.slice(0, maxBytes) + '\n... [truncated]' : content;
      return { ok: true, path: abs, isDir: false, content: truncated, size: content.length };
    }

    if (action === 'writeFile') {
      if (!targetPath) return { ok: false, reason: 'missing_path' };
      const content = String(args?.content || '');
      const abs = path.resolve(baseDir, targetPath);
      if (!abs.startsWith(baseDir)) return { ok: false, reason: 'path_escape' };
      const ok = safeWrite(abs, content);
      return ok ? { ok: true, path: abs, bytes: content.length } : { ok: false, reason: 'write_failed' };
    }

    if (action === 'runScript') {
      const script = String(args?.script || '').trim();
      if (!script) return { ok: false, reason: 'missing_script' };
      return {
        ok: true,
        needApproval: true,
        plan: {
          kind: 'task_manager_exec',
          args: { script },
          reason: 'task_manager_auto_deploy',
          channelId: String(ctx?.channelId || ''),
          requestedBy: String(ctx?.requestedBy || 'silvermoon'),
        },
      };
    }

    if (action === 'deploy') {
      const sourcePath = String(args?.source || '').trim();
      const targetName = String(args?.target || '').trim();
      if (!sourcePath || !targetName) return { ok: false, reason: 'missing_source_or_target' };
      const srcAbs = path.resolve(baseDir, sourcePath);
      const targetAbs = path.resolve(baseDir, targetName);
      if (!srcAbs.startsWith(baseDir) || !targetAbs.startsWith(baseDir)) return { ok: false, reason: 'path_escape' };
      const content = safeRead(srcAbs);
      if (content === null) return { ok: false, reason: 'source_not_found', path: srcAbs };
      const ok = safeWrite(targetAbs, content);
      return ok ? { ok: true, from: sourcePath, to: targetName, bytes: content.length } : { ok: false, reason: 'deploy_failed' };
    }

    if (action === 'restart') {
      return {
        ok: true,
        needApproval: true,
        plan: {
          kind: 'task_manager_restart',
          args: {},
          reason: 'task_manager_restart_requested',
          channelId: String(ctx?.channelId || ''),
          requestedBy: String(ctx?.requestedBy || 'silvermoon'),
        },
      };
    }

    return { ok: false, reason: 'unknown_action', action };
  } catch (e) {
    return { ok: false, reason: 'task_manager_error', error: String(e?.message || e) };
  }
}

module.exports = { toolTaskManager };
