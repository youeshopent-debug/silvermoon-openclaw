'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHARED_MEM_DIR = path.join(__dirname, '..', '.silvermoon_core', 'shared_memory');
const DB_PATH = path.join(SHARED_MEM_DIR, 'shared_memory.db');
const SUMMARY_PATH = path.join(SHARED_MEM_DIR, 'SHARED_MEMORY.md');

let Better = null;
try { Better = require('better-sqlite3'); } catch {}

class SharedMemoryBridge {
  constructor() {
    this.db = null;
    this.stmtInsert = null;
    this.stmtSearch = null;
    this.stmtRecent = null;
    this.stmtByAgent = null;
    this.stmtByCategory = null;
    this.stmtUpdateActive = null;
    this.ready = false;
  }

  init() {
    if (!Better) return { ok: false, reason: 'missing_better_sqlite3' };
    if (!fs.existsSync(SHARED_MEM_DIR)) {
      fs.mkdirSync(SHARED_MEM_DIR, { recursive: true });
    }
    try {
      this.db = new Better(DB_PATH);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      const initSql = fs.readFileSync(path.join(SHARED_MEM_DIR, 'init.sql'), 'utf8');
      this.db.exec(initSql);
      this.stmtInsert = this.db.prepare(`
        INSERT OR IGNORE INTO shared_mem (uid, at, agent_id, agent_name, scope, category, tags, title, content, meta)
        VALUES (@uid, @at, @agent_id, @agent_name, @scope, @category, @tags, @title, @content, @meta)
      `);
      this.stmtSearch = this.db.prepare(`
        SELECT m.uid, m.at, m.agent_id, m.agent_name, m.scope, m.category, m.tags, m.title,
               snippet(fts, 0, '', '', ' … ', 12) AS snippet
        FROM shared_mem_fts fts JOIN shared_mem m ON m.rowid = fts.rowid
        WHERE fts MATCH ? AND m.scope = 'shared'
        ORDER BY bm25(fts) ASC LIMIT ?
      `);
      this.stmtRecent = this.db.prepare(`
        SELECT uid, at, agent_id, agent_name, scope, category, tags, title, substr(content, 1, 200) AS preview
        FROM shared_mem WHERE scope = 'shared'
        ORDER BY at DESC LIMIT ?
      `);
      this.stmtByAgent = this.db.prepare(`
        SELECT uid, at, agent_id, agent_name, scope, category, tags, title, substr(content, 1, 200) AS preview
        FROM shared_mem WHERE agent_id = ? AND scope = 'shared'
        ORDER BY at DESC LIMIT ?
      `);
      this.stmtByCategory = this.db.prepare(`
        SELECT uid, at, agent_id, agent_name, scope, category, tags, title, substr(content, 1, 200) AS preview
        FROM shared_mem WHERE category = ? AND scope = 'shared'
        ORDER BY at DESC LIMIT ?
      `);
      this.stmtUpdateActive = this.db.prepare(`
        UPDATE agent_registry SET last_active_at = datetime('now') WHERE agent_id = ?
      `);
      this.ready = true;
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  }

  _uid() {
    return `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  _now() {
    return new Date().toISOString();
  }

  write(opts) {
    if (!this.ready || !this.stmtInsert) return { ok: false, reason: 'not_ready' };
    const agentId = String(opts.agent_id || '').trim();
    const agentName = String(opts.agent_name || '').trim();
    const content = String(opts.content || '').trim();
    if (!agentId || !agentName || !content) return { ok: false, reason: 'missing_required' };
    const scope = opts.scope === 'private' ? 'private' : 'shared';
    const category = ['task','decision','code','insight','handoff','reflection'].includes(opts.category) ? opts.category : 'general';
    try {
      const out = this.stmtInsert.run({
        uid: this._uid(),
        at: this._now(),
        agent_id: agentId,
        agent_name: agentName,
        scope,
        category,
        tags: String(opts.tags || '').trim(),
        title: String(opts.title || '').trim().slice(0, 200),
        content,
        meta: JSON.stringify(opts.meta || {}),
      });
      if (out.changes > 0) this._refreshSummary();
      return { ok: true, changes: out.changes };
    } catch (e) {
      return { ok: false, reason: String(e.message || e) };
    }
  }

  search(query, limit = 8) {
    if (!this.ready || !this.stmtSearch) return { ok: false, reason: 'not_ready', items: [] };
    const q = String(query || '').trim();
    if (!q) return { ok: true, items: [] };
    try {
      const rows = this.stmtSearch.all(q, Math.max(1, Math.min(50, limit)));
      return { ok: true, items: rows.map(r => ({
        uid: r.uid, at: r.at, agent_id: r.agent_id, agent_name: r.agent_name,
        scope: r.scope, category: r.category, tags: r.tags, title: r.title, snippet: r.snippet,
      })) };
    } catch (e) {
      return { ok: false, reason: String(e.message || e), items: [] };
    }
  }

  getRecent(limit = 20) {
    if (!this.ready || !this.stmtRecent) return { ok: false, reason: 'not_ready', items: [] };
    try {
      const rows = this.stmtRecent.all(Math.max(1, Math.min(100, limit)));
      return { ok: true, items: rows };
    } catch (e) {
      return { ok: false, reason: String(e.message || e), items: [] };
    }
  }

  getByAgent(agentId, limit = 10) {
    if (!this.ready || !this.stmtByAgent) return { ok: false, reason: 'not_ready', items: [] };
    try {
      const rows = this.stmtByAgent.all(agentId, Math.max(1, Math.min(50, limit)));
      return { ok: true, items: rows };
    } catch (e) {
      return { ok: false, reason: String(e.message || e), items: [] };
    }
  }

  getByCategory(category, limit = 10) {
    if (!this.ready || !this.stmtByCategory) return { ok: false, reason: 'not_ready', items: [] };
    try {
      const rows = this.stmtByCategory.all(category, Math.max(1, Math.min(50, limit)));
      return { ok: true, items: rows };
    } catch (e) {
      return { ok: false, reason: String(e.message || e), items: [] };
    }
  }

  markActive(agentId) {
    if (!this.ready || !this.stmtUpdateActive) return;
    try { this.stmtUpdateActive.run(agentId); } catch {}
  }

  _refreshSummary() {
    try {
      const recent = this.getRecent(30);
      if (!recent.ok) return;
      const byAgent = {};
      for (const item of recent.items) {
        const key = item.agent_name || item.agent_id;
        if (!byAgent[key]) byAgent[key] = [];
        byAgent[key].push(item);
      }
      const lines = [
        '# 银月钱庄 · 共享记忆快照',
        '',
        `> 自动生成: ${this._now()}`,
        `> 最近 ${recent.items.length} 条共享记忆`,
        '',
        '---',
        '',
      ];
      for (const [agent, items] of Object.entries(byAgent)) {
        lines.push(`## ${agent}`);
        lines.push('');
        for (const item of items.slice(0, 5)) {
          const tag = item.category ? `[${item.category}]` : '';
          const title = item.title || '(无标题)';
          lines.push(`- ${tag} **${title}** — ${item.preview || ''}`);
        }
        lines.push('');
      }
      lines.push('---');
      lines.push('*隐私声明：仅 scope=shared 的记忆出现在此快照中。私事永不共享。*');
      fs.writeFileSync(SUMMARY_PATH, lines.join('\n'), 'utf8');
    } catch {}
  }

  getSummary() {
    if (fs.existsSync(SUMMARY_PATH)) {
      return fs.readFileSync(SUMMARY_PATH, 'utf8');
    }
    return null;
  }

  close() {
    try { if (this.db) this.db.close(); } catch {}
    this.db = null;
    this.ready = false;
  }
}

module.exports = new SharedMemoryBridge();
