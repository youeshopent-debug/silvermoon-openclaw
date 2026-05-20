'use strict';

const fs = require('fs');
const path = require('path');

const MP_DIR = path.join(__dirname, '..', '.silvermoon_core', 'memory_palace');
const L1_FILE = path.join(MP_DIR, 'l1_working.json');
const L2_FILE = path.join(MP_DIR, 'l2_episodic.json');
const L3_FILE = path.join(MP_DIR, 'l3_semantic.json');
const PREF_FILE = path.join(MP_DIR, 'preferences.json');

const MAX_L1_ENTRIES = 100;
const MAX_L2_ENTRIES = 500;
const MAX_L3_ENTRIES = 200;

function ensureDir() {
  if (!fs.existsSync(MP_DIR)) fs.mkdirSync(MP_DIR, { recursive: true });
}

function readJSON(filePath, fallback) {
  ensureDir();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`[memory-palace] read error ${path.basename(filePath)}:`, e.message);
  }
  return fallback;
}

function writeJSON(filePath, data) {
  ensureDir();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[memory-palace] write error ${path.basename(filePath)}:`, e.message);
  }
}

// ─── L1: 工作记忆（Working Memory / FTS5） ─────────────────────
// 当前会话的近期交互记录，滚动窗口

function addToWorkingMemory(type, content, meta = {}) {
  const mem = readJSON(L1_FILE, { entries: [] });
  mem.entries.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type, // 'user_message' | 'assistant_reply' | 'tool_call' | 'error' | 'reflection'
    content: typeof content === 'string' ? content.slice(0, 2000) : JSON.stringify(content).slice(0, 2000),
    meta,
    timestamp: new Date().toISOString(),
  });
  if (mem.entries.length > MAX_L1_ENTRIES) {
    mem.entries = mem.entries.slice(-MAX_L1_ENTRIES);
  }
  writeJSON(L1_FILE, mem);
}

function getWorkingMemory(limit = 20) {
  const mem = readJSON(L1_FILE, { entries: [] });
  return mem.entries.slice(-limit);
}

function searchWorkingMemory(keyword, limit = 10) {
  const mem = readJSON(L1_FILE, { entries: [] });
  const kw = keyword.toLowerCase();
  return mem.entries
    .filter(e => e.content.toLowerCase().includes(kw))
    .slice(-limit);
}

// ─── L2: 情景记忆（Episodic Memory / 时间线+情感标签） ─────────
// 重要事件/里程碑，带情感标签

function addEpisode(summary, category, emotionalTag = 'neutral', detail = '') {
  const mem = readJSON(L2_FILE, { episodes: [] });
  mem.episodes.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    summary: summary.slice(0, 500),
    category, // 'task' | 'error' | 'achievement' | 'feedback' | 'decision'
    emotionalTag, // 'positive' | 'negative' | 'neutral' | 'urgent'
    detail: detail.slice(0, 2000),
    timestamp: new Date().toISOString(),
  });
  if (mem.episodes.length > MAX_L2_ENTRIES) {
    mem.episodes = mem.episodes.slice(-MAX_L2_ENTRIES);
  }
  writeJSON(L2_FILE, mem);
}

function getRecentEpisodes(category = null, limit = 10) {
  const mem = readJSON(L2_FILE, { episodes: [] });
  let episodes = mem.episodes;
  if (category) episodes = episodes.filter(e => e.category === category);
  return episodes.slice(-limit);
}

function getEpisodesByEmotion(emotionalTag, limit = 10) {
  const mem = readJSON(L2_FILE, { episodes: [] });
  return mem.episodes.filter(e => e.emotionalTag === emotionalTag).slice(-limit);
}

// ─── L3: 语义记忆（Semantic Memory / 知识图谱+偏好库） ─────────
// 实体-关系三元组的知识积累

function addKnowledge(entity, relation, value, source = 'inference') {
  const mem = readJSON(L3_FILE, { knowledge: [] });
  // 去重：同实体+同关系 则更新
  const existing = mem.knowledge.findIndex(k => k.entity === entity && k.relation === relation);
  const entry = {
    entity,
    relation,
    value,
    source,
    updated_at: new Date().toISOString(),
  };
  if (existing >= 0) {
    mem.knowledge[existing] = { ...mem.knowledge[existing], ...entry };
  } else {
    mem.knowledge.push(entry);
  }
  if (mem.knowledge.length > MAX_L3_ENTRIES) {
    mem.knowledge = mem.knowledge.slice(-MAX_L3_ENTRIES);
  }
  writeJSON(L3_FILE, mem);
}

function queryKnowledge(entity = null, relation = null, limit = 20) {
  const mem = readJSON(L3_FILE, { knowledge: [] });
  let results = mem.knowledge;
  if (entity) results = results.filter(k => k.entity.toLowerCase().includes(entity.toLowerCase()));
  if (relation) results = results.filter(k => k.relation.toLowerCase().includes(relation.toLowerCase()));
  return results.slice(-limit);
}

function getAllKnowledge() {
  return readJSON(L3_FILE, { knowledge: [] }).knowledge;
}

// ─── 偏好库（特殊化的 L3） ──────────────────────────────────

function savePreference(key, value) {
  const prefs = readJSON(PREF_FILE, { preferences: {} });
  prefs.preferences[key] = {
    value,
    updated_at: new Date().toISOString(),
  };
  writeJSON(PREF_FILE, prefs);
}

function getPreference(key) {
  const prefs = readJSON(PREF_FILE, { preferences: {} });
  return prefs.preferences[key]?.value || null;
}

function getAllPreferences() {
  return readJSON(PREF_FILE, { preferences: {} }).preferences;
}

function getPreferenceBlock() {
  const prefs = readJSON(PREF_FILE, { preferences: {} });
  const entries = Object.entries(prefs.preferences);
  if (entries.length === 0) return '';
  const lines = ['【银月已知的主人偏好】'];
  for (const [key, val] of entries.slice(-10)) {
    lines.push(`  - ${key}: ${val.value}`);
  }
  return lines.join('\n');
}

// ─── 整体检索 ────────────────────────────────────────────────

function searchAll(keyword, limit = 5) {
  const kw = keyword.toLowerCase();
  const results = [];

  // L1 工作记忆
  const l1 = readJSON(L1_FILE, { entries: [] });
  results.push(...l1.entries.filter(e => e.content.toLowerCase().includes(kw)).slice(-limit));

  // L2 情景
  const l2 = readJSON(L2_FILE, { episodes: [] });
  results.push(...l2.episodes.filter(e => e.summary.toLowerCase().includes(kw)).slice(-limit));

  // L3 语义
  const l3 = readJSON(L3_FILE, { knowledge: [] });
  results.push(...l3.knowledge.filter(k =>
    k.entity.toLowerCase().includes(kw) || k.value.toLowerCase().includes(kw)
  ).slice(-limit));

  return results;
}

function getMemorySummary() {
  const l1 = readJSON(L1_FILE, { entries: [] });
  const l2 = readJSON(L2_FILE, { episodes: [] });
  const l3 = readJSON(L3_FILE, { knowledge: [] });
  return {
    working_memory: l1.entries.length,
    episodic_memory: l2.episodes.length,
    semantic_knowledge: l3.knowledge.length,
    recent_l1: l1.entries.slice(-5).map(e => ({ type: e.type, time: e.timestamp })),
    recent_l2: l2.episodes.slice(-3).map(e => ({ summary: e.summary.slice(0, 100), category: e.category })),
  };
}

function getMemoryForPrompt() {
  const parts = [];

  const prefs = getPreferenceBlock();
  if (prefs) parts.push(prefs);

  const l2recent = getRecentEpisodes('feedback', 3);
  if (l2recent.length > 0) {
    const lines = ['【近期重要反馈】'];
    for (const ep of l2recent) {
      lines.push(`  [${new Date(ep.timestamp).toLocaleString('zh-CN')}] ${ep.summary}`);
    }
    parts.push(lines.join('\n'));
  }

  const l3recent = getAllKnowledge().slice(-5);
  if (l3recent.length > 0) {
    const lines = ['【银月积累的知识】'];
    for (const k of l3recent) {
      lines.push(`  - ${k.entity} → ${k.relation}: ${k.value}`);
    }
    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n');
}

module.exports = {
  addToWorkingMemory,
  getWorkingMemory,
  searchWorkingMemory,
  addEpisode,
  getRecentEpisodes,
  getEpisodesByEmotion,
  addKnowledge,
  queryKnowledge,
  getAllKnowledge,
  savePreference,
  getPreference,
  getAllPreferences,
  getPreferenceBlock,
  searchAll,
  getMemorySummary,
  getMemoryForPrompt,
};
