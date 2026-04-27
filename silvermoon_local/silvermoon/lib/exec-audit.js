const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function maskSecrets(s) {
  const str = String(s || '');
  const re = /((token|secret|api[_-]?key|webhook[_-]?secret|password|bearer)\s*[:=]\s*)([^\s"'`]{6,})/gi;
  return str.replace(re, (_, prefix) => `${prefix}***`);
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ ok: false, error: 'json_stringify_failed' });
  }
}

function tailLimit(s, maxChars) {
  const str = String(s || '');
  const n = typeof maxChars === 'number' ? maxChars : 1600;
  if (str.length <= n) return str;
  return str.slice(-n);
}

class ExecAudit {
  constructor({ approvalsPath, auditPath }) {
    this.approvalsPath = approvalsPath;
    this.auditPath = auditPath;
  }

  appendApproval(rec) {
    try {
      ensureDir(path.dirname(this.approvalsPath));
      const masked = maskSecrets(safeJson(rec));
      fs.appendFileSync(this.approvalsPath, tailLimit(masked, 8000) + '\n', 'utf-8');
      return { ok: true };
    } catch {
      return { ok: false, reason: 'append_failed' };
    }
  }

  appendAudit(rec) {
    try {
      ensureDir(path.dirname(this.auditPath));
      const masked = maskSecrets(safeJson(rec));
      fs.appendFileSync(this.auditPath, tailLimit(masked, 8000) + '\n', 'utf-8');
      return { ok: true };
    } catch {
      return { ok: false, reason: 'append_failed' };
    }
  }
}

module.exports = { ExecAudit };
