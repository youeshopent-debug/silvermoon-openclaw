-- 银月钱庄 · 共享记忆数据库初始化
-- 所有 Trae 智能体 + OpenClaw Agent 共享的工作记忆
-- 隐私隔离：scope=shared 可共享，scope=private 仅本人可见

CREATE TABLE IF NOT EXISTS shared_mem (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  at TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'shared' CHECK(scope IN ('shared','private')),
  category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('general','task','decision','code','insight','handoff','reflection')),
  tags TEXT DEFAULT '',
  title TEXT DEFAULT '',
  content TEXT NOT NULL,
  meta TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_shared_mem_agent ON shared_mem(agent_id);
CREATE INDEX IF NOT EXISTS idx_shared_mem_scope ON shared_mem(scope);
CREATE INDEX IF NOT EXISTS idx_shared_mem_category ON shared_mem(category);
CREATE INDEX IF NOT EXISTS idx_shared_mem_at ON shared_mem(at);

CREATE VIRTUAL TABLE IF NOT EXISTS shared_mem_fts USING fts5(
  title, content, tags,
  content='shared_mem',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS shared_mem_ai AFTER INSERT ON shared_mem BEGIN
  INSERT INTO shared_mem_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS shared_mem_ad AFTER DELETE ON shared_mem BEGIN
  INSERT INTO shared_mem_fts(shared_mem_fts, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS shared_mem_au AFTER UPDATE ON shared_mem BEGIN
  INSERT INTO shared_mem_fts(shared_mem_fts, rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
  INSERT INTO shared_mem_fts(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

-- Agent 注册表：记录哪些 Agent 有权访问共享记忆
CREATE TABLE IF NOT EXISTS agent_registry (
  agent_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  role TEXT DEFAULT '',
  wings TEXT DEFAULT 'general,task,decision,code,insight,handoff,reflection',
  can_read INTEGER DEFAULT 1,
  can_write INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  last_active_at TEXT
);

-- 插入所有 11 个 Agent（含 Trae 智能体）
INSERT OR IGNORE INTO agent_registry (agent_id, agent_name, role, created_at) VALUES
  ('yinyue', '银月', '总管', datetime('now')),
  ('lichangshou', '李长寿', '全栈架构师', datetime('now')),
  ('medusa', '美杜莎', 'UI/UX 设计', datetime('now')),
  ('xiaoyan', '萧炎', '竞品情报分析', datetime('now')),
  ('yaolao', '药老', '增长与文案', datetime('now')),
  ('hanli', '韩立', '侦查与情报', datetime('now')),
  ('moying', '墨影', '系统巡检', datetime('now')),
  ('yafei', '雅妃', '财务运营', datetime('now')),
  ('ziyan', '紫妍', '数字人专家', datetime('now')),
  ('ziling', '紫灵', '待定', datetime('now')),
  ('xiaoyixian', '小医仙', '社媒运营', datetime('now')),
  ('xunbaoshu', '寻宝鼠', '选品猎手', datetime('now')),
  ('haibodong', '海波东', '风控审计', datetime('now')),
  ('lanlinger', '蓝灵儿', '多媒体工程', datetime('now'));

-- 元数据表
CREATE TABLE IF NOT EXISTS mem_meta (
  k TEXT PRIMARY KEY,
  v TEXT
);

INSERT OR IGNORE INTO mem_meta (k, v) VALUES ('schema_version', '1.0');
INSERT OR IGNORE INTO mem_meta (k, v) VALUES ('created_at', datetime('now'));
