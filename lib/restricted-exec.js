const path = require('path');
const childProcess = require('child_process');

function hasBadChars(x) {
  const s = String(x || '');
  if (!s) return false;
  return /[\r\n;&|`$<>]/.test(s);
}

function normalizeAbs(p) {
  const s = String(p || '');
  if (!s) return '';
  return path.resolve(s);
}

function isUnderRoots(abs, roots) {
  for (const r of roots || []) {
    const root = normalizeAbs(r);
    if (!root) continue;
    if (abs === root) return true;
    const rel = path.relative(root, abs);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return true;
  }
  return false;
}

class RestrictedExecutor {
  constructor({ allowedServices, allowedRootDirs }) {
    this.allowedServices = Array.isArray(allowedServices) ? allowedServices.map(String) : [];
    this.allowedRootDirs = Array.isArray(allowedRootDirs) ? allowedRootDirs.map(String) : [];
  }

  validateAction({ kind, args }) {
    const k = String(kind || '').trim();
    const a = args && typeof args === 'object' ? args : {};
    if (!k) return { ok: false, reason: 'missing_kind' };

    if (k === 'svc_status' || k === 'svc_restart' || k === 'svc_logs') {
      const service = String(a.service || '').trim();
      if (!service) return { ok: false, reason: 'missing_service' };
      if (hasBadChars(service)) return { ok: false, reason: 'bad_chars' };
      if (!this.allowedServices.includes(service)) return { ok: false, reason: 'service_not_allowed' };
      return { ok: true };
    }

    if (k === 'node_check') {
      const abs = normalizeAbs(a.scriptPath);
      if (!abs) return { ok: false, reason: 'missing_path' };
      if (hasBadChars(abs)) return { ok: false, reason: 'bad_chars' };
      if (!isUnderRoots(abs, this.allowedRootDirs)) return { ok: false, reason: 'path_not_allowed' };
      return { ok: true };
    }

    if (k === 'node_test') {
      const abs = normalizeAbs(a.testPath);
      if (!abs) return { ok: false, reason: 'missing_path' };
      if (hasBadChars(abs)) return { ok: false, reason: 'bad_chars' };
      if (!isUnderRoots(abs, this.allowedRootDirs)) return { ok: false, reason: 'path_not_allowed' };
      return { ok: true };
    }

    if (k === 'repo_ls') {
      const abs = normalizeAbs(a.dirPath);
      if (!abs) return { ok: false, reason: 'missing_path' };
      if (hasBadChars(abs)) return { ok: false, reason: 'bad_chars' };
      if (!isUnderRoots(abs, this.allowedRootDirs)) return { ok: false, reason: 'path_not_allowed' };
      return { ok: true };
    }

    return { ok: false, reason: 'unsupported_kind' };
  }

  toCommand({ kind, args }) {
    const k = String(kind || '').trim();
    const a = args && typeof args === 'object' ? args : {};

    if (k === 'svc_status') return { cmd: 'systemctl', argv: ['status', a.service, '--no-pager', '-l'] };
    if (k === 'svc_restart') return { cmd: 'systemctl', argv: ['restart', a.service] };
    if (k === 'svc_logs') {
      const n = Number(a.lines || 120);
      const lines = Number.isFinite(n) ? String(Math.max(20, Math.min(500, Math.floor(n)))) : '120';
      return { cmd: 'journalctl', argv: ['-u', a.service, '-n', lines, '--no-pager'] };
    }
    if (k === 'node_check') return { cmd: 'node', argv: ['--check', normalizeAbs(a.scriptPath)] };
    if (k === 'node_test') return { cmd: 'node', argv: ['--test', normalizeAbs(a.testPath)] };
    if (k === 'repo_ls') return { cmd: 'ls', argv: ['-la', normalizeAbs(a.dirPath)] };

    return { cmd: '', argv: [] };
  }

  async run({ kind, args, timeoutMs }) {
    const v = this.validateAction({ kind, args });
    if (!v.ok) return { ok: false, reason: v.reason };
    const { cmd, argv } = this.toCommand({ kind, args });
    if (!cmd) return { ok: false, reason: 'unsupported_kind' };

    const t = Number(timeoutMs || 25_000);
    return await new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let done = false;
      const child = childProcess.spawn(cmd, argv, { shell: false, windowsHide: true });
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {}
      }, Math.max(2000, t));

      child.stdout.on('data', (d) => {
        stdout += String(d || '');
      });
      child.stderr.on('data', (d) => {
        stderr += String(d || '');
      });
      child.on('error', (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'spawn_error', error: String(e?.message || e), stdout, stderr });
      });
      child.on('close', (code) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: true, exitCode: typeof code === 'number' ? code : null, stdout, stderr });
      });
    });
  }
}

module.exports = { RestrictedExecutor };
