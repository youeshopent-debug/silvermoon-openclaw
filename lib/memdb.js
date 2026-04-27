const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function dbPaths() {
  const root = path.join(__dirname, '..');
  const dir = path.join(root, 'user_data', 'memory');
  const file = path.join(dir, 'core_rules.json');
  return { root, dir, file };
}

function readJsonSafe(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf-8');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonAtomic(fp, obj) {
  try {
    const dir = path.dirname(fp);
    ensureDir(dir);
    const tmp = fp + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmp, fp);
    return true;
  } catch {
    return false;
  }
}

function normalizeDb(j) {
  const base = j && typeof j === 'object' ? j : {};
  const rules = Array.isArray(base.rules) ? base.rules : [];
  const outRules = [];
  for (const r of rules) {
    if (!r || typeof r !== 'object') continue;
    const id = String(r.id || '').trim();
    const text = String(r.text || '').trim();
    if (!id || !text) continue;
    outRules.push({
      id,
      text,
      at: String(r.at || '').trim() || null,
      by: String(r.by || '').trim() || null,
      tags: Array.isArray(r.tags) ? r.tags.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12) : [],
    });
    if (outRules.length >= 400) break;
  }
  return {
    version: 1,
    updatedAt: String(base.updatedAt || '').trim() || null,
    rules: outRules,
  };
}

function loadMemDb() {
  const { file } = dbPaths();
  const j = readJsonSafe(file);
  return normalizeDb(j);
}

function saveMemDb(db) {
  const { file } = dbPaths();
  const payload = normalizeDb(db);
  payload.updatedAt = nowIso();
  return writeJsonAtomic(file, payload);
}

function addRule(text, by, tags) {
  const t = String(text || '').trim();
  if (!t) return { ok: false, error: 'empty' };
  const db = loadMemDb();
  const id = crypto.randomBytes(6).toString('hex');
  const item = {
    id,
    text: t.slice(0, 2200),
    at: nowIso(),
    by: String(by || '').trim() || null,
    tags: Array.isArray(tags) ? tags.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12) : [],
  };
  db.rules.unshift(item);
  db.rules = db.rules.slice(0, 400);
  const ok = saveMemDb(db);
  return ok ? { ok: true, item } : { ok: false, error: 'write_failed' };
}

function listRules(limit) {
  const db = loadMemDb();
  const n = Math.max(1, Math.min(80, Number(limit || 20) || 20));
  return db.rules.slice(0, n);
}

function deleteRuleByPrefix(prefix) {
  const p = String(prefix || '').trim().toLowerCase();
  if (!p) return { ok: false, error: 'empty' };
  const db = loadMemDb();
  const before = db.rules.length;
  db.rules = db.rules.filter((r) => String(r.id || '').toLowerCase() !== p && !String(r.id || '').toLowerCase().startsWith(p));
  const removed = before - db.rules.length;
  if (!removed) return { ok: false, error: 'not_found' };
  const ok = saveMemDb(db);
  return ok ? { ok: true, removed } : { ok: false, error: 'write_failed' };
}

function buildInjectedBlock(opts) {
  const maxChars = Math.max(300, Math.min(6000, Number(opts?.maxChars || 2600) || 2600));
  const rules = listRules(Number(opts?.maxRules || 18) || 18);
  const lines = [];
  lines.push('【银月核心记忆（强制注入，不可绕过）】');
  for (const r of rules) {
    const id = String(r.id || '').slice(0, 8);
    const t = String(r.text || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    lines.push(`- (${id}) ${t}`);
  }
  let block = lines.join('\n').trim();
  if (block.length > maxChars) block = block.slice(0, maxChars - 3) + '...';
  const hasAny = rules.length > 0;
  return { hasAny, block };
}

module.exports = {
  dbPaths,
  loadMemDb,
  addRule,
  listRules,
  deleteRuleByPrefix,
  buildInjectedBlock,
};

