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

function safeJsonStringify(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return '';
  }
}

function readJsonlLines(filePath, maxBytes) {
  const p = String(filePath || '').trim();
  if (!p) return [];
  try {
    const raw = fs.readFileSync(p);
    const buf = maxBytes && raw.length > maxBytes ? raw.subarray(raw.length - maxBytes) : raw;
    const text = buf.toString('utf-8');
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function tryRequireBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

class MemoryStore {
  constructor({ dbPath }) {
    this.dbPath = String(dbPath || '').trim();
    this.db = null;
    this.stmtInsert = null;
    this.stmtSearch = null;
    this.stmtHasMeta = null;
    this.stmtSetMeta = null;
  }

  init() {
    const Better = tryRequireBetterSqlite3();
    if (!Better) return { ok: false, reason: 'missing_better_sqlite3' };
    if (!this.dbPath) return { ok: false, reason: 'missing_db_path' };
    ensureDir(path.dirname(this.dbPath));
    const db = new Better(this.dbPath);
    this.db = db;

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS mem (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL UNIQUE,
        at TEXT,
        channelId TEXT,
        role TEXT,
        content TEXT,
        meta TEXT
      );
      CREATE TABLE IF NOT EXISTS mem_meta (
        k TEXT PRIMARY KEY,
        v TEXT
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS mem_fts USING fts5(
        content,
        content='mem',
        content_rowid='rowid'
      );
      CREATE TRIGGER IF NOT EXISTS mem_ai AFTER INSERT ON mem BEGIN
        INSERT INTO mem_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS mem_ad AFTER DELETE ON mem BEGIN
        INSERT INTO mem_fts(mem_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS mem_au AFTER UPDATE ON mem BEGIN
        INSERT INTO mem_fts(mem_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
        INSERT INTO mem_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
    `);

    this.stmtInsert = db.prepare(
      `INSERT OR IGNORE INTO mem (uid, at, channelId, role, content, meta) VALUES (@uid, @at, @channelId, @role, @content, @meta)`
    );
    this.stmtSearch = db.prepare(
      `SELECT mem.uid AS uid, mem.at AS at, mem.channelId AS channelId, mem.role AS role,
              snippet(mem_fts, 0, '', '', ' … ', 12) AS snippet
         FROM mem_fts JOIN mem ON mem.rowid = mem_fts.rowid
        WHERE mem_fts MATCH ?
        ORDER BY bm25(mem_fts) ASC
        LIMIT ?`
    );
    this.stmtHasMeta = db.prepare(`SELECT v FROM mem_meta WHERE k = ? LIMIT 1`);
    this.stmtSetMeta = db.prepare(`INSERT INTO mem_meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`);

    return { ok: true };
  }

  append(rec) {
    if (!this.db || !this.stmtInsert) return { ok: false, reason: 'not_ready' };
    const uid = String(rec?.uid || rec?.id || '').trim();
    const content = String(rec?.content || '').trim();
    if (!uid || !content) return { ok: false, reason: 'invalid_record' };
    const row = {
      uid,
      at: String(rec?.at || new Date().toISOString()),
      channelId: rec?.channelId == null ? null : String(rec.channelId),
      role: String(rec?.role || 'user'),
      content,
      meta: rec?.meta ? safeJsonStringify(rec.meta) : null,
    };
    try {
      const info = this.stmtInsert.run(row);
      return { ok: true, changes: info.changes };
    } catch (e) {
      return { ok: false, reason: 'db_error', error: String(e?.message || e) };
    }
  }

  search(query, options) {
    if (!this.db || !this.stmtSearch) return { ok: false, reason: 'not_ready', items: [] };
    const q = String(query || '').trim();
    if (!q) return { ok: true, items: [] };
    const limit = Math.max(1, Math.min(50, Number(options?.limit || 0) || 8));
    try {
      const rows = this.stmtSearch.all(q, limit);
      const items = rows.map((r) => ({
        uid: String(r.uid || ''),
        at: r.at || null,
        channelId: r.channelId || null,
        role: r.role || null,
        snippet: String(r.snippet || '').trim(),
      }));
      return { ok: true, items };
    } catch (e) {
      return { ok: false, reason: 'db_error', error: String(e?.message || e), items: [] };
    }
  }

  migrateFromJsonl(jsonlPath) {
    if (!this.db) return { ok: false, reason: 'not_ready' };
    const p = String(jsonlPath || '').trim();
    if (!p || !fs.existsSync(p)) return { ok: false, reason: 'missing_source' };

    const done = this.stmtHasMeta.get('migrated_long_term_jsonl');
    if (done && String(done.v || '').trim()) return { ok: true, skipped: true, inserted: 0 };

    const lines = readJsonlLines(p, 6_000_000);
    let inserted = 0;
    for (const line of lines) {
      if (!line || line === 'OPENCLAW_LONG_TERM_MEMORY_DB') continue;
      if (line[0] !== '{') continue;
      try {
        const j = JSON.parse(line);
        const uid = String(j?.id || '').trim();
        const content = String(j?.content || '').trim();
        if (!uid || !content) continue;
        const out = this.append({
          uid,
          at: j?.at || null,
          channelId: j?.channelId || null,
          role: j?.role || null,
          content,
          meta: { guildId: j?.guildId || null, authorId: j?.authorId || null, source: 'jsonl' },
        });
        if (out.ok && out.changes === 1) inserted += 1;
      } catch {}
    }

    try {
      this.stmtSetMeta.run('migrated_long_term_jsonl', new Date().toISOString());
    } catch {}

    return { ok: true, inserted };
  }

  close() {
    try {
      if (this.db) this.db.close();
    } catch {}
    this.db = null;
    this.stmtInsert = null;
    this.stmtSearch = null;
    this.stmtHasMeta = null;
    this.stmtSetMeta = null;
    return { ok: true };
  }
}

function createMemory({ dbPath }) {
  return new MemoryStore({ dbPath });
}

module.exports = { createMemory, MemoryStore };

