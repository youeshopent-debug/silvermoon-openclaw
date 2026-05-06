const fs = require('fs');
const path = require('path');
let embeddingMod = null;
try { embeddingMod = require('./embedding.js'); } catch {} // 可选，无embedding不影响FTS5基本搜索

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
    this.stmtSearchCutoff = null;
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
              snippet(mem_fts, 0, '', '', ' … ', 12) AS snippet,
              bm25(mem_fts) AS rank
         FROM mem_fts JOIN mem ON mem.rowid = mem_fts.rowid
        WHERE mem_fts MATCH ?
        ORDER BY bm25(mem_fts) ASC
        LIMIT ?`
    );
    this.stmtSearchCutoff = db.prepare(
      `SELECT mem.uid AS uid, mem.at AS at, mem.channelId AS channelId, mem.role AS role,
              snippet(mem_fts, 0, '', '', ' … ', 12) AS snippet,
              bm25(mem_fts) AS rank
         FROM mem_fts JOIN mem ON mem.rowid = mem_fts.rowid
        WHERE mem_fts MATCH ?
          AND (mem.at IS NULL OR mem.at <= ?)
        ORDER BY bm25(mem_fts) ASC
        LIMIT ?`
    );
    this.stmtHasMeta = db.prepare(`SELECT v FROM mem_meta WHERE k = ? LIMIT 1`);
    this.stmtSetMeta = db.prepare(`INSERT INTO mem_meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`);

    this.initEmbedding();
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
      if (info.changes === 1) {
        setImmediate(() => {
          this.addEmbedding(uid, content).catch(() => {});
        });
      }
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
    const minAgeMs = Math.max(0, Number(options?.minAgeMs || 0) || 0);
    const cutoffIso = minAgeMs > 0 ? new Date(Date.now() - minAgeMs).toISOString() : '';
    try {
      const rows = cutoffIso ? this.stmtSearchCutoff.all(q, cutoffIso, limit) : this.stmtSearch.all(q, limit);
      const items = rows.map((r) => ({
        uid: String(r.uid || ''),
        at: r.at || null,
        channelId: r.channelId || null,
        role: r.role || null,
        snippet: String(r.snippet || '').trim(),
        rank: Number(r.rank || 0),
      }));
      return { ok: true, items };
    } catch (e) {
      return { ok: false, reason: 'db_error', error: String(e?.message || e), items: [] };
    }
  }

  searchDeep(query, options) {
    const q0 = String(query || '').trim();
    const limit = Math.max(1, Math.min(50, Number(options?.limit || 0) || 8));
    const minAgeMs = Math.max(0, Number(options?.minAgeMs || 0) || 0);
    const out = [];
    const seen = new Set();

    const push = (items) => {
      for (const it of Array.isArray(items) ? items : []) {
        const uid = String(it?.uid || '').trim();
        if (!uid) continue;
        if (seen.has(uid)) continue;
        seen.add(uid);
        out.push(it);
        if (out.length >= limit) break;
      }
    };

    const r1 = this.search(q0, { limit, minAgeMs });
    if (r1 && r1.ok) push(r1.items);

    const topRank = out.length ? Number(out[0]?.rank || 0) : 0;
    const maxRank = Math.max(0, Number(process.env.OPENCLAW_MEMORY_MAX_RANK || 8) || 8);
    if (out.length >= Math.min(3, limit) && topRank > 0 && topRank <= maxRank) return { ok: true, items: out, expanded: false };

    const related = [];
    const add = (k) => {
      const t = String(k || '').trim();
      if (!t) return;
      if (!related.includes(t)) related.push(t);
    };
    if (/rwa/i.test(q0)) {
      add('Vercel');
      add('Next.js');
      add('部署');
      add('进度');
      add('偏好');
      add('RWA');
    } else if (/vercel/i.test(q0) || /next/i.test(q0)) {
      add('部署');
      add('vercel');
      add('next');
      add('偏好');
    } else {
      add('进度');
      add('偏好');
    }

    for (const k of related) {
      if (out.length >= limit) break;
      const r = this.search(k, { limit, minAgeMs });
      if (r && r.ok) push(r.items);
    }

    return { ok: true, items: out, expanded: true };
  }

  expandRadius(query, options) {
    return this.searchDeep(query, options);
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

  // ─── RAG：语义搜索（基于 embedding）────────────────────

  /** 初始化 mem_vec 向量表（幂等） */
  initEmbedding() {
    if (!this.db) return { ok: false, reason: 'not_ready' };
    if (!embeddingMod) return { ok: false, reason: 'no_embedding_module' };
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mem_vec (
          uid TEXT PRIMARY KEY,
          vec BLOB NOT NULL,
          dims INTEGER NOT NULL DEFAULT 1024,
          model TEXT,
          updated_at TEXT NOT NULL
        );
      `);
      this.stmtInsertVec = this.db.prepare(
        `INSERT OR REPLACE INTO mem_vec (uid, vec, dims, model, updated_at) VALUES (@uid, @vec, @dims, @model, @updated_at)`
      );
      this.stmtGetVec = this.db.prepare(`SELECT uid, vec, dims FROM mem_vec`);
      this.stmtGetVecByUid = this.db.prepare(`SELECT uid, vec, dims FROM mem_vec WHERE uid = ?`);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'init_fail', error: String(e?.message || e) };
    }
  }

  /** 为指定 uid 的记忆记录创建并存储 embedding */
  async addEmbedding(uid, content) {
    if (!this.db || !this.stmtInsertVec) return { ok: false, reason: 'not_ready' };
    if (!embeddingMod) return { ok: false, reason: 'no_embedding_module' };
    const c = String(content || '').trim();
    if (!c || c.length < 10) return { ok: false, reason: 'content_too_short' };
    try {
      const r = await embeddingMod.getEmbedding(c);
      if (!r.ok) return r;
      const vecBuf = embeddingMod.vecToBuf(r.vector);
      const info = this.stmtInsertVec.run({
        uid: String(uid),
        vec: vecBuf,
        dims: r.vector.length,
        model: r.model || 'unknown',
        updated_at: new Date().toISOString(),
      });
      return { ok: true, changes: info.changes };
    } catch (e) {
      return { ok: false, reason: 'add_embedding_error', error: String(e?.message || e) };
    }
  }

  /** 语义搜索：查询 embedding → 余弦相似度 → top-k */
  async searchSemantic(query, options) {
    if (!this.db || !this.stmtGetVec) return { ok: false, reason: 'not_ready', items: [] };
    if (!embeddingMod) return { ok: false, reason: 'no_embedding_module', items: [] };
    const limit = Math.max(1, Math.min(50, Number(options?.limit || 0) || 8));
    const q = String(query || '').trim();
    if (!q) return { ok: true, items: [] };

    try {
      const qr = await embeddingMod.getEmbedding(q);
      if (!qr.ok) return { ok: false, reason: `query_embedding_fail: ${qr.error}`, items: [] };
      const qVec = embeddingMod.normalize(qr.vector);

      const allVecs = this.stmtGetVec.all();
      if (allVecs.length === 0) return { ok: true, items: [] };

      const scored = allVecs.map(row => {
        const v = embeddingMod.bufToVec(row.vec);
        const norm = embeddingMod.normalize(v);
        const sim = embeddingMod.cosineSim(qVec, norm);
        return { uid: String(row.uid), score: sim };
      });

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, limit).filter(x => x.score > 0.3);

      const items = top.map(t => {
        const memRow = this.db.prepare('SELECT uid, at, content FROM mem WHERE uid = ?').get(t.uid);
        if (!memRow) return null;
        return {
          uid: String(memRow.uid || ''),
          at: memRow.at || null,
          content: String(memRow.content || '').slice(0, 300),
          score: Number(t.score.toFixed(4)),
        };
      }).filter(Boolean);

      return { ok: true, items, total: allVecs.length };
    } catch (e) {
      return { ok: false, reason: 'semantic_search_error', error: String(e?.message || e), items: [] };
    }
  }

  close() {
    try {
      if (this.db) this.db.close();
    } catch {}
    this.db = null;
    this.stmtInsert = null;
    this.stmtSearch = null;
    this.stmtSearchCutoff = null;
    this.stmtHasMeta = null;
    this.stmtSetMeta = null;
    this.stmtInsertVec = null;
    this.stmtGetVec = null;
    this.stmtGetVecByUid = null;
    return { ok: true };
  }
}

function createMemory({ dbPath }) {
  return new MemoryStore({ dbPath });
}

module.exports = { createMemory, MemoryStore };
