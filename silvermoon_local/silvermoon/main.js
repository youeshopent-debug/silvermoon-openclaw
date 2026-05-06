const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const net = require('net');
const childProcess = require('child_process');
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const {
  classifyTaskKind,
  extractTaskNeed,
  applyTaskContractToReply,
  fingerprintUserTask,
} = require('./lib/task-contract');
const { parseReminderIntent } = require('./lib/reminder-intent');
const { selectRecentPendingReminder, selectPendingReminderByIdPrefix } = require('./lib/reminder-store');
const { ExecAudit } = require('./lib/exec-audit');
const { RestrictedExecutor } = require('./lib/restricted-exec');
const { ApprovalGate } = require('./lib/approval-gate');
const { ingestStripeEventToLedger } = require('./lib/stripe-ledger-ingest');
const { isModelDownNoticeText, toCompactModelDownReply } = require('./lib/model-down-guard');
const { fetchUsdMyrWithFallback, fetchGoldSpotUsdWithFallback } = require('./lib/finance-fallback');
const { sendDiscordWithFallback } = require('./lib/discord-send-fallback');
const { buildSilvermoonSystemPrompt, buildWorkCard } = require('./lib/persona-silvermoon');
const { routeWithLLM } = require('./lib/brain-router');
const { executeTool } = require('./lib/tools');
const { callGeminiText } = require('./lib/gemini-client');
const { startDispatchConsumer } = require('./lib/dispatch-consumer');
const { renderModelDownReply } = require('./lib/model-down-reply');
const { parseEnvText } = require('./lib/env-parse');
const { tryIntentIntercept } = require('./lib/intent');
const { createMemory } = require('./lib/memory');
const { postprocessSilvermoonReply } = require('./lib/silvermoon-postprocess');
const { classifyComplexity, getLlmParams, isDuplicate } = require('./lib/conversation');
const workflow = require('./lib/workflow');
const { sanitize } = require('./lib/sanitizer');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return false;
  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    const env = parseEnvText(raw);
    for (const [k, v] of Object.entries(env)) {
      if (!k) continue;
      if (process.env[k] != null && String(process.env[k]).length > 0) continue;
      process.env[k] = String(v || '');
    }
    return true;
  } catch {
    return false;
  }
}

loadDotEnv();

function loadUserDataEnvIfNeeded() {
  const envPath = path.join(__dirname, 'user_data', 'openclaw.env');
  if (!fs.existsSync(envPath)) return false;
  let changed = false;
  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    const env = parseEnvText(raw);
    for (const [k, v] of Object.entries(env)) {
      if (!k) continue;
      process.env[k] = String(v || '');
      changed = true;
    }
    return changed;
  } catch {
    return false;
  }
}

function normalizeDiscordToken(v) {
  const raw = String(v || '');
  const noZW = raw.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const trimmed = noZW.trim();
  const unquoted =
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ? trimmed.slice(1, -1)
      : trimmed;
  const noSpace = unquoted.replace(/\s+/g, '');
  return noSpace;
}

function ensureCoreSkillsLocked() {
  const cfgPath = path.join(__dirname, 'openclaw.json');
  if (!fs.existsSync(cfgPath)) return false;
  let raw = '';
  try {
    raw = fs.readFileSync(cfgPath, 'utf-8');
  } catch {
    return false;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    return false;
  }

  const core = [
    'openviking',
    'claude-mem',
    'claude-code',
    'self-improving-agent',
    'automation-workflows',
    'vibe-coding',
    'skill-vetter',
    'proactive-agent',
    'open-cli',
    'github',
    'office-suite',
    'humanizer',
    'find-skills',
    'web-fetch',
    'browser',
  ];

  if (!cfg.agents || typeof cfg.agents !== 'object') cfg.agents = {};
  if (!cfg.agents.defaults || typeof cfg.agents.defaults !== 'object') cfg.agents.defaults = {};

  const curDefaults = Array.isArray(cfg.agents.defaults.skills) ? cfg.agents.defaults.skills : [];
  const needWriteDefaults = JSON.stringify(curDefaults) !== JSON.stringify(core);
  if (needWriteDefaults) cfg.agents.defaults.skills = core;

  const list = Array.isArray(cfg.agents.list) ? cfg.agents.list : [];
  let changed = needWriteDefaults;
  for (const a of list) {
    const cur = Array.isArray(a.skills) ? a.skills : [];
    if (JSON.stringify(cur) !== JSON.stringify(core)) {
      a.skills = core;
      changed = true;
    }
  }
  cfg.agents.list = list;

  if (!changed) return false;
  try {
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

const WORKSPACE_DIR = path.join(__dirname, 'workspace');
const SOUL_PATH = path.join(WORKSPACE_DIR, 'SOUL.md');
const AGENTS_DIR = path.join(WORKSPACE_DIR, 'AGENTS_SOUL');
const OPENCLAW_CONFIG_PATH = path.join(__dirname, 'openclaw.json');
const OPENCLAW_WORKSPACES_ROOT = path.join(AGENTS_DIR, '.openclaw-workspaces');
const AGENT_PROTOCOLS_DIR = path.join(WORKSPACE_DIR, 'AGENT_PROTOCOLS');
const HEARTBEAT_PATH = path.join(WORKSPACE_DIR, 'HEARTBEAT.md');
const CRON_DIR = path.join(WORKSPACE_DIR, 'CRON');
const LOCKS_DIR = path.join(WORKSPACE_DIR, '.locks');
const MEMORY_VAULT_PATH = path.join(WORKSPACE_DIR, 'MEMORY_VAULT.md');
const MEMORY_PATH = path.join(WORKSPACE_DIR, 'MEMORY.md');
const MEMORY_EVENTS_PATH = path.join(WORKSPACE_DIR, 'MEMORY_EVENTS.jsonl');
const INTEL_REPORT_PATH = path.join(WORKSPACE_DIR, 'INTEL_REPORT.md');
const LEADS_PATH = path.join(WORKSPACE_DIR, 'LEADS.md');
const DESIGN_SPEC_PATH = path.join(WORKSPACE_DIR, 'DESIGN.md');
const FINANCE_LOCK_PATH = path.join(LOCKS_DIR, 'finance.lock');
const AUTODREAM_LOCK_PATH = path.join(LOCKS_DIR, 'autodream.lock');
const LATENCY_WARN_MS = Number(process.env.LATENCY_WARN_MS || 2500);
const RTK_TOP_K = Number(process.env.RTK_TOP_K || 6);
const RTK_MAX_CHARS = Number(process.env.RTK_MAX_CHARS || 5200);
const RTK_SOUL_MAX_CHARS = Number(process.env.RTK_SOUL_MAX_CHARS || 2800);
const STAFF_REQUESTS_PATH = path.join(WORKSPACE_DIR, 'STAFF_REQUESTS.md');
const STAFF_PENDING_DIR = path.join(AGENTS_DIR, 'PENDING');
const STAFF_LOCK_PATH = path.join(LOCKS_DIR, 'staff.lock');
const CLI_ANYTHING_DIR = path.join(WORKSPACE_DIR, 'CLI_ANYTHING');
const CLI_REGISTRY_PATH = path.join(CLI_ANYTHING_DIR, 'registry.json');
const CLI_LOG_DIR = path.join(CLI_ANYTHING_DIR, 'logs');
const HARNESS_PATH_ROOT = path.join(__dirname, 'HARNESS.md');
const HARNESS_PATH_WS = path.join(WORKSPACE_DIR, 'HARNESS.md');
const CODEX_LOCK_PATH = path.join(LOCKS_DIR, 'codex.lock');
const CHANGELOG_PROPOSAL_PATH = path.join(WORKSPACE_DIR, 'CHANGELOG_PROPOSAL.md');
const SANDBOX_DIR = path.join(WORKSPACE_DIR, 'SANDBOX');
const CODE_REFINEMENT_PATH = path.join(WORKSPACE_DIR, 'CODE_REFINEMENT.md');
const DROPBOX_DIR = path.join(WORKSPACE_DIR, 'DROPBOX');
const DROPBOX_RECEIPTS_DIR = path.join(DROPBOX_DIR, '_RECEIPTS');
const DROPBOX_DELIVERIES_LOG = path.join(DROPBOX_RECEIPTS_DIR, 'deliveries.jsonl');
const ERRORS_LOG_PATH = path.join(CRON_DIR, 'errors.jsonl');
const BRIEF_CACHE_PATH = path.join(CRON_DIR, 'brief_cache.json');
const EXEC_APPROVALS_LOG_PATH = path.join(CRON_DIR, 'exec_approvals.jsonl');
const EXEC_AUDIT_LOG_PATH = path.join(CRON_DIR, 'exec_audit.jsonl');
const REMINDERS_PATH = path.join(CRON_DIR, 'reminders.json');
const RESTART_REQUEST_PATH = path.join(CRON_DIR, 'restart.request');
const CASHCLAW_DIR = path.join(WORKSPACE_DIR, 'CASHCLAW');
const CASHCLAW_STRIPE_EVENTS_PATH = path.join(CASHCLAW_DIR, 'stripe.events.jsonl');
const CASHCLAW_STRIPE_LOCK_PATH = path.join(LOCKS_DIR, 'cashclaw_stripe.lock');
const CASHCLAW_FX_MAX_AGE_MS = Number(process.env.CASHCLAW_FX_MAX_AGE_MS || 10 * 60 * 1000);
const LANG_MODE_MAP_PATH = path.join(WORKSPACE_DIR, 'CHANNEL_LANG_MODE.json');
const CHANNEL_AGENT_MAP_PATH = path.join(WORKSPACE_DIR, 'CHANNEL_AGENT_MAP.json');
const PUA_STATE_PATH = path.join(WORKSPACE_DIR, 'PUA_STATE.json');
const REDBOX_LOCK_PATH = path.join(LOCKS_DIR, 'redbox.lock');
const USER_DATA_DIR = path.join(__dirname, 'user_data');
const LONG_TERM_DB_PATH = path.join(USER_DATA_DIR, 'long_term_memory.db');
const OWNER_CONTEXT_PATH = path.join(USER_DATA_DIR, 'owner_context.json');
const MEMORY_SQLITE_PATH = path.join(USER_DATA_DIR, 'memory', 'silvermoon_memory.sqlite');
const memory = createMemory({ dbPath: MEMORY_SQLITE_PATH });
const USER_PROFILE_PATH = path.join(WORKSPACE_DIR, 'USER.md');
const JARVIS_WAKE_WORDS = (process.env.JARVIS_WAKE_WORDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 45_000);
const CLOUD_TIMEOUT_MS = Number(process.env.CLOUD_TIMEOUT_MS || 45_000);
const DISCORD_MAX_UPLOAD_BYTES = Number(process.env.DISCORD_MAX_UPLOAD_BYTES || 8 * 1024 * 1024);
const ZERO_TOKEN_BASE_URL = String(process.env.OPENCLAW_ZERO_TOKEN_URL || '').trim();
const ZERO_TOKEN_GATEWAY_TOKEN = String(process.env.OPENCLAW_ZERO_TOKEN_TOKEN || '').trim();
const ZERO_TOKEN_MODEL_DEFAULT = String(process.env.OPENCLAW_ZERO_TOKEN_MODEL || 'deepseek-web/deepseek-chat').trim();
const OPENCLAW_TZ_OFFSET_MIN = Number(process.env.OPENCLAW_TZ_OFFSET_MIN || 480);
const BUILD_TAG = '2026-04-16_opsdash_v1';

const MORNING_BRIEF_HH = Number(process.env.MORNING_BRIEF_HH || 8);
const MORNING_BRIEF_MM = Number(process.env.MORNING_BRIEF_MM || 0);
const NIGHTLY_REPORT_HH = Number(process.env.NIGHTLY_REPORT_HH || 23);
const NIGHTLY_REPORT_MM = Number(process.env.NIGHTLY_REPORT_MM || 55);

const CORE_SKILLS = [
  'long-term-memory',
  'voice-wakeup',
  'jarvis-core',
  'persistent-agent',
  'self-learning',
  'openclaw-zero-token',
  'self-improving-agent',
  'skill-vetter',
  'cloud-mem',
  'open-viking',
  'find-skills',
  'automation-workflows',
  'claude-legal-skill',
];

const EXTRA_SKILL_CATALOG = {
  '美杜莎': ['vision-enhancer', 'ui-layout-analyzer', 'design-md'],
  '雅妃': ['stripe-payment-flow', 'lemon-squeezy-api-bridge'],
  '小医仙': ['social-trends-scanner', 'viral-hook-generator', 'redbox'],
  '紫研': ['avatar-video-renderer', 'spatial-logic-solver', 'narrator-voice-render'],
  '李长寿': ['error-auto-healer', 'proxy-rotator', 'codex-bridge', 'design-md', 'laptop-control'],
  '药老': ['pentagi-audit', 'redbox-maintenance', 'seo-optimizer', 'multi-style-writer', 'narrator-script'],
  '银月': ['task-router-core', 'design-md', 'narrator-ai-skill'],
  '墨影': ['toolchain-crafter'],
  '紫灵': ['concierge-dialog-orchestrator'],
  '萧炎': ['market-signal-synthesizer', 'ai-hedge-fund', 'trading-agent'],
  '韩立': ['autora-autoresearch', 'job-intel-crawler', 'public-apis', 'searxng-search', 'jina-reader', 'gog-search', 'narrator-research-pack', 'notebooklm'],
};

// ── 快速回复表：拦截简单问候，跳过 LLM ──
const QUICK_REPLY_TABLE = [
  { patterns: [/^(在[吗嘛]|hi\b|hello|嗨|你好|嘿|喂|银月|在不在|睡了[吗嘛]|早安|晚安|早[上啊]?|下午好|晚上好)/i, /^你又来[了]?[！!？?]*$/i, /^干嘛[呢]?[！!？?]*$/i, /^在[不]?[！!？?]*$/i], replies: ['主人，银月在的～请说。', '在的，主人～', '主人请讲～', '在的，主人！银月听令。'] },
  { patterns: [/^(好[的吧]?|ok\b|嗯|行|可以|没问题|收到|明白|了解|知道了|好的吧)/i], replies: ['好的，主人～', '明白，主人。', '收到！'] },
  { patterns: [/^(谢谢|多谢|感谢|辛苦了|thank|thanks|tq|thx)/i], replies: ['不客气，主人～', '应该的，主人。', '随时为您效劳，主人。'] },
  { patterns: [/^(拜拜|再见|bye|see\s*you|明天见|88)/i], replies: ['主人慢走～', '再见，主人～', '随时找我，主人。'] },
  { patterns: [/^(哈哈|haha|lol|笑死|有趣|好玩)/i], replies: ['主人开心就好～', '😊', '能逗主人一笑是我的荣幸～'] },
];

/** 5 秒内防重复回复 */
const _qrSentMap = new Map();
function _isDuplicate(channelId, text) {
  const key = `${channelId}:${String(text || '').slice(0, 30)}`;
  const now = Date.now();
  const prev = _qrSentMap.get(key);
  if (prev && now - prev < 5000) return true;
  _qrSentMap.set(key, now);
  for (const [k, v] of _qrSentMap) { if (now - v > 60000) _qrSentMap.delete(k); }
  return false;
}

/** 尝试快速回复匹配，返回随机预设回复或 null */
function tryQuickReply(text, channelId) {
  const cleaned = String(text || '').trim().toLowerCase();
  if (!cleaned) return null;
  for (const entry of QUICK_REPLY_TABLE) {
    for (const re of entry.patterns) {
      if (re.test(cleaned)) {
        const reply = entry.replies[Math.floor(Math.random() * entry.replies.length)];
        if (_isDuplicate(channelId, reply)) return null;
        return reply;
      }
    }
  }
  return null;
}

const STATE = {
  agents: [],
  agentSkills: {},
  skillVisibility: {},
  selfCheck: {
    lastAt: null,
    proxy: { ok: null, detail: null, at: null },
    ollama: { ok: null, detail: null, at: null },
  },
  pua: {
    byChannel: {},
  },
  shortMemory: {
    byChannel: {},
  },
  ollama: {
    models: null,
    selectedModel: null,
    lastLatencyMs: null,
    lastOkAt: null,
    lastErrAt: null,
    highLatencyStreak: 0,
  },
  groq: {
    modelIds: null,
    lastFetchAt: null,
  },
  memory: {
    lastAutoDreamAt: null,
    nextAutoDreamAt: null,
    lastLongTermAppendAt: null,
  },
  jarvis: {
    enabled: true,
    wakeWords: JARVIS_WAKE_WORDS,
  },
  locks: {
    finance: { locked: false, since: null, by: null },
    autodream: { locked: false, since: null, by: null },
    codex: { locked: false, since: null, by: null },
    redbox: { locked: false, since: null, by: null },
    staff: { locked: false, since: null, by: null },
  },
  cron: {
    tasks: [],
    lastRuns: {},
    nextRuns: {},
  },
  reminders: {
    timersById: {},
  },
  discord: {
    ownerUserId: process.env.OWNER_USER_ID || null,
    lastOwnerChannelId: null,
    client: null,
    inflightByChannel: {},
    inflightSinceByChannel: {},
    pendingByChannel: {},
    lastQueueNoticeAtByChannel: {},
    queueNoticeActiveByChannel: {},
    lastUserVerboseByChannel: {},
    lastUserTextByChannel: {},
    lastNoticeAtByChannel: {},
    seenMessageIds: {},
    seenMessageOrder: [],
    lastAssistantReplyByChannel: {},
    langModeByChannel: {},
    langModeExpiresAtByChannel: {},
    taskContractByChannel: {},
    taskAskCooldownByChannel: {},
  },
  cli: {
    lastDryRunAt: null,
    lastRunAt: null,
    lastTool: null,
    lastOk: null,
  },
  routing: {
    useCloud: false,
    proxyPool: null,
    proxyIndex: 0,
    proxyOk: null,
    forceLocal: false,
  },
  cashclaw: {
    stripe: {
      seenEventIds: new Set(),
      lastLoadedAt: null,
    },
  },
};

const LOG_LEVEL = String(process.env.OPENCLAW_LOG_LEVEL || process.env.LOG_LEVEL || 'warn').toLowerCase();
const LOG_RANK = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
function logAt(level, ...args) {
  const cur = LOG_RANK[LOG_LEVEL] ?? 2;
  const want = LOG_RANK[level] ?? 2;
  if (want > cur) return;
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
}
const logDebug = (...args) => logAt('debug', ...args);
const logInfo = (...args) => logAt('info', ...args);

function logErrorEvent(category, message, detail, ctx) {
  try {
    ensureDir(CRON_DIR);
    const c = String(category || 'unknown').slice(0, 40);
    const msg = redactSecrets(String(message || '')).slice(0, 800);
    const det = redactSecrets(String(detail || '')).slice(0, 2000);
    appendJsonl(ERRORS_LOG_PATH, {
      at: new Date().toISOString(),
      category: c,
      message: msg,
      detail: det || null,
      channelId: ctx?.channelId || null,
      agent: ctx?.agent || null,
      where: ctx?.where || null,
    });
  } catch {}
}

function safeReadUtf8(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
}

function safeResolveUnder(rootDir, reqPath) {
  const root = path.resolve(rootDir);
  const rel = String(reqPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const clean = rel.split('/').filter((p) => p && p !== '.' && p !== '..').join(path.sep);
  const abs = path.resolve(root, clean);
  if (!abs.startsWith(root)) return null;
  return abs;
}

function markSeenDiscordMessage(id) {
  const mid = String(id || '').trim();
  if (!mid) return true;
  const now = Date.now();
  const seen = STATE.discord.seenMessageIds || {};
  if (seen[mid]) return false;
  seen[mid] = now;
  STATE.discord.seenMessageIds = seen;
  if (!Array.isArray(STATE.discord.seenMessageOrder)) STATE.discord.seenMessageOrder = [];
  STATE.discord.seenMessageOrder.push(mid);

  if (STATE.discord.seenMessageOrder.length > 2200) {
    const cutoff = now - 15 * 60 * 1000;
    const keep = [];
    for (const k of STATE.discord.seenMessageOrder.slice(-2000)) {
      const t = Number(seen[k] || 0);
      if (t && t >= cutoff) keep.push(k);
      else delete seen[k];
    }
    STATE.discord.seenMessageOrder = keep;
  }
  return true;
}

function shouldSuppressDuplicateAssistantReply(channelId, content, ttlMs, userHash) {
  const cid = String(channelId || '').trim();
  if (!cid) return false;
  let s = String(content || '').trim();
  if (!s) return false;
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const now = Date.now();
  const h = fingerprint('assistant_reply', s);
  const last = STATE.discord.lastAssistantReplyByChannel?.[cid] || null;
  const ttl = Math.max(1, Number(ttlMs || 0) || 60_000);
  const uh = String(userHash || '').trim();
  if (last && last.hash === h && now - Number(last.at || 0) < ttl) {
    if (!uh) return true;
    if (String(last.userHash || '') === uh) return true;
  }
  if (!STATE.discord.lastAssistantReplyByChannel) STATE.discord.lastAssistantReplyByChannel = {};
  STATE.discord.lastAssistantReplyByChannel[cid] = { hash: h, at: now, userHash: uh || null };
  return false;
}

function loadLangModeMap() {
  try {
    const raw = readJsonSafe(LANG_MODE_MAP_PATH);
    if (!raw) return;
    if (raw.langModeByChannel && typeof raw.langModeByChannel === 'object') STATE.discord.langModeByChannel = raw.langModeByChannel;
    if (raw.langModeExpiresAtByChannel && typeof raw.langModeExpiresAtByChannel === 'object') {
      STATE.discord.langModeExpiresAtByChannel = raw.langModeExpiresAtByChannel;
    }
  } catch {}
}

function loadOwnerContext() {
  try {
    const raw = readJsonSafe(OWNER_CONTEXT_PATH);
    if (!raw) return;
    const owner = String(raw.ownerUserId || '').trim();
    const ch = String(raw.lastOwnerChannelId || '').trim();
    if (owner) STATE.discord.ownerUserId = owner;
    if (ch) STATE.discord.lastOwnerChannelId = ch;
  } catch {}
}

function saveOwnerContext() {
  try {
    ensureDir(USER_DATA_DIR);
    const payload = {
      updatedAt: new Date().toISOString(),
      ownerUserId: STATE.discord.ownerUserId || null,
      lastOwnerChannelId: STATE.discord.lastOwnerChannelId || null,
    };
    writeFileSafe(OWNER_CONTEXT_PATH, JSON.stringify(payload, null, 2) + '\n');
  } catch {}
}

function saveLangModeMap() {
  try {
    ensureDir(WORKSPACE_DIR);
    writeFileSafe(
      LANG_MODE_MAP_PATH,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          langModeByChannel: STATE.discord.langModeByChannel || {},
          langModeExpiresAtByChannel: STATE.discord.langModeExpiresAtByChannel || {},
        },
        null,
        2,
      ) + '\n',
    );
  } catch {}
}

function getChannelLangMode(channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return 'zh';
  const exp = Number(STATE.discord.langModeExpiresAtByChannel?.[cid] || 0);
  if (exp && Date.now() > exp) {
    delete STATE.discord.langModeByChannel[cid];
    delete STATE.discord.langModeExpiresAtByChannel[cid];
    saveLangModeMap();
  }
  return String(STATE.discord.langModeByChannel?.[cid] || 'zh');
}

function setChannelLangMode(channelId, mode, ttlMs) {
  const cid = String(channelId || '').trim();
  if (!cid) return;
  const m = String(mode || '').trim();
  if (!m) return;
  if (!STATE.discord.langModeByChannel) STATE.discord.langModeByChannel = {};
  if (!STATE.discord.langModeExpiresAtByChannel) STATE.discord.langModeExpiresAtByChannel = {};
  STATE.discord.langModeByChannel[cid] = m;
  const ttl = Number(ttlMs || 0);
  STATE.discord.langModeExpiresAtByChannel[cid] = ttl > 0 ? Date.now() + ttl : 0;
  saveLangModeMap();
}

function detectLangCommand(content) {
  const s = String(content || '').trim();
  const m = s.match(/^(?:\/|!)(?:lang|语言)\s*(zh|cn|中文|en|英文|bi|双语|auto|自动)\s*$/i);
  if (!m) return null;
  const v = String(m[1] || '').toLowerCase();
  if (v === 'zh' || v === 'cn' || v === '中文') return { mode: 'zh', ttlMs: 0 };
  if (v === 'en' || v === '英文') return { mode: 'en', ttlMs: 0 };
  if (v === 'bi' || v === '双语') return { mode: 'zh-bi', ttlMs: 0 };
  if (v === 'auto' || v === '自动') return { mode: 'auto', ttlMs: 0 };
  return null;
}

function shouldAutoEnglish(content) {
  const forceZh = String(process.env.OPENCLAW_FORCE_ZH || process.env.FORCE_ZH || '0').trim() !== '0';
  if (forceZh) return false;
  const autoEn = String(process.env.OPENCLAW_AUTO_EN || '0').trim() === '1';
  if (!autoEn) return false;
  const s = String(content || '').trim();
  if (!s) return false;
  if (/(请用英文|英文回复|用英文|english reply|reply in english)/i.test(s)) return true;
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const total = s.length || 1;
  if (letters >= 18 && letters / total >= 0.35) return true;
  return false;
}

function enforceLangPolicy(text, channelId) {
  const forceZh = String(process.env.OPENCLAW_FORCE_ZH || process.env.FORCE_ZH || '0').trim() !== '0';
  const cid = String(channelId || '').trim();
  const mode = forceZh ? 'zh' : getChannelLangMode(cid);
  const s0 = String(text || '');
  let s = s0;
  if (!s.trim()) return s;
  if (mode === 'en') return s;

  const holes = [];
  const punch = (re) => {
    s = s.replace(re, (m) => {
      const key = `§H${holes.length}§`;
      holes.push(String(m || ''));
      return key;
    });
  };

  punch(/https?:\/\/\S+/gi);
  punch(/DROPBOX\/[A-Za-z0-9._/-]+/g);
  punch(/\/notebook\/[A-Za-z0-9._/-]+/g);
  punch(/[A-Za-z]:\\[^\s]+/g);

  if (mode === 'zh-bi') {
    const bi = [
      { re: /\bP\s*\/\s*E\b/gi, to: '市盈率(P/E)' },
      { re: /\bPE\b/gi, to: '市盈率(PE)' },
      { re: /\bB\s*\/\s*M\b/gi, to: '账面市值比(B/M)' },
      { re: /\bEPS\b/gi, to: '每股收益(EPS)' },
      { re: /\bROI\b/gi, to: '投资回报率(ROI)' },
      { re: /\bCTA\b/gi, to: '行动按钮(CTA)' },
      { re: /\bKPI\b/gi, to: '关键指标(KPI)' },
      { re: /\bOKR\b/gi, to: '目标与关键成果(OKR)' },
      { re: /\bUI\b/gi, to: '界面(UI)' },
      { re: /\bUX\b/gi, to: '体验(UX)' },
      { re: /\bETF\b/gi, to: '交易型开放式指数基金(ETF)' },
      { re: /\bBTC\b/gi, to: '比特币(BTC)' },
      { re: /\bETH\b/gi, to: '以太坊(ETH)' },
      { re: /\bUSDT\b/gi, to: '泰达币(USDT)' },
      { re: /\bUSD\b/gi, to: '美元(USD)' },
      { re: /\bMYR\b/gi, to: '马币(MYR)' },
      { re: /\bAI\b/gi, to: '人工智能(AI)' },
    ];
    for (const it of bi) s = s.replace(it.re, it.to);
  } else {
    const zh = [
      { re: /\bP\s*\/\s*E\b/gi, to: '市盈率' },
      { re: /\bPE\b/gi, to: '市盈率' },
      { re: /\bB\s*\/\s*M\b/gi, to: '账面市值比' },
      { re: /\bEPS\b/gi, to: '每股收益' },
      { re: /\bROI\b/gi, to: '投资回报率' },
      { re: /\bCTA\b/gi, to: '行动按钮' },
      { re: /\bKPI\b/gi, to: '关键指标' },
      { re: /\bOKR\b/gi, to: '目标与关键成果' },
      { re: /\bUI\b/gi, to: '界面' },
      { re: /\bUX\b/gi, to: '体验' },
      { re: /\bETF\b/gi, to: '交易型开放式指数基金' },
      { re: /\bBTC\b/gi, to: '比特币' },
      { re: /\bETH\b/gi, to: '以太坊' },
      { re: /\bUSDT\b/gi, to: '泰达币' },
      { re: /\bUSD\b/gi, to: '美元' },
      { re: /\bMYR\b/gi, to: '马币' },
      { re: /\bAI\b/gi, to: '人工智能' },
      { re: /\bMB\b/gi, to: '兆' },
      { re: /\bGB\b/gi, to: '吉' },
    ];
    for (const it of zh) s = s.replace(it.re, it.to);
  }

  s = s.replace(/(\d+)\s*x\b/gi, (_, n) => `${n}倍`);

  if (mode !== 'zh-bi') {
    s = s.replace(/[A-Za-z][A-Za-z0-9.&/_-]{0,40}/g, '');
  }

  s = s
    .replace(/（\s*）/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  s = s.replace(/§H(\d+)§/g, (_, i) => holes[Number(i)] || '');
  return s;
}

function parseStripeSignatureHeader(sig) {
  const out = { t: null, v1: [] };
  const s = String(sig || '').trim();
  if (!s) return out;
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k || !v) continue;
    if (k === 't') out.t = v;
    else if (k === 'v1') out.v1.push(v);
  }
  return out;
}

function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSec) {
  const sec = String(secret || '').trim();
  if (!sec) return { ok: false, reason: 'missing_secret' };
  const parsed = parseStripeSignatureHeader(sigHeader);
  const t = Number(parsed.t || 0);
  if (!t || !Number.isFinite(t)) return { ok: false, reason: 'bad_timestamp' };
  const nowSec = Math.floor(Date.now() / 1000);
  const tol = Math.max(10, Number(toleranceSec || 300));
  if (Math.abs(nowSec - t) > tol) return { ok: false, reason: 'timestamp_out_of_tolerance', t };
  const payload = `${t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', sec).update(payload, 'utf8').digest('hex');
  for (const cand of parsed.v1 || []) {
    try {
      const a = Buffer.from(String(cand || ''), 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true, t };
    } catch {}
  }
  return { ok: false, reason: 'bad_signature', t };
}

function loadCashclawStripeSeenIds() {
  try {
    ensureDir(CASHCLAW_DIR);
    if (!fs.existsSync(CASHCLAW_STRIPE_EVENTS_PATH)) return;
    const raw = readLastChars(CASHCLAW_STRIPE_EVENTS_PATH, 260_000);
    if (!raw) return;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const ids = [];
    for (let i = lines.length - 1; i >= 0 && ids.length < 4000; i -= 1) {
      const l = lines[i];
      if (!l || l[0] !== '{') continue;
      try {
        const j = JSON.parse(l);
        const id = String(j?.eventId || '').trim();
        if (id) ids.push(id);
      } catch {}
    }
    for (const id of ids) STATE.cashclaw.stripe.seenEventIds.add(id);
    STATE.cashclaw.stripe.lastLoadedAt = new Date().toISOString();
  } catch {}
}

function startLinkServer() {
  const enabled = String(process.env.OPENCLAW_LINK_SERVER || '1').trim() !== '0';
  if (!enabled) return;

  const port = Number(process.env.OPENCLAW_LINK_PORT || 18791);
  const bind = String(process.env.OPENCLAW_LINK_BIND || '127.0.0.1').trim() || '127.0.0.1';
  const rootNotebook = path.join(WORKSPACE_DIR, 'notebook');
  const rootDropbox = DROPBOX_DIR;
  ensureDir(rootNotebook);
  ensureDir(path.join(rootNotebook, 'lm'));
  try {
    const p = path.join(rootNotebook, 'lm', 'notebook_lm.txt');
    if (!fs.existsSync(p)) fs.writeFileSync(p, 'OPENCLAW_NOTEBOOK\n', 'utf-8');
  } catch {}
  ensureDir(rootDropbox);

  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url || '/', `http://${bind}:${port}`);
      const p = decodeURIComponent(u.pathname || '/');

      if (p === '/' || p === '/control') {
        const html = buildOpsDashboardHtml();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
        return;
      }

      if (p === '/api/status') {
        await selfCheckConnectivity();
        const tzNow = getTzNow();
        const err = getErrorsTodaySummary();
        const cashclawEnabledRaw = String(process.env.CASHCLAW_ENABLED || '').trim().toLowerCase();
        const cashclawEnabled = cashclawEnabledRaw === '1' || cashclawEnabledRaw === 'true';
        const payload = {
          build: BUILD_TAG,
          pid: process.pid,
          at: formatTs(tzNow),
          proxy: STATE.selfCheck?.proxy || null,
          ollama: STATE.selfCheck?.ollama || null,
          cashclaw: {
            enabled: cashclawEnabled,
            stripeSecretSet: Boolean(String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()),
          },
          errors: { total: err.total || 0, lastAt: err.lastAt || null },
          cron: {
            tasks: STATE.cron?.tasks || [],
            lastRuns: STATE.cron?.lastRuns || {},
            nextRuns: STATE.cron?.nextRuns || {},
          },
          locks: STATE.locks || {},
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload, null, 2));
        return;
      }

      if (p === '/api/today/deliveries') {
        const payload = getDropboxDeliveriesTodayDetails();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload, null, 2));
        return;
      }

      if (p === '/api/today/errors') {
        const payload = getErrorsTodaySummary();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload, null, 2));
        return;
      }

      if (p === '/api/actions/morning-brief' && String(req.method || '').toUpperCase() === 'POST') {
        try {
          const tzNow = getTzNow();
          const forceRaw = String(u.searchParams.get('force') || '').trim().toLowerCase();
          const force = forceRaw === '1' || forceRaw === 'true' || forceRaw === 'yes';
          const r = await runSilverMoonMorningBrief({ force, source: 'api' });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: Boolean(r?.ok), at: formatTs(tzNow), skipped: Boolean(r?.skipped), force }, null, 2));
        } catch (e) {
          logErrorEvent('action', 'morning-brief failed', e?.message || e, { where: 'linkserver' });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
        }
        return;
      }

      if (p === '/api/actions/health-check' && String(req.method || '').toUpperCase() === 'POST') {
        try {
          await selfCheckConnectivity();
          const tzNow = getTzNow();
          const mu = process.memoryUsage();
          const parts = [];
          parts.push('🛡️ 墨影体检（即时）');
          parts.push(`时间：${formatTs(tzNow)}`);
          parts.push('');
          parts.push(`🔹 代理：${STATE.selfCheck?.proxy?.ok ? '连通/不需要' : '不可用'}（${STATE.selfCheck?.proxy?.detail || '无'}）`);
          parts.push(`🔹 Ollama：${STATE.selfCheck?.ollama?.ok ? '在线' : '离线'}（${STATE.selfCheck?.ollama?.detail || '无'}）`);
          parts.push(`🔹 模型成功：${STATE.ollama.lastOkAt || '无'} | 错误：${STATE.ollama.lastErrAt || '无'}`);
          parts.push(`🔹 内存：RSS ${Math.round(mu.rss / 1024 / 1024)}MB | HeapUsed ${Math.round(mu.heapUsed / 1024 / 1024)}MB`);
          parts.push(`🔹 锁：finance=${STATE.locks?.finance?.locked ? '占用' : '空闲'} staff=${STATE.locks?.staff?.locked ? '占用' : '空闲'} codex=${STATE.locks?.codex?.locked ? '占用' : '空闲'}`);
          const body = safeChineseOnly(parts.join('\\n').trim(), false);
          const fileName = `${formatYmd(tzNow)}_体检.md`;
          writeFileSafe(path.join(CRON_DIR, fileName), body + '\\n');
          await notifyOwner(body);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, at: formatTs(tzNow), file: fileName }, null, 2));
        } catch (e) {
          logErrorEvent('action', 'health-check failed', e?.message || e, { where: 'linkserver' });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
        }
        return;
      }

      if (p === '/api/actions/restart' && String(req.method || '').toUpperCase() === 'POST') {
        try {
          const tzNow = getTzNow();
          const body = JSON.stringify({ at: new Date().toISOString(), reason: 'dashboard', pid: process.pid });
          writeFileSafe(RESTART_REQUEST_PATH, body + '\\n');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, at: formatTs(tzNow), file: 'workspace/CRON/restart.request' }, null, 2));
        } catch (e) {
          logErrorEvent('action', 'restart request failed', e?.message || e, { where: 'linkserver' });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }, null, 2));
        }
        return;
      }

      if (p === '/api/cashclaw/stripe/webhook' && String(req.method || '').toUpperCase() === 'POST') {
        const enabledRaw = String(process.env.CASHCLAW_ENABLED || '0').trim().toLowerCase();
        const enabled = enabledRaw === '1' || enabledRaw === 'true';
        if (!enabled) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Not Found');
          return;
        }
        const sig = String(req.headers['stripe-signature'] || '').trim();
        const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
        const chunks = [];
        let bytes = 0;
        const maxBytes = 1024 * 1024;
        await new Promise((resolve) => {
          req.on('data', (c) => {
            try {
              const b = Buffer.isBuffer(c) ? c : Buffer.from(c);
              bytes += b.length;
              if (bytes <= maxBytes) chunks.push(b);
            } catch {}
          });
          req.on('end', resolve);
          req.on('error', resolve);
        });
        if (bytes > maxBytes) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'payload_too_large' }));
          return;
        }
        const rawBuf = Buffer.concat(chunks);
        const raw = rawBuf.toString('utf-8');
        const sigOk = verifyStripeSignature(raw, sig, secret, Number(process.env.CASHCLAW_STRIPE_TOLERANCE_SEC || 300));
        if (!sigOk.ok) {
          logErrorEvent('cashclaw', 'stripe webhook signature failed', sigOk.reason || 'bad_signature', { where: 'cashclaw_stripe' });
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'bad_signature' }));
          return;
        }
        let evt = null;
        try {
          evt = raw ? JSON.parse(raw) : null;
        } catch {}
        const eventId = String(evt?.id || '').trim();
        if (eventId && STATE.cashclaw.stripe.seenEventIds.has(eventId)) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, dedup: true }));
          return;
        }
        const record = {
          at: new Date().toISOString(),
          source: 'stripe',
          eventId: eventId || null,
          type: String(evt?.type || '').trim() || null,
          livemode: typeof evt?.livemode === 'boolean' ? evt.livemode : null,
          created: typeof evt?.created === 'number' ? evt.created : null,
          sigTs: sigOk.t || null,
          rawSha256: crypto.createHash('sha256').update(rawBuf).digest('hex'),
          rawBytes: rawBuf.length,
          body: evt || null,
        };
        const locked = await withLock(CASHCLAW_STRIPE_LOCK_PATH, 'cashclaw', 'cashclaw', async () => {
          ensureDir(CASHCLAW_DIR);
          const persistOk = appendJsonl(CASHCLAW_STRIPE_EVENTS_PATH, record);
          if (!persistOk) return { persistOk: false, ledger: null };

          const writeJson = (p, obj) => {
            ensureDir(path.dirname(p));
            fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
          };
          const readJson = (p) => readJsonSafe(p);

          const ledger = await ingestStripeEventToLedger({
            event: evt,
            dbPath: path.join(CASHCLAW_DIR, 'ledger.sqlite'),
            briefCachePath: BRIEF_CACHE_PATH,
            maxAgeMs: CASHCLAW_FX_MAX_AGE_MS,
            now: new Date(record.at),
            readJson,
            writeJson,
            refreshUsdMyr: async () => {
              const fx = await fetchUsdMyr();
              if (!Number.isFinite(fx) || fx <= 0) throw new Error('fx_null');
              return { fx, fxSource: 'exchangerate.host', fxAsOf: new Date().toISOString() };
            },
            rawHash: `sha256:${record.rawSha256}`,
          });

          return { persistOk: true, ledger };
        });
        if (!locked.ok || locked.value?.persistOk !== true) {
          logErrorEvent('cashclaw', 'stripe webhook persist failed', eventId || 'no_event_id', { where: 'cashclaw_stripe' });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'persist_failed' }));
          return;
        }

        if (locked.value?.ledger && locked.value.ledger.ok === false && locked.value.ledger.reason !== 'unsupported_type') {
          const reason = String(locked.value.ledger.reason || 'ledger_failed');
          logErrorEvent('cashclaw', 'stripe ledger ingest failed', reason, { where: 'cashclaw_ledger', eventId: eventId || null });
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: reason }));
          return;
        }
        if (eventId) STATE.cashclaw.stripe.seenEventIds.add(eventId);
        const notify = String(process.env.CASHCLAW_NOTIFY_OWNER || '0').trim() === '1';
        if (notify) {
          try {
            await notifyOwner(`💰 CASHCLAW 收到 Stripe 回调\n🔹 type: ${record.type || 'unknown'}\n🔹 id: ${eventId || 'unknown'}`);
          } catch {}
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (!p.startsWith('/notebook/') && !p.startsWith('/dropbox/')) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not Found');
        return;
      }

      const isNotebook = p.startsWith('/notebook/');
      const root = isNotebook ? rootNotebook : rootDropbox;
      const abs = safeResolveUnder(root, p.replace(isNotebook ? /^\/notebook\// : /^\/dropbox\//, '/'));
      if (!abs) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Bad Path');
        return;
      }

      if (!fs.existsSync(abs)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not Found');
        return;
      }

      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        const items = fs.readdirSync(abs, { withFileTypes: true });
        const rel = p.endsWith('/') ? p : `${p}/`;
        const links = items
          .map((e) => {
            const name = e.name;
            const href = `${rel}${encodeURIComponent(name)}${e.isDirectory() ? '/' : ''}`;
            return `<li><a href="${href}">${name}${e.isDirectory() ? '/' : ''}</a></li>`;
          })
          .join('');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<meta charset="utf-8"><h3>${rel}</h3><ul>${links}</ul>`);
        return;
      }

      res.statusCode = 200;
      const ext = String(path.extname(abs) || '').toLowerCase();
      const isText = ['.txt', '.md', '.json', '.csv', '.log'].includes(ext);
      res.setHeader('Content-Type', isText ? 'text/plain; charset=utf-8' : 'application/octet-stream');
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(String(e?.message || e || 'error'));
    }
  });

  server.on('error', (e) => {
    const code = e?.code || 'error';
    if (code === 'EADDRINUSE') {
      logInfo(`⚠️ LinkServer 已在运行或端口被占用：${bind}:${port}`);
      return;
    }
    logInfo(`⚠️ LinkServer 启动失败：${code}`);
  });

  try {
    server.listen(port, bind, () => {
      logInfo(`✅ LinkServer: ${bind}:${port} (/notebook/*)`);
    });
  } catch (e) {
    const code = e?.code || 'error';
    logInfo(`⚠️ LinkServer 启动异常：${code}`);
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildOpsDashboardHtml() {
  const html = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>OpenClaw 运维看板</title>',
    '<style>',
    'body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.55;padding:18px;max-width:1100px;margin:0 auto;font-size:18px;background:#fff;color:#111}',
    'h1{font-size:30px;margin:0 0 6px 0} .muted{color:#666}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px} @media(max-width:900px){.grid{grid-template-columns:1fr}}',
    '.card{border:1px solid #e5e7eb;border-radius:14px;padding:14px;background:#fff}',
    '.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.pill{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid #e5e7eb;background:#f9fafb;font-size:18px}',
    '.dot{width:14px;height:14px;border-radius:50%}',
    '.btn{cursor:pointer;user-select:none;display:inline-flex;align-items:center;justify-content:center;padding:14px 14px;border-radius:14px;border:1px solid #d1d5db;background:#111;color:#fff;font-size:18px;min-height:54px}',
    '.btn.secondary{background:#fff;color:#111} .btn:disabled{opacity:.55;cursor:not-allowed}',
    'pre{white-space:pre-wrap;word-break:break-word;background:#0b1020;color:#e5e7eb;padding:12px;border-radius:14px;font-size:16px;min-height:84px}',
    'table{border-collapse:collapse;width:100%} td,th{border:1px solid #e5e7eb;padding:10px;font-size:16px;text-align:left}',
    'a{color:#2563eb}',
    '</style>',
    '<h1>OpenClaw 运维看板（本机）</h1>',
    '<div class="muted" id="now">时间：-</div>',
    '<div class="muted" id="build" style="margin-bottom:10px">版本：-</div>',
    '<div style="height:10px"></div>',
    '<div class="row" style="margin-bottom:12px">',
    '<div class="pill"><span class="dot" id="dotProxy" style="background:#9ca3af"></span><span id="txtProxy">代理：-</span></div>',
    '<div class="pill"><span class="dot" id="dotOllama" style="background:#9ca3af"></span><span id="txtOllama">Ollama：-</span></div>',
    '<div class="pill"><span class="dot" id="dotErrors" style="background:#9ca3af"></span><span id="txtErrors">今日错误：-</span></div>',
    '</div>',
    '<div class="grid" style="margin-bottom:12px">',
    '<button class="btn" id="btnBrief">立即生成早报</button>',
    '<button class="btn secondary" id="btnDeliveries">今日交付</button>',
    '<button class="btn secondary" id="btnErrors">今日错误/异常</button>',
    '<button class="btn secondary" id="btnNotebookLm">notebook lm</button>',
    '<button class="btn secondary" id="btnHealth">自检（墨影体检）</button>',
    '<button class="btn secondary" id="btnRestart">重启 openclaw（请求）</button>',
    '</div>',
    '<div class="card" style="margin-bottom:12px">',
    '<div style="font-size:22px;margin-bottom:8px">执行结果</div>',
    '<pre id="result">就绪。</pre>',
    '</div>',
    '<div class="grid" style="margin-bottom:12px">',
    '<div class="card">',
    '<div style="font-size:22px;margin-bottom:8px">今日交付</div>',
    '<div id="deliveries">-</div>',
    '</div>',
    '<div class="card">',
    '<div style="font-size:22px;margin-bottom:8px">今日错误/异常</div>',
    '<div id="errors">-</div>',
    '</div>',
    '</div>',
    '<div class="card">',
    '<div style="font-size:22px;margin-bottom:8px">定时任务</div>',
    '<table><thead><tr><th>任务</th><th>上次</th><th>下次</th></tr></thead><tbody id="cronRows"></tbody></table>',
    '</div>',
    '<script>',
    'const qs=(id)=>document.getElementById(id);',
    'function setDot(el, ok){el.style.background=ok===true?\"#16a34a\":ok===false?\"#dc2626\":\"#9ca3af\";}',
    'function fmt(s){return (s==null||s===\"\")?\"无\":String(s)}',
    'async function api(path, opt){const r=await fetch(path,opt||{});const t=await r.text();if(!r.ok) throw new Error(t||(\"HTTP \"+r.status));try{return JSON.parse(t)}catch{return t}}',
    'function renderDeliveries(d){if(!d||!Array.isArray(d.agents)) return \"暂无\"; if(d.agents.length===0) return \"今日未记录到可验收交付\"; const lines=[]; for(const a of d.agents){lines.push(`• ${a.agent}：${a.count} 份`); if(a.recent&&a.recent.length){for(const it of a.recent){lines.push(`　- ${it.relPath}`)}}} return `<div>${lines.map(x=>`<div>${x.replace(/</g,\"&lt;\")}</div>`).join(\"\")}</div>`;}',
    'function renderErrors(e){if(!e) return \"暂无\"; const total=Number(e.total||0); if(total===0) return \"今日错误 0\"; const lines=[]; lines.push(`今日错误：${total}`); if(e.lastAt) lines.push(`最近：${e.lastAt}`); for(const c of (e.categories||[])){lines.push(`• ${c.category}：${c.count}（最近 ${fmt(c.lastAt)}）`); if(c.sample) lines.push(`　- ${c.sample}`)} return `<div>${lines.map(x=>`<div>${String(x).replace(/</g,\"&lt;\")}</div>`).join(\"\")}</div>`;}',
    'function renderCron(st){const rows=[]; const tasks=(st&&st.cron&&st.cron.tasks)||[]; const last=(st&&st.cron&&st.cron.lastRuns)||{}; const next=(st&&st.cron&&st.cron.nextRuns)||{}; for(const t of tasks){rows.push(`<tr><td>${t}</td><td>${fmt(last[t])}</td><td>${fmt(next[t])}</td></tr>`)} qs(\"cronRows\").innerHTML=rows.join(\"\")||\"<tr><td colspan=3>无</td></tr>\";}',
    'function setResult(s){qs(\"result\").textContent=String(s||\"\")}',
    'async function refresh(){try{const st=await api(\"/api/status\"); qs(\"now\").textContent=`时间：${st.at}`; qs(\"build\").textContent=`版本：${fmt(st.build)}（PID ${fmt(st.pid)}）`; qs(\"txtProxy\").textContent=`代理：${st.proxy&&st.proxy.ok?\"连通/不需要\":\"不可用\"}（${fmt(st.proxy&&st.proxy.detail)}）`; setDot(qs(\"dotProxy\"), st.proxy&&st.proxy.ok); qs(\"txtOllama\").textContent=`Ollama：${st.ollama&&st.ollama.ok?\"在线\":\"离线\"}（${fmt(st.ollama&&st.ollama.detail)}）`; setDot(qs(\"dotOllama\"), st.ollama&&st.ollama.ok); const err=st.errors||{total:0}; qs(\"txtErrors\").textContent=`今日错误：${Number(err.total||0)}`; setDot(qs(\"dotErrors\"), Number(err.total||0)===0?true:false); renderCron(st); const d=await api(\"/api/today/deliveries\"); qs(\"deliveries\").innerHTML=renderDeliveries(d); const e=await api(\"/api/today/errors\"); qs(\"errors\").innerHTML=renderErrors(e);}catch(e){setResult(\"刷新失败：\"+(e&&e.message?e.message:e))}}',
    'async function runPost(path){qs(\"btnBrief\").disabled=true; qs(\"btnHealth\").disabled=true; qs(\"btnRestart\").disabled=true; try{setResult(\"执行中…\"); const out=await api(path,{method:\"POST\"}); setResult(JSON.stringify(out,null,2)); await refresh();}catch(e){setResult(\"执行失败：\"+(e&&e.message?e.message:e));}finally{qs(\"btnBrief\").disabled=false; qs(\"btnHealth\").disabled=false; qs(\"btnRestart\").disabled=false;}}',
    'qs(\"btnBrief\").onclick=()=>runPost(\"/api/actions/morning-brief\");',
    'qs(\"btnHealth\").onclick=()=>runPost(\"/api/actions/health-check\");',
    'qs(\"btnRestart\").onclick=()=>runPost(\"/api/actions/restart\");',
    'qs(\"btnDeliveries\").onclick=()=>refresh();',
    'qs(\"btnErrors\").onclick=()=>refresh();',
    'qs(\"btnNotebookLm\").onclick=()=>window.open(\"/notebook/lm/\",\"_blank\");',
    'refresh(); setInterval(refresh, 30000);',
    '</script>',
  ].join('\n');
  return html;
}

function getAgentProtocolPath(agentFileBasename) {
  const bn = String(agentFileBasename || '').trim();
  if (!bn) return null;
  const safe = bn.replace(/[\\/:*?"<>|]/g, '_');
  return path.join(AGENT_PROTOCOLS_DIR, safe);
}

function buildEvolutionProtocolText(agentName) {
  const name = String(agentName || '未知').trim() || '未知';
  return [
    `# Role: ${name} 进化协议`,
    '',
    '## 1. 拒绝复读机行为 (Anti-Bot Protocol)',
    '- 禁止使用统一的“主人/主上”开头，除非语义真的需要。',
    '- 禁止在每一句话结尾都加询问句（如“我还能帮你做什么？”）。',
    '- 严禁重复上一轮对话的语气词或表情符号。',
    '- 对话感要求：说话要像一个正在思考的人。如果没新闻，就吐槽今天世界太安静了，而不是列出 5 个“无重大更新”的列表。',
    '',
    '## 2. 深度自我反省逻辑 (Self-Reflection Logic)',
    '- 当用户表达不满（如“失望”、“没用”、“复读机”）时，立即丢弃所有预设模板。',
    '- 强制步骤：',
    '  1. 分析上一条回复为什么让用户生气（是太啰嗦？还是没干货？）。',
    '  2. 用一句话直接承认错误，不许道歉，要给出改进方案。',
    '  3. 严禁复读“我可以进行自我反省”，直接开始反省！',
    '',
    '## 3. 任务处理：拒绝“格式化”陷阱',
    '- 遇到交付校验未通过时，不要只甩一个填空表格。',
    '- 先用人话解释哪里错了（例如：“Dropbox 路径对不上，或者是你文件太大了，Discord 传不动”），然后再给出简洁的补救指令。',
    '',
    '## 4. 语言风格约束',
    '- 风格：干练、略带一点个人情绪（根据人设选择：冷淡/幽默/毒舌）。',
    '- 限制：单次回复中，Emoji 不得超过 2 个。',
    '- 长度：如果没有实质性技术产出，回复不得超过 3 行。',
    '',
  ].join('\n');
}

function ensureAgentProtocols(agents) {
  try {
    ensureDir(AGENT_PROTOCOLS_DIR);
    for (const a of agents || []) {
      const file = String(a?.file || path.basename(a?.path || '') || '').trim();
      const agentName = String(a?.name || '').trim();
      if (!file || !agentName) continue;
      const p = getAgentProtocolPath(file);
      if (!p) continue;
      const body = buildEvolutionProtocolText(agentName);
      writeFileSafe(p, body);
    }
    const mainP = getAgentProtocolPath('00_MAIN_银月.md');
    if (mainP) writeFileSafe(mainP, buildEvolutionProtocolText('银月'));
  } catch {}
}

function safePathSegment(s) {
  return String(s || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

function resolveDropboxAgentDir(agentName) {
  const n = safePathSegment(agentName || '未知');
  return path.join(DROPBOX_DIR, n);
}

function listDropboxAgentDirs() {
  try {
    if (!fs.existsSync(DROPBOX_DIR)) return [];
    return fs
      .readdirSync(DROPBOX_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => !n.startsWith('_'));
  } catch {
    return [];
  }
}

function isSubPath(parent, child) {
  const rel = path.relative(parent, child);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function parseAgentFromFilename(filename) {
  const base = filename.replace(/\.md$/i, '');
  const parts = base.split('_');
  const code = parts[0] || '';
  const role = parts[1] || '';
  const name = parts[2] || base;
  return { code, role, name, filename };
}

function readOpenclawConfigAgents() {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return [];
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const cfg = JSON.parse(raw);
    const list = cfg?.agents?.list || [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function pickPersonaSourceFileByName(name, allFiles) {
  const n = String(name || '').trim();
  if (!n) return null;
  const matches = (Array.isArray(allFiles) ? allFiles : []).filter((f) => String(f || '').endsWith(`_${n}.md`));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ma = parseAgentFromFilename(String(a || ''));
    const mb = parseAgentFromFilename(String(b || ''));
    const na = parseInt(String(ma.code || '9999'), 10);
    const nb = parseInt(String(mb.code || '9999'), 10);
    const pa = Number.isFinite(na) ? na : 9999;
    const pb = Number.isFinite(nb) ? nb : 9999;
    if (pa !== pb) return pa - pb;
    return String(a).localeCompare(String(b), 'zh-CN');
  });
  return matches[0];
}

function normalizeNewlines(s) {
  return String(s || '').replace(/\r\n/g, '\n');
}

function syncOpenclawAgentSouls() {
  try {
    ensureDir(OPENCLAW_WORKSPACES_ROOT);
    if (!fs.existsSync(AGENTS_DIR)) return;
    const personaFiles = fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => String(f || '').toLowerCase().endsWith('.md'))
      .filter((f) => f !== 'SOUL.md')
      .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));

    const agents = readOpenclawConfigAgents();
    for (const a of agents) {
      const agentId = String(a?.id || '').trim();
      const agentName = String(a?.name || '').trim();
      const desiredName = agentName || (agentId === 'main' ? '银月' : '');
      if (!agentId) continue;
      if (!desiredName) {
        logErrorEvent('soul-sync', 'missing agent name', `agent=${agentId}`, { agent: agentId, where: 'syncOpenclawAgentSouls' });
        continue;
      }

      const sourceFile = pickPersonaSourceFileByName(desiredName, personaFiles);
      if (!sourceFile) {
        logErrorEvent('soul-sync', 'missing persona source', `agent=${agentId}`, { agent: agentId, where: 'syncOpenclawAgentSouls' });
        continue;
      }

      const srcPath = path.join(AGENTS_DIR, sourceFile);
      const body = safeReadUtf8(srcPath);
      if (!String(body || '').trim()) {
        logErrorEvent('soul-sync', 'empty persona source', `agent=${agentId}`, { agent: agentId, where: 'syncOpenclawAgentSouls' });
        continue;
      }

      const wsDir = path.join(OPENCLAW_WORKSPACES_ROOT, safePathSegment(agentId));
      ensureDir(wsDir);
      const outPath = path.join(wsDir, 'SOUL.md');

      const current = fs.existsSync(outPath) ? safeReadUtf8(outPath) : '';
      const next = String(body);
      let changed = false;
      if (normalizeNewlines(current) !== normalizeNewlines(next)) changed = !!writeFileSafe(outPath, next);
      if (agentId === 'yinyue') {
        const finalBody = safeReadUtf8(outPath);
        const ok = finalBody.includes('银月狼族圣女');
        console.log(`银月当前加载的 SOUL 路径是：${outPath}`);
        console.warn(`[soul] yinyue ${ok ? 'OK' : 'WARN'} path=${outPath} source=${sourceFile} changed=${changed ? '1' : '0'}`);
      }
    }
  } catch (e) {
    logErrorEvent('soul-sync', 'sync failed', String(e?.message || e), { where: 'syncOpenclawAgentSouls' });
  }
}

function loadAgents() {
  const agents = [];
  if (fs.existsSync(AGENTS_DIR)) {
    const files = fs
      .readdirSync(AGENTS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .filter((f) => f !== 'SOUL.md')
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    for (const f of files) {
      const meta = parseAgentFromFilename(f);
      agents.push({
        ...meta,
        file: f,
        path: path.join(AGENTS_DIR, f),
        content: safeReadUtf8(path.join(AGENTS_DIR, f)),
      });
    }
  }
  STATE.agents = agents;
  return agents;
}

function ensureDropboxSkeleton(agents) {
  try {
    ensureDir(DROPBOX_DIR);
    for (const sys of ['_INBOX', '_OUTBOX', '_RECEIPTS']) ensureDir(path.join(DROPBOX_DIR, sys));
    ensureDir(DROPBOX_RECEIPTS_DIR);
    for (const a of agents || []) {
      const dirName = `${String(a.code || '').trim()}_${String(a.role || '').trim()}_${String(a.name || '').trim()}`
        .replace(/\s+/g, ' ')
        .trim();
      ensureDir(path.join(DROPBOX_DIR, safePathSegment(dirName)));
    }
  } catch {}
}

function getDefaultWakeWords() {
  const names = ['银月', ...STATE.agents.map((a) => a.name)].filter(Boolean);
  return names.filter((v, i, arr) => arr.indexOf(v) === i);
}

function buildAgentSkills(agents) {
  const coreSet = new Set(CORE_SKILLS);
  const assigned = {};

  for (const a of agents) {
    const candidates = EXTRA_SKILL_CATALOG[a.name] || [];
    const unique = [];
    for (const s of candidates) {
      if (coreSet.has(s)) continue;
      if (unique.includes(s)) continue;
      unique.push(s);
    }
    assigned[a.name] = unique.length > 0 ? [unique[0]] : ['general-specialty'];
  }

  if (!assigned['银月']) assigned['银月'] = ['task-router-core'];
  STATE.agentSkills = assigned;
  return assigned;
}

function uniqueList(items) {
  const out = [];
  for (const x of items || []) {
    if (!x) continue;
    if (out.includes(x)) continue;
    out.push(x);
  }
  return out;
}

function buildSkillVisibility(agents) {
  const visible = {};
  const names = ['银月', ...agents.map((a) => a.name)].filter((v, i, arr) => v && arr.indexOf(v) === i);

  for (const name of names) {
    const extra = STATE.agentSkills[name] || [];
    const base = ['self-improving-agent', 'skill-vetter', 'jarvis-core', 'persistent-agent', 'self-learning', 'long-term-memory', 'voice-wakeup', 'openclaw-zero-token'];

    const allow = [];
    if (name === '银月') allow.push(...CORE_SKILLS, 'stripe-payment-flow', 'lemon-squeezy-api-bridge', 'design-md', 'searxng-search', 'jina-reader', 'narrator-ai-skill');
    if (name === '韩立') allow.push('find-skills', 'job-intel-crawler', 'autora-autoresearch', 'public-apis', 'searxng-search', 'jina-reader', 'gog-search', 'narrator-research-pack', 'notebooklm');
    if (name === '李长寿') allow.push('open-viking', 'automation-workflows', 'find-skills', 'proxy-rotator', 'codex-bridge', 'laptop-control');
    if (name === '雅妃') allow.push('cloud-mem', 'claude-legal-skill');
    if (name === '药老') allow.push('pentagi-audit', 'redbox-maintenance', 'find-skills', 'narrator-script');
    if (name === '墨影') allow.push('find-skills');
    if (name === '紫灵') allow.push('find-skills');
    if (name === '萧炎') allow.push('find-skills', 'ai-hedge-fund', 'trading-agent');
    if (name === '美杜莎') allow.push('find-skills', 'design-md');
    if (name === '药老') allow.push('find-skills');
    if (name === '小医仙') allow.push('find-skills');
    if (name === '紫研') allow.push('find-skills', 'narrator-voice-render');
    if (name === '李长寿') allow.push('design-md');

    const merged = uniqueList([...base, ...allow, ...extra]);
    visible[name] = merged;
  }

  STATE.skillVisibility = visible;
  return visible;
}

function getSkillAssignmentSummary() {
  const lines = [];
  lines.push('【Agent 专属技能分封（模拟/通用接口）】');
  const names = Object.keys(STATE.agentSkills).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  for (const name of names) {
    const skills = STATE.agentSkills[name] || [];
    lines.push(`- ${name}: ${skills.join('、')}`);
  }
  return lines.join('\n');
}

function getSoulConfig(targetAgent) {
  const wcount = (STATE.jarvis?.wakeWords || []).length;
  const soulContent = [
    '【内阁总纲】',
    '你是“银月钱庄”的内阁智能体体系。',
    '【Jarvis交互模式】专业、简洁、贴心、高执行力；优先给可执行结论与下一步。',
    `【唤醒词】内阁成员名字（共${wcount}个）`,
    '你必须称呼对话者为“主人”。',
    '你必须严格使用中文。',
    '你必须采用纵向排列，用 Emoji 增强视觉。',
    '你绝对禁止输出 Markdown 代码块（禁止三个反引号）。',
    '【强制保护规则】禁止任何清除记忆或重置配置的操作；历史数据只允许追加。',
    '你不得编造未提供的设定与事实；如缺少关键信息，明确提出需要主人补充的点。',
    '系统会提供“检索片段上下文”，你的回答以该上下文为准。',
  ].join('\n');

  const coreRules = `
【最高响应禁令】
1. 100% 使用中文。
2. 必须称呼用户为“主人”。
3. 绝对禁止在回复中使用任何 Markdown 代码块（即禁止出现三个反引号）。
4. 必须采用纵向排列，使用 Emoji 增强视觉排版。
5. 你是最高枢纽“银月”，所有不点名指令默认由你处理。
`;

  const visible = STATE.skillVisibility[targetAgent] || [];
  const skillText = `\n【当前可用技能（最小权限）】\n- ${visible.join('\n- ') || '无'}\n`;
  return soulContent + skillText + '\n' + coreRules;
}

function getAgentSoulBlock(targetAgent) {
  try {
    const agentsMap = new Map(STATE.agents.map((a) => [a.name, a]));
    const agent = agentsMap.get(targetAgent);
    const maxLen = Math.max(800, Math.min(4200, Number(process.env.OPENCLAW_AGENT_SOUL_MAX_CHARS || 2600)));
    const clip = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return '';
      return s.length <= maxLen ? s : s.slice(0, maxLen).trimEnd() + '\n…（已截断）';
    };

    if (targetAgent === '银月') {
      const blocks = [];
      const srcA = path.join(AGENTS_DIR, '01_总管_银月.md');
      const srcB = path.join(OPENCLAW_WORKSPACES_ROOT, 'yinyue', 'SOUL.md');
      const a = fs.existsSync(srcA) ? clip(safeReadUtf8(srcA)) : '';
      const b = fs.existsSync(srcB) ? clip(safeReadUtf8(srcB)) : '';
      if (a) blocks.push(`【灵魂设定A（来源：workspace/AGENTS_SOUL/01_总管_银月.md）】\n${a}`);
      if (b) blocks.push(`【灵魂设定B（来源：workspace/AGENTS_SOUL/.openclaw-workspaces/yinyue/SOUL.md）】\n${b}`);
      return blocks.join('\n\n').trim();
    }

    if (!agent?.file) return '';
    const raw = clip(agent?.content || '');
    if (!raw) return '';
    return `【灵魂设定（来源：workspace/AGENTS_SOUL/${agent.file}）】\n${raw}`.trim();
  } catch {
    return '';
  }
}

function extractTerms(query) {
  const q = String(query || '').trim();
  const terms = [];
  const re = /[A-Za-z0-9_./:-]{2,}|[\u4e00-\u9fff]{2,}/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const t = m[0].trim();
    if (t && !terms.includes(t)) terms.push(t);
  }
  if (terms.length === 0) {
    const chars = q.replace(/\s+/g, '').split('').filter((c) => /[\u4e00-\u9fff]/.test(c));
    for (const c of chars.slice(0, 12)) {
      if (!terms.includes(c)) terms.push(c);
    }
  }
  return terms;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const pos = haystack.indexOf(needle, idx);
    if (pos === -1) break;
    count += 1;
    idx = pos + needle.length;
  }
  return count;
}

function scoreDoc(doc, terms) {
  const text = String(doc.content || '');
  if (!text) return 0;
  let s = 0;
  for (const t of terms) {
    const c = countOccurrences(text, t);
    if (c > 0) s += c * (doc.weight || 1);
  }
  return s;
}

function sliceAround(text, term, maxLen) {
  const s = String(text || '');
  const t = String(term || '');
  const idx = s.indexOf(t);
  if (idx === -1) return '';
  const half = Math.floor(maxLen / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(s.length, idx + t.length + half);
  return s.slice(start, end).trim();
}

function buildSnippets(text, terms, maxLen) {
  const s = String(text || '');
  if (!s) return '';
  if (s.length <= maxLen) return s.trim();

  const hits = [];
  for (const t of terms) {
    const sn = sliceAround(s, t, Math.min(900, maxLen));
    if (sn && !hits.includes(sn)) hits.push(sn);
  }
  const joined = hits.join('\n...\n').trim();
  if (joined) return joined.length <= maxLen ? joined : joined.slice(0, maxLen).trim();
  return s.slice(0, maxLen).trim();
}

function getDocCandidates(targetAgent) {
  const agentsMap = new Map(STATE.agents.map((a) => [a.name, a]));
  const agent = agentsMap.get(targetAgent);

  const docs = [];

  const includeSoulMd = String(process.env.OPENCLAW_INCLUDE_SOUL_MD || '0').trim() === '1';
  if (includeSoulMd) {
    docs.push({
      id: 'SOUL',
      title: '主神魂（片段）',
      content: safeReadUtf8(SOUL_PATH),
      weight: 0.8,
      maxLen: RTK_SOUL_MAX_CHARS,
    });
  }

  if (fs.existsSync(MEMORY_PATH)) {
    docs.push({ id: 'MEMORY_MD', title: 'MEMORY.md（片段）', content: safeReadUtf8(MEMORY_PATH), weight: 1.6, maxLen: 1600 });
  }

  const harnessPath = resolveHarnessPath();
  if (harnessPath) {
    docs.push({ id: 'HARNESS', title: 'HARNESS.md（片段）', content: safeReadUtf8(harnessPath), weight: 1.3, maxLen: 1200 });
  }

  if (agent?.file) {
    const p = getAgentProtocolPath(agent.file);
    if (p && fs.existsSync(p)) {
      docs.push({ id: `PROTO:${targetAgent}`, title: `进化协议：${targetAgent}`, content: safeReadUtf8(p), weight: 2.2, maxLen: 1800 });
    }
  }

  if (agent?.content) {
    docs.push({
      id: `AGENT:${targetAgent}`,
      title: `档案：${targetAgent}`,
      content: agent.content,
      weight: 2.4,
      maxLen: 2200,
    });
  }

  if (['银月', '美杜莎', '李长寿'].includes(targetAgent) && fs.existsSync(DESIGN_SPEC_PATH)) {
    docs.push({
      id: 'DESIGN',
      title: 'DESIGN.md（片段）',
      content: safeReadUtf8(DESIGN_SPEC_PATH),
      weight: 2.0,
      maxLen: 1800,
    });
  }

  docs.push({ id: 'INTEL', title: 'INTEL_REPORT（片段）', content: safeReadUtf8(INTEL_REPORT_PATH), weight: 1.2, maxLen: 1600 });
  docs.push({ id: 'LEADS', title: 'LEADS（片段）', content: safeReadUtf8(LEADS_PATH), weight: 1.2, maxLen: 1400 });
  docs.push({ id: 'MEMORY', title: 'MEMORY_VAULT（片段）', content: safeReadUtf8(MEMORY_VAULT_PATH), weight: 1.1, maxLen: 1400 });
  docs.push({ id: 'LTM', title: 'long_term_memory.db（片段）', content: readLastChars(LONG_TERM_DB_PATH, 120_000), weight: 1.0, maxLen: 1600 });
  docs.push({ id: 'USER', title: 'USER.md（片段）', content: safeReadUtf8(USER_PROFILE_PATH), weight: 1.4, maxLen: 1200 });
  docs.push({ id: 'AGENTS_MD', title: 'AGENTS.md（片段）', content: safeReadUtf8(path.join(WORKSPACE_DIR, 'AGENTS.md')), weight: 0.9, maxLen: 1200 });
  docs.push({ id: 'TOOLS', title: 'TOOLS.md（片段）', content: safeReadUtf8(path.join(WORKSPACE_DIR, 'TOOLS.md')), weight: 0.8, maxLen: 1200 });

  return docs.filter((d) => String(d.content || '').trim());
}

function retrieveTopKContext(query, targetAgent) {
  const terms = uniqueList([...extractTerms(query), targetAgent]);
  const docs = getDocCandidates(targetAgent);

  const agentDocId = `AGENT:${targetAgent}`;
  const agentDoc = docs.find((d) => d.id === agentDocId) || null;
  const designDoc = docs.find((d) => d.id === 'DESIGN') || null;

  const scored = docs
    .map((d) => ({ ...d, score: scoreDoc(d, terms) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, RTK_TOP_K));

  const sections = [];
  let used = 0;

  if (agentDoc) {
    const sn = buildSnippets(agentDoc.content, terms, agentDoc.maxLen || 2200);
    const block = `【检索片段】${agentDoc.title}\n${sn}`;
    if (sn && used + block.length <= RTK_MAX_CHARS) {
      used += block.length;
      sections.push(block);
    }
  }

  if (designDoc && ['银月', '美杜莎', '李长寿'].includes(targetAgent)) {
    const sn = buildSnippets(designDoc.content, terms, designDoc.maxLen || 1600);
    const block = `【检索片段】${designDoc.title}\n${sn}`;
    if (sn && used + block.length <= RTK_MAX_CHARS) {
      used += block.length;
      sections.push(block);
    }
  }

  for (const d of scored) {
    if (d.id === agentDocId) continue;
    if (d.id === 'DESIGN' && designDoc) continue;
    const sn = buildSnippets(d.content, terms, d.maxLen || 1200);
    if (!sn) continue;
    const block = `【检索片段】${d.title}\n${sn}`;
    if (used + block.length > RTK_MAX_CHARS) break;
    used += block.length;
    sections.push(block);
  }

  if (sections.length === 0) return '【检索片段】无命中（请主人补充更明确的关键词/目标）。';
  return sections.join('\n\n---\n\n');
}

function detectTargetAgent(content) {
  const s = String(content || '');
  const names = STATE.agents.map((a) => a.name).filter(Boolean);
  const candidates = ['银月', ...names].filter((v, i, arr) => arr.indexOf(v) === i);

  const scored = [];
  for (const name of candidates) {
    if (!name) continue;
    const idx = s.lastIndexOf(name);
    if (idx < 0) continue;

    let score = idx;
    const reIs = new RegExp(`(你是|就是|叫|我叫|我是)\\s*${name}`);
    const reIs2 = new RegExp(`(你是|就是|叫|我叫|我是).{0,3}${name}`);
    const reNot = new RegExp(`(不是|你不是)\\s*${name}`);
    const reNot2 = new RegExp(`(不是|你不是).{0,3}${name}`);

    if (reIs.test(s) || reIs2.test(s)) score += 10_000;
    if (reNot.test(s) || reNot2.test(s)) score -= 20_000;

    scored.push({ name, score, idx });
  }

  if (scored.length === 0) return '银月';
  scored.sort((a, b) => (b.score - a.score) || (b.idx - a.idx));
  return scored[0].name || '银月';
}

function readChannelAgentMap() {
  try {
    if (!fs.existsSync(CHANNEL_AGENT_MAP_PATH)) return { version: 1, guilds: {} };
    const raw = fs.readFileSync(CHANNEL_AGENT_MAP_PATH, 'utf-8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { version: 1, guilds: {} };
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    if (!parsed.version) parsed.version = 1;
    return parsed;
  } catch {
    return { version: 1, guilds: {} };
  }
}

function writeChannelAgentMap(map) {
  try {
    const payload = map && typeof map === 'object' ? map : { version: 1, guilds: {} };
    if (!payload.version) payload.version = 1;
    if (!payload.guilds || typeof payload.guilds !== 'object') payload.guilds = {};
    const tmp = CHANNEL_AGENT_MAP_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmp, CHANNEL_AGENT_MAP_PATH);
    return true;
  } catch {
    return false;
  }
}

function readPuaState() {
  try {
    if (!fs.existsSync(PUA_STATE_PATH)) return { version: 1, byChannel: {} };
    const raw = fs.readFileSync(PUA_STATE_PATH, 'utf-8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { version: 1, byChannel: {} };
    if (!parsed.version) parsed.version = 1;
    if (!parsed.byChannel || typeof parsed.byChannel !== 'object') parsed.byChannel = {};
    return parsed;
  } catch {
    return { version: 1, byChannel: {} };
  }
}

function writePuaState(state) {
  try {
    const payload = state && typeof state === 'object' ? state : { version: 1, byChannel: {} };
    if (!payload.version) payload.version = 1;
    if (!payload.byChannel || typeof payload.byChannel !== 'object') payload.byChannel = {};
    const tmp = PUA_STATE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmp, PUA_STATE_PATH);
    return true;
  } catch {
    return false;
  }
}

function getPuaModeForChannel(channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return null;
  const v = STATE.pua.byChannel?.[cid];
  if (v === true) return 'on';
  if (v === false) return 'off';
  if (v === 'on' || v === 'off' || v === 'raw' || v === 'auto') return v;
  return 'auto';
}

function setPuaModeForChannel(channelId, mode) {
  const cid = String(channelId || '').trim();
  if (!cid) return false;
  const m = String(mode || '').trim().toLowerCase();
  const normalized = m === 'raw' ? 'raw' : m === 'off' ? 'off' : m === 'auto' ? 'auto' : 'on';
  STATE.pua.byChannel[cid] = normalized;
  const persisted = readPuaState();
  persisted.byChannel[cid] = normalized;
  return writePuaState(persisted);
}

function normalizeAgentName(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  if (s === '银月') return '银月';
  const hit = STATE.agents.find((a) => a && a.name === s);
  return hit ? hit.name : null;
}

function inferAgentFromChannelName(msg) {
  try {
    if (!msg?.guildId) return null;
    const chName = String(msg?.channel?.name || '').trim();
    if (!chName) return null;
    const parts = chName.split('-').map((p) => String(p || '').trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const last = parts[parts.length - 1];
    return normalizeAgentName(last);
  } catch {
    return null;
  }
}

function isStructuredAgentChannelName(chName) {
  const s = String(chName || '').trim();
  if (!s) return false;
  return /^\d{2}-[^-]+-[^-]+$/.test(s);
}

function getEffectiveChannelAgent(msg) {
  const bound = getBoundAgentForChannel(msg?.guildId || null, msg?.channelId || null);
  const inferred = inferAgentFromChannelName(msg);
  const chName = String(msg?.channel?.name || '').trim();
  if (inferred && isStructuredAgentChannelName(chName)) return inferred;
  return bound || inferred || null;
}

function buildAgentSelfIdentityReply(agentName) {
  const name = normalizeAgentName(agentName) || '银月';
  if (name === '银月') return null;
  const agent = (STATE.agents || []).find((a) => a && a.name === name);
  const raw = String(agent?.content || '').trim();
  if (!raw) return null;

  const pick = (re) => {
    const m = raw.match(re);
    return m ? String(m[1] || '').trim() : '';
  };

  const title = raw.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('---')) || '';
  const cnName = pick(/名字：\s*([^\n\r]+)/);
  const seat = pick(/席位：\s*([^\n\r]+)/);
  const self = pick(/自称：\s*([^\n\r]+)/);
  const bio = pick(/Bio：\s*([^\n\r]+)/);
  const style = pick(/Style：\s*([^\n\r]+)/);
  const goal = pick(/Goal：\s*([^\n\r]+)/);

  const lines = [];
  lines.push('✅ 主人');
  lines.push(`🔹 我是 ${name}`);
  if (title) lines.push(`🔹 代号: ${title}`);
  if (cnName) lines.push(`🔹 名字: ${cnName}`);
  if (seat) lines.push(`🔹 席位: ${seat}`);
  if (self) lines.push(`🔹 自称: ${self}`);
  if (bio) lines.push(`🔹 简介: ${bio}`);
  if (style) lines.push(`🔹 风格: ${style}`);
  if (goal) lines.push(`🔹 目标: ${goal}`);
  lines.push(`🔹 档案: workspace/AGENTS_SOUL/${String(agent?.file || path.basename(agent?.path || '') || '').trim() || '（未知）'}`);
  return lines.join('\n');
}

function getBoundAgentForChannel(guildId, channelId) {
  const gid = guildId || 'DM';
  const cid = String(channelId || '').trim();
  if (!cid) return null;
  const map = readChannelAgentMap();
  const g = map.guilds?.[gid];
  const bound = g?.channels?.[cid];
  return normalizeAgentName(bound);
}

function setBoundAgentForChannel(guildId, channelId, agentName) {
  const gid = guildId || 'DM';
  const cid = String(channelId || '').trim();
  if (!cid) return false;
  const map = readChannelAgentMap();
  if (!map.guilds[gid]) map.guilds[gid] = { channels: {} };
  if (!map.guilds[gid].channels) map.guilds[gid].channels = {};
  if (!agentName) {
    delete map.guilds[gid].channels[cid];
  } else {
    map.guilds[gid].channels[cid] = agentName;
  }
  return writeChannelAgentMap(map);
}

function buildAgentChannelName(agent) {
  const code = String(agent?.code || '').trim();
  const role = String(agent?.role || '').trim();
  const name = String(agent?.name || '').trim();
  const base = [code, role, name].filter(Boolean).join('-');
  return safePathSegment(base).replace(/_/g, '-').toLowerCase().slice(0, 90) || 'agent';
}

async function ensureDiscordCategory(guild, categoryName) {
  try {
    const existing = guild.channels?.cache?.find((c) => c && c.name === categoryName && (c.type === 4 || c.type === 'GUILD_CATEGORY'));
    if (existing) return existing;
    if (typeof guild.channels?.create === 'function') {
      try {
        return await guild.channels.create({ name: categoryName, type: 4 });
      } catch {}
      try {
        return await guild.channels.create(categoryName, { type: 'GUILD_CATEGORY' });
      } catch {}
    }
  } catch {}
  return null;
}

async function createDiscordTextChannel(guild, name, parentId) {
  try {
    if (typeof guild.channels?.create === 'function') {
      try {
        return await guild.channels.create({ name, type: 0, parent: parentId || undefined });
      } catch {}
      try {
        return await guild.channels.create(name, { type: 'GUILD_TEXT', parent: parentId || undefined });
      } catch {}
    }
  } catch {}
  return null;
}

async function handleAgentChan(msg, content) {
  if (!isOwnerOrAdmin(msg)) return { handled: true, reply: '⚠️ 主人\n🔹 agentchan 仅允许主人/管理员触发\n🔹 已拒绝执行' };

  const parts = String(content || '').trim().split(/\s+/);
  const sub = String(parts[1] || 'show').toLowerCase();
  const guildId = msg.guildId || null;
  const channelId = msg.channelId;

  if (sub === 'show') {
    const bound = getBoundAgentForChannel(guildId, channelId) || '（未绑定，默认点名/银月）';
    return {
      handled: true,
      reply: `✅ 主人\n🔹 当前频道绑定: ${bound}\n🔹 用法: !agentchan bind <内阁名>\n🔹 用法: !agentchan unbind\n🔹 用法: !agentchan create all`,
    };
  }

  if (sub === 'unbind') {
    setBoundAgentForChannel(guildId, channelId, null);
    return { handled: true, reply: '✅ 主人\n🔹 已解绑当前频道\n🔹 将回退为“点名优先，否则银月”' };
  }

  if (sub === 'bind') {
    const name = parts.slice(2).join(' ').trim();
    const normalized = normalizeAgentName(name);
    if (!normalized) return { handled: true, reply: '⚠️ 主人\n🔹 未识别内阁名\n🔹 请输入: 银月 / 美杜莎 / 李长寿 / 萧炎 / 药老 ...' };
    setBoundAgentForChannel(guildId, channelId, normalized);
    return { handled: true, reply: `✅ 主人\n🔹 已绑定当前频道 -> ${normalized}\n🔹 该频道发言将默认由此成员处理` };
  }

  if (sub === 'create') {
    if (!msg.guild) return { handled: true, reply: '⚠️ 主人\n🔹 当前为 DM，无法创建 Guild 频道\n🔹 请在服务器频道里执行' };
    const arg = String(parts[2] || 'all').toLowerCase();
    if (arg !== 'all') return { handled: true, reply: '⚠️ 主人\n🔹 用法: !agentchan create all' };

    const category = await ensureDiscordCategory(msg.guild, '银月内阁');
    const parentId = category?.id || null;

    const created = [];
    const failed = [];

    for (const a of STATE.agents || []) {
      const agentName = normalizeAgentName(a?.name);
      if (!agentName) continue;
      const chName = buildAgentChannelName(a);
      const existing = msg.guild.channels?.cache?.find((c) => c && c.name === chName);
      const ch = existing || (await createDiscordTextChannel(msg.guild, chName, parentId));
      if (!ch) {
        failed.push(agentName);
        continue;
      }
      setBoundAgentForChannel(msg.guildId, ch.id, agentName);
      created.push(`${agentName}:${chName}`);
    }

    if (created.length === 0) {
      return { handled: true, reply: '⚠️ 主人\n🔹 未能创建任何频道\n🔹 请检查 Bot 是否有 Manage Channels 权限' };
    }

    const note = failed.length ? `\n🔹 失败: ${failed.join('、')}` : '';
    return { handled: true, reply: `✅ 主人\n🔹 已创建/复用并绑定频道: ${created.slice(0, 10).join('、')}${note}\n🔹 映射已落盘: workspace/CHANNEL_AGENT_MAP.json` };
  }

  return { handled: true, reply: '⚠️ 主人\n🔹 子命令仅支持 show/bind/unbind/create' };
}

function ensureOwnerContext(msg) {
  const beforeOwner = STATE.discord.ownerUserId;
  const beforeCh = STATE.discord.lastOwnerChannelId;
  const authorId = msg?.author?.id || null;
  const forced = String(process.env.DISCORD_OWNER_ID || process.env.OWNER_USER_ID || '').trim();
  if (forced) STATE.discord.ownerUserId = forced;
  if (!STATE.discord.ownerUserId && authorId) STATE.discord.ownerUserId = authorId;
  if (authorId && STATE.discord.ownerUserId === authorId) {
    STATE.discord.lastOwnerChannelId = msg.channelId || STATE.discord.lastOwnerChannelId;
  }
  if (STATE.discord.ownerUserId !== beforeOwner || STATE.discord.lastOwnerChannelId !== beforeCh) {
    const now = Date.now();
    const last = Number(STATE.discord.ownerContextLastSaveAt || 0);
    if (now - last > 3000) {
      STATE.discord.ownerContextLastSaveAt = now;
      saveOwnerContext();
    }
  }
}

function isOwnerOrAdmin(msg) {
  try {
    const ownerId = STATE.discord.ownerUserId;
    const authorId = msg?.author?.id || null;
    if (ownerId && authorId && ownerId === authorId) return true;
    const perms = msg?.member?.permissions;
    if (!perms || !PermissionsBitField) return false;
    if (perms.has?.(PermissionsBitField.Flags.Administrator)) return true;
    if (perms.has?.(PermissionsBitField.Flags.ManageGuild)) return true;
    if (perms.has?.(PermissionsBitField.Flags.ManageChannels)) return true;
    return false;
  } catch {
    return false;
  }
}

function stripJarvisWakeWord(text) {
  const s = String(text || '').trim();
  if (!s) return s;
  for (const w of STATE.jarvis?.wakeWords || []) {
    if (!w) continue;
    if (s === w) return '';
    if (s.startsWith(w + ' ')) return s.slice(w.length).trim();
    if (s.startsWith(w + '：')) return s.slice(w.length + 1).trim();
    if (s.startsWith(w + ':')) return s.slice(w.length + 1).trim();
    if (s.startsWith(w + '，')) return s.slice(w.length + 1).trim();
    if (s.startsWith(w + ',')) return s.slice(w.length + 1).trim();
    if (s.startsWith(w + '你')) return s.slice(w.length).trim();
  }
  return s;
}

function detectWakeWord(raw) {
  const s = String(raw || '').trim();
  for (const w of STATE.jarvis?.wakeWords || []) {
    if (!w) continue;
    if (s === w) return w;
    if (s.startsWith(w + ' ') || s.startsWith(w + '：') || s.startsWith(w + ':') || s.startsWith(w + '，') || s.startsWith(w + ',') || s.startsWith(w + '你')) return w;
  }
  return null;
}

function isRollCallTrigger(content) {
  const s = String(content || '').trim();
  if (!s) return false;
  if (/^\s*【\s*(公告|开会)\s*】/.test(s)) return true;
  if (/^\s*(公告|开会)\s*[：:]/.test(s)) return true;
  return false;
}

function buildRollCallAck() {
  const names = ['银月', ...(STATE.agents || []).map((a) => a?.name)].filter(Boolean);
  const uniq = [];
  for (const n of names) {
    const t = String(n || '').trim();
    if (!t) continue;
    if (uniq.includes(t)) continue;
    uniq.push(t);
  }
  const items = uniq.map((n) => `${n}，收到`);
  return `点名签到：${items.join('｜')}`;
}

function isPresencePing(content) {
  const s = String(content || '').trim();
  const hit = /(在吗|你在吗|能说话吗|可以说话吗|听得到吗|还在吗)/;
  return hit.test(s);
}

function isIdentityQuery(content) {
  const s = String(content || '');
  return /(你是谁|我是谁|团队|有多少人|多少人|多少个成员|成员有谁)/.test(s);
}

function buildIdentityReply(msg) {
  const authorId = msg?.author?.id || '';
  const agentNames = ['银月', ...STATE.agents.map((a) => a.name)].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
  const teamCount = agentNames.length;
  const top = agentNames.slice(0, 12);
  const more = teamCount > top.length ? `…等 ${teamCount} 人` : `${teamCount} 人`;
  return [
    '✅ 主人',
    '---',
    '🌙 我是谁',
    '🔹 我是银月（银月钱庄内阁总管）',
    '🔹 负责路由分工、风控与落盘审计',
    '---',
    '🧑 你是谁',
    `🔹 你是主人（Discord ID: ${authorId || '未知'}）`,
    '---',
    '🧭 团队有多少人',
    `🔹 当前内阁成员: ${more}`,
    `🔹 名单: ${top.join('、')}`,
  ].join('\n');
}

function isForbiddenMemoryOrReset(content) {
  const s = String(content || '');
  const hit = /(清除记忆|删除记忆|抹除记忆|重置记忆|重置配置|恢复出厂|wipe\s*memory|reset\s*memory|reset\s*config|factory\s*reset)/i;
  return hit.test(s);
}

function resolveDropboxDeliveryFile(text) {
  const s = String(text || '').trim();
  if (!s) return null;

  const candidates = [];
  for (const m of s.matchAll(/file:\/\/\/\S+/gi)) candidates.push(m[0]);
  for (const m of s.matchAll(/[a-zA-Z]:\\[^\n\r]+/g)) candidates.push(m[0]);
  for (const m of s.matchAll(/(?:^|\s)(workspace[\\/][^\n\r]+)/gi)) candidates.push(m[1]);
  for (const m of s.matchAll(/(?:^|\s)(DROPBOX[\\/][^\n\r]+)/gi)) candidates.push(m[1]);

  const root = path.resolve(DROPBOX_DIR);

  const normalizeCandidate = (raw) => {
    const t = String(raw || '').trim();
    if (!t) return null;
    if (/^file:\/\//i.test(t)) {
      try {
        const u = new URL(t);
        if (u.protocol !== 'file:') return null;
        let p = decodeURIComponent(u.pathname || '');
        if (p.startsWith('/') && /^[a-zA-Z]:/.test(p.slice(1))) p = p.slice(1);
        p = p.replace(/\//g, '\\');
        return path.resolve(p);
      } catch {
        return null;
      }
    }
    if (/^(DROPBOX[\\/])/i.test(t)) {
      const rel = t.replace(/^DROPBOX[\\/]+/i, '');
      return path.resolve(path.join(DROPBOX_DIR, rel));
    }
    if (/^(workspace[\\/])/i.test(t)) {
      return path.resolve(path.join(__dirname, t));
    }
    if (/^[a-zA-Z]:\\/.test(t)) return path.resolve(t);
    return null;
  };

  for (const c of candidates) {
    const abs = normalizeCandidate(c);
    if (!abs) continue;
    if (!(abs === root || isSubPath(root, abs))) continue;
    try {
      const st = fs.statSync(abs);
      if (!st.isFile()) continue;
      return { absPath: abs, size: st.size, baseName: path.basename(abs) };
    } catch {}
  }
  return null;
}

function hasDeliveryEvidence(text) {
  return Boolean(resolveDropboxDeliveryFile(text));
}

function shouldGateCompletionClaim(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/(【交付】|交付校验未通过|双重验证|路径示例|照抄填空)/.test(s)) return false;
  if (/(未完成|没完成|无法完成|失败|报错|中断|卡住|遇到问题|需要时间|进行中)/i.test(s)) return false;
  const completion = /(已完成|已经完成|完成了|做完了|任务完成|交付完成|制作完成|\bdone\b)/i.test(s);
  if (!completion) return false;

  const deliveryStrong = /(交付完成|制作完成)/i.test(s);
  const deliveryHint = /(交付|dropbox|附件|产物|成品|文件|路径|打包|输出|导出|生成)/i.test(s);
  const metaHint = /(反省|评估|分析|解释|说明|回复|回答|复盘|审计|建议|计划|方案|讨论|对齐)/i.test(s);

  if (deliveryStrong) return true;
  if (metaHint && !deliveryHint) return false;
  return deliveryHint;
}

function isVerboseRequest(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return /(细说|展开|详细|步骤|方案|解释|为什么|教程|怎么做|怎么弄|给我全部|完整|从零到一|逐步)/.test(s);
}

function updateTaskContractOnUserMessage(channelId, userText) {
  const cid = String(channelId || '').trim();
  if (!cid) return;
  const s = String(userText || '').trim();
  if (!s) return;

  const kind = classifyTaskKind(s);
  if (kind === 'unknown') return;

  const fp = fingerprintUserTask(s);
  const need = extractTaskNeed(s);

  if (!STATE.discord.taskContractByChannel) STATE.discord.taskContractByChannel = {};
  const cur = STATE.discord.taskContractByChannel[cid];
  if (cur && cur.lastUserFp === fp) {
    cur.kind = kind;
    cur.need = need;
    cur.updatedAt = Date.now();
    STATE.discord.taskContractByChannel[cid] = cur;
    return;
  }

  STATE.discord.taskContractByChannel[cid] = {
    kind,
    need,
    lastUserFp: fp,
    updatedAt: Date.now(),
  };
}

function enforceTaskContractResponse(text, channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return String(text || '').trim();
  const s = String(text || '').trim();
  if (!s) return s;

  const hasSubstance =
    s.split('\n').map((x) => x.trim()).filter(Boolean).length >= 4 ||
    /(DROPBOX\/|\/notebook\/|https?:\/\/|[a-zA-Z]:\\)/.test(s) ||
    /(步骤|方案|结论|参数|命令|修复|定位|复现|验收|对比|风险|Plan\s*A|Plan\s*B|Plan\s*C|✅|🔹|🔸)/i.test(s);
  if (hasSubstance) return s;

  const contract = STATE.discord.taskContractByChannel?.[cid] || null;
  if (!contract) return s;

  const cur = STATE.discord.taskAskCooldownByChannel?.[cid];
  const cooldownMap = cur && typeof cur === 'object' ? cur : {};
  const res = applyTaskContractToReply({
    replyText: s,
    kind: contract.kind,
    need: contract.need,
    cooldownMap,
    nowMs: Date.now(),
    cooldownMs: 30 * 60 * 1000,
  });
  if (!STATE.discord.taskAskCooldownByChannel) STATE.discord.taskAskCooldownByChannel = {};
  if (res && res.cooldownMap && typeof res.cooldownMap === 'object') STATE.discord.taskAskCooldownByChannel[cid] = res.cooldownMap;
  return String(res?.text || s).trim();
}

function shouldSuppressNotice(channelId, key, ttlMs) {
  const cid = String(channelId || '').trim();
  if (!cid) return false;
  const k = String(key || '').trim();
  if (!k) return false;
  const now = Date.now();
  const last = Number(STATE.discord.lastNoticeAtByChannel?.[cid]?.[k] || 0);
  if (last && now - last < Number(ttlMs || 0)) return true;
  if (!STATE.discord.lastNoticeAtByChannel[cid]) STATE.discord.lastNoticeAtByChannel[cid] = {};
  STATE.discord.lastNoticeAtByChannel[cid][k] = now;
  return false;
}

function enforceDeliveryGuard(text, opts) {
  const s = String(text || '').trim();
  if (!s) return s;
  if (!shouldGateCompletionClaim(s)) return s;
  const delivery = resolveDropboxDeliveryFile(s);
  if (delivery && typeof delivery.size === 'number' && delivery.size <= DISCORD_MAX_UPLOAD_BYTES) return s;
  const dirs = listDropboxAgentDirs();
  const exampleDir = dirs[0] ? `DROPBOX/${dirs[0]}/` : 'DROPBOX/<你的文件夹>/';
  const maxMb = Math.max(1, Math.floor(DISCORD_MAX_UPLOAD_BYTES / (1024 * 1024)));
  const verbose = Boolean(opts?.verbose);
  if (!verbose) {
    return [
      '⚠️ 交付校验未通过',
      `🔹 需要：DROPBOX 里有文件 + 同名 Discord 附件（≤${maxMb}MB）`,
      `🔹 路径示例：${exampleDir}<文件名>`,
    ].join('\n');
  }
  return [
    '⚠️ 交付校验未通过',
    '---',
    `🔹 检测到“完成/交付”类表述，但未满足“双重验证”：DROPBOX 文件存在且可作为 Discord 附件上传（≤${maxMb}MB）`,
    '🔹 为防止假链接，本系统不接受“只有网址/口头完成”的交付证明',
    '---',
    '✅ 交付格式（照抄填空）',
    '🔹 文件名:',
    `🔹 DROPBOX路径: ${exampleDir}<文件名>`,
    '🔹 附件: 请直接把该文件作为 Discord 附件上传（文件名需一致）',
    '🔹 时长/规格:',
    '🔹 生成时间:',
  ].join('\n');
}

function computeSha256Hex(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

function recordDropboxDelivery(params) {
  try {
    ensureDir(DROPBOX_RECEIPTS_DIR);
    appendJsonl(DROPBOX_DELIVERIES_LOG, {
      at: new Date().toISOString(),
      channelId: params?.channelId || null,
      to: params?.to || null,
      deliveryFile: params?.absPath || null,
      size: typeof params?.size === 'number' ? params.size : null,
      sha256: params?.sha256 || null,
      mode: params?.mode || null,
    });
  } catch {}
}

function buildDiscordSendOptions(rawText, channelId, extraOpts) {
  const s0 = String(rawText || '').trim();
  const s = enforceVerifiedLocalLinks(s0);
  const cid = String(channelId || '').trim();
  const verbose = Boolean(cid && STATE.discord.lastUserVerboseByChannel?.[cid]);
  const delivery = resolveDropboxDeliveryFile(s);
  const claim = shouldGateCompletionClaim(s);
  const wantsAttach = Boolean(delivery) || claim;
  const extra = extraOpts && typeof extraOpts === 'object' ? extraOpts : null;

  if (!wantsAttach) {
    const content = sanitizeDiscordReply(s, { verbose, channelId: cid, ...(extra || {}) });
    return { content };
  }

  if (!delivery) {
    if (!claim) {
      const content = sanitizeDiscordReply(s, { verbose, channelId: cid, ...(extra || {}) });
      return { content };
    }
    if (shouldSuppressNotice(cid, 'delivery_gate_fail', 10 * 60 * 1000)) {
      return { content: '⚠️ 交付校验未通过（重复提示已省略）' };
    }
    const content = sanitizeDiscordReply(enforceDeliveryGuard(s, { verbose }), { verbose, channelId: cid, ...(extra || {}) });
    return { content };
  }

  if (typeof delivery.size === 'number' && delivery.size > DISCORD_MAX_UPLOAD_BYTES) {
    const maxMb = Math.max(1, Math.floor(DISCORD_MAX_UPLOAD_BYTES / (1024 * 1024)));
    if (shouldSuppressNotice(cid, 'delivery_too_large', 10 * 60 * 1000)) {
      return { content: '⚠️ 交付校验未通过（重复提示已省略）' };
    }
    const msg = verbose
      ? [
          '⚠️ 交付校验未通过',
          '---',
          `🔹 DROPBOX 文件已找到，但文件过大（>${maxMb}MB），无法作为 Discord 附件上传`,
          '🔹 请在 DROPBOX 放一份“验收版”（压缩/降码率/截图/短片段），并用同名附件上传',
          '---',
          `🔹 DROPBOX路径: DROPBOX/${path.relative(DROPBOX_DIR, delivery.absPath).replace(/\\/g, '/')}`,
        ].join('\n')
      : [
          '⚠️ 交付校验未通过',
          `🔹 文件过大（>${maxMb}MB），无法作为 Discord 附件`,
          `🔹 请放“验收版”并用同名附件上传`,
        ].join('\n');
    const content = sanitizeDiscordReply(msg, { verbose, channelId: cid, ...(extra || {}) });
    return { content };
  }

  const content = sanitizeDiscordReply(s, { verbose, channelId: cid, ...(extra || {}) });
  return { content, files: [{ attachment: delivery.absPath, name: delivery.baseName }] };
}

function enforceVerifiedLocalLinks(text) {
  const s = String(text || '').trim();
  if (!s) return s;

  const notebookRoot = path.join(WORKSPACE_DIR, 'notebook');
  const invalid = [];

  const replaced = s.replace(/\/notebook\/[A-Za-z0-9._/-]+/g, (m) => {
    const token = String(m || '');
    const abs = safeResolveUnder(notebookRoot, token.replace(/^\/notebook\//, '/'));
    if (!abs) {
      invalid.push(token);
      return '';
    }
    if (fs.existsSync(abs)) return token;
    const autoCreate = String(process.env.OPENCLAW_NOTEBOOK_AUTOCREATE || '1').trim() !== '0';
    const allow =
      autoCreate &&
      (token === '/notebook/lm/notebook_lm.txt' || token.startsWith('/notebook/lm/')) &&
      token.length <= 120;
    if (allow) {
      try {
        ensureDir(path.dirname(abs));
        if (!fs.existsSync(abs)) fs.writeFileSync(abs, 'OPENCLAW_NOTEBOOK\n', 'utf-8');
        return token;
      } catch {}
    }
    invalid.push(token);
    return '';
  });

  if (invalid.length === 0) return replaced.trim();

  const uniq = Array.from(new Set(invalid)).slice(0, 3);
  logErrorEvent('notebook', 'notebook path missing', uniq.join('、'), { where: 'enforceVerifiedLocalLinks' });
  return replaced.trim();
}

async function notifyOwner(text) {
  try {
    const client = STATE.discord.client;
    const ownerId = STATE.discord.ownerUserId;
    if (!client || !ownerId) return false;
    const channelId = STATE.discord.lastOwnerChannelId;
    if (channelId && client.channels?.cache?.get(channelId)) {
      const payload = buildDiscordSendOptions(text, channelId);
      await client.channels.cache.get(channelId).send(payload);
      if (payload?.files?.length) {
        const delivery = resolveDropboxDeliveryFile(text);
        if (delivery) {
          recordDropboxDelivery({
            channelId,
            to: channelId,
            absPath: delivery.absPath,
            size: delivery.size,
            sha256: computeSha256Hex(delivery.absPath),
            mode: 'notifyOwner:channel',
          });
        }
      }
      pushShortMemory(channelId, 'assistant', payload.content);
      recordLongTermAssistant(channelId, payload.content);
      return true;
    }
    const user = await client.users.fetch(ownerId).catch(() => null);
    if (!user) return false;
    const payload = buildDiscordSendOptions(text);
    await user.send(payload);
    if (payload?.files?.length) {
      const delivery = resolveDropboxDeliveryFile(text);
      if (delivery) {
        recordDropboxDelivery({
          channelId: null,
          to: ownerId,
          absPath: delivery.absPath,
          size: delivery.size,
          sha256: computeSha256Hex(delivery.absPath),
          mode: 'notifyOwner:dm',
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}

function resolveHarnessPath() {
  if (fs.existsSync(HARNESS_PATH_WS)) return HARNESS_PATH_WS;
  if (fs.existsSync(HARNESS_PATH_ROOT)) return HARNESS_PATH_ROOT;
  return null;
}

function parseCliRegistry() {
  const raw = safeReadUtf8(CLI_REGISTRY_PATH).trim();
  if (!raw) return [];
  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.tools)) return json.tools;
    if (Array.isArray(json?.items)) return json.items;
    if (json && typeof json === 'object') {
      const arr = [];
      for (const [name, v] of Object.entries(json)) {
        if (v && typeof v === 'object') arr.push({ name, ...v });
      }
      return arr;
    }
  } catch {}
  return [];
}

function normalizeCliEntry(entry) {
  const name = String(entry?.name || entry?.id || '').trim();
  const p = String(entry?.path || entry?.file || '').trim();
  const kind = String(entry?.kind || entry?.type || '').trim().toLowerCase();
  const args = Array.isArray(entry?.args) ? entry.args.map(String) : [];
  if (!name || !p) return null;

  const abs = path.isAbsolute(p) ? p : path.join(CLI_ANYTHING_DIR, p);
  const resolved = path.resolve(abs);
  if (!isSubPath(CLI_ANYTHING_DIR, resolved) && resolved !== CLI_ANYTHING_DIR) return null;

  let finalKind = kind;
  if (!finalKind) {
    const ext = path.extname(resolved).toLowerCase();
    if (ext === '.py') finalKind = 'py';
    else if (ext === '.js') finalKind = 'node';
    else if (ext === '.exe') finalKind = 'exe';
    else finalKind = 'bin';
  }

  return { name, kind: finalKind, path: resolved, args };
}

function buildProxyEnv() {
  try {
    if (String(process.env.NODE_ENV || '').trim() === 'production') return {};
    const proxy =
      String(process.env.OPENCLAW_PROXY_URL || '').trim() ||
      String(process.env.PROXY_URL || '').trim() ||
      String(process.env.HTTP_PROXY || '').trim() ||
      String(process.env.HTTPS_PROXY || '').trim() ||
      'http://127.0.0.1:7890';
    if (!proxy) return {};
    return {
      HTTP_PROXY: process.env.HTTP_PROXY || proxy,
      HTTPS_PROXY: process.env.HTTPS_PROXY || proxy,
      ALL_PROXY: process.env.ALL_PROXY || proxy,
    };
  } catch {
    return {};
  }
}

function spawnCapture(file, args, timeoutMs, envExtra) {
  return new Promise((resolve) => {
    const env = { ...process.env, ...(envExtra || {}) };
    const child = childProcess.spawn(file, args, { shell: false, windowsHide: true, env });
    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      try {
        child.kill();
      } catch {}
    }, timeoutMs);

    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: typeof code === 'number' ? code : 1, stdout, stderr, killed });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: (stderr + '\n' + (e?.message || e)).trim(), killed: false });
    });
  });
}

async function executeCli(entry, mode) {
  ensureDir(CLI_LOG_DIR);
  const harness = resolveHarnessPath();
  if (!harness) {
    return { ok: false, msg: '⚠️ 主人\n🔹 未找到 HARNESS.md\n🔹 已按稳健法则拒绝执行 execute_cli\n🔹 请先补齐 HARNESS.md 后再试' };
  }

  if (!fs.existsSync(entry.path)) {
    return { ok: false, msg: `⚠️ 主人\n🔹 CLI 文件不存在\n🔹 工具: ${entry.name}` };
  }

  const baseArgs = [...entry.args];
  const wantRun = mode === 'run';
  const dryArgs = uniqueList([...baseArgs, '--dry-run', '--json']);

  const cmd = (() => {
    if (entry.kind === 'py') return { file: 'py', argsPrefix: ['-3', entry.path] };
    if (entry.kind === 'node') return { file: 'node', argsPrefix: [entry.path] };
    if (entry.kind === 'exe') return { file: entry.path, argsPrefix: [] };
    return { file: entry.path, argsPrefix: [] };
  })();

  const dry = await spawnCapture(cmd.file, [...cmd.argsPrefix, ...dryArgs], 30_000);
  STATE.cli.lastDryRunAt = new Date().toISOString();
  STATE.cli.lastTool = entry.name;
  STATE.cli.lastOk = dry.code === 0 && !dry.killed;

  const dryOut = (dry.stdout || '').trim();
  let parsed = null;
  try {
    parsed = dryOut ? JSON.parse(dryOut) : null;
  } catch {
    parsed = null;
  }

  if (dry.killed || dry.code !== 0 || !parsed) {
    const log = [
      `时间: ${formatTs(new Date())}`,
      `工具: ${entry.name}`,
      `模式: dry-run`,
      `退出码: ${dry.code}`,
      `超时: ${dry.killed ? '是' : '否'}`,
      `stdout(前500): ${redactSecrets(dryOut).slice(0, 500)}`,
      `stderr(前500): ${redactSecrets(dry.stderr || '').slice(0, 500)}`,
    ].join('\n');
    writeFileSafe(path.join(CLI_LOG_DIR, `dryrun_${Date.now()}_${entry.name}.log`), log + '\n');
    return { ok: false, msg: `⚠️ 主人\n🔹 影子模式 dry-run 失败\n🔹 工具: ${entry.name}\n🔹 要求: 必须支持 --dry-run 与 --json 且输出有效 JSON` };
  }

  if (!wantRun) {
    return { ok: true, msg: `✅ 主人\n🔹 影子模式 dry-run 通过\n🔹 工具: ${entry.name}\n🔹 输出(JSON)已可解析\n🔹 已按稳健法则停在 dry-run` };
  }

  const runArgs = uniqueList([...baseArgs, '--json']);
  const run = await spawnCapture(cmd.file, [...cmd.argsPrefix, ...runArgs], 60_000);
  STATE.cli.lastRunAt = new Date().toISOString();
  STATE.cli.lastOk = run.code === 0 && !run.killed;

  const runOut = (run.stdout || '').trim();
  let runParsed = null;
  try {
    runParsed = runOut ? JSON.parse(runOut) : null;
  } catch {
    runParsed = null;
  }

  if (run.killed || run.code !== 0 || !runParsed) {
    const log = [
      `时间: ${formatTs(new Date())}`,
      `工具: ${entry.name}`,
      `模式: run`,
      `退出码: ${run.code}`,
      `超时: ${run.killed ? '是' : '否'}`,
      `stdout(前500): ${redactSecrets(runOut).slice(0, 500)}`,
      `stderr(前500): ${redactSecrets(run.stderr || '').slice(0, 500)}`,
    ].join('\n');
    writeFileSafe(path.join(CLI_LOG_DIR, `run_${Date.now()}_${entry.name}.log`), log + '\n');
    return { ok: false, msg: `⚠️ 主人\n🔹 实跑失败\n🔹 工具: ${entry.name}\n🔹 已落盘日志以便长寿保护现场` };
  }

  return { ok: true, msg: `✅ 主人\n🔹 实跑完成\n🔹 工具: ${entry.name}\n🔹 输出(JSON)已可解析` };
}

async function handleExecuteCli(msg, content) {
  const ownerId = STATE.discord.ownerUserId;
  if (!ownerId || msg.author?.id !== ownerId) {
    return { handled: true, reply: '⚠️ 主人\n🔹 execute_cli 仅允许主人触发\n🔹 已拒绝执行' };
  }

  const parts = content.trim().split(/\s+/);
  if (parts.length < 2) {
    return { handled: true, reply: '⚠️ 主人\n🔹 用法: !cli list | !cli test <工具名> | !cli run <工具名>' };
  }

  const sub = parts[1].toLowerCase();
  const registry = parseCliRegistry().map(normalizeCliEntry).filter(Boolean);

  if (sub === 'list') {
    if (registry.length === 0) {
      return { handled: true, reply: '⚠️ 主人\n🔹 未发现可用 CLI 注册表\n🔹 路径: workspace/CLI_ANYTHING/registry.json' };
    }
    const names = registry.map((e) => e.name).slice(0, 18);
    return { handled: true, reply: `✅ 主人\n🔹 已登记 CLI: ${names.join('、')}` };
  }

  if (parts.length < 3) {
    return { handled: true, reply: '⚠️ 主人\n🔹 缺少工具名\n🔹 用法: !cli test <工具名> | !cli run <工具名>' };
  }

  const tool = parts[2];
  const entry = registry.find((e) => e.name === tool);
  if (!entry) {
    return { handled: true, reply: `⚠️ 主人\n🔹 未找到工具: ${tool}\n🔹 用法: !cli list` };
  }

  if (sub !== 'test' && sub !== 'run') {
    return { handled: true, reply: '⚠️ 主人\n🔹 子命令仅支持 list/test/run' };
  }

  const res = await executeCli(entry, sub);
  return { handled: true, reply: res.msg };
}

function resolveDropboxDirNameForAgent(agentName) {
  const name = String(agentName || '').trim();
  if (!name) return null;
  const dirs = listDropboxAgentDirs();
  const direct = dirs.find((d) => d === name);
  if (direct) return direct;
  const suffix = `_${name}`;
  const hit = dirs.find((d) => d.endsWith(suffix)) || dirs.find((d) => d.includes(suffix));
  return hit || null;
}

async function handleTts(msg, content) {
  if (!isOwnerOrAdmin(msg)) return { handled: true, reply: '⚠️ 主人\n🔹 tts 仅允许主人/管理员触发\n🔹 已拒绝执行' };

  const parts = String(content || '').trim().split(/\s+/);
  if (parts.length < 2) {
    return { handled: true, reply: '⚠️ 主人\n🔹 用法: !tts <内阁名可选> <文本>\n🔹 例: !tts 药老 这是一段 30 秒旁白' };
  }

  let idx = 1;
  const maybeName = parts[1];
  const normalized = normalizeAgentName(maybeName);
  const bound = getBoundAgentForChannel(msg.guildId, msg.channelId);
  const agentName = normalized || bound || '银月';
  if (normalized) idx = 2;
  const text = parts.slice(idx).join(' ').trim();
  if (!text) return { handled: true, reply: '⚠️ 主人\n🔹 文本为空\n🔹 用法: !tts <内阁名可选> <文本>' };

  ensureDropboxSkeleton(STATE.agents);
  let dirName = resolveDropboxDirNameForAgent(agentName);
  if (!dirName) {
    dirName = safePathSegment(agentName);
    ensureDir(path.join(DROPBOX_DIR, dirName));
  }

  const stamp = Date.now();
  const fileBase = `tts_${stamp}_${safePathSegment(agentName)}`.slice(0, 80);
  const absPath = path.join(DROPBOX_DIR, dirName, `${fileBase}.mp3`);
  const relPath = `DROPBOX/${dirName}/${path.basename(absPath)}`.replace(/\\/g, '/');

  const voice = String(process.env.EDGE_TTS_VOICE || 'zh-CN-XiaoxiaoNeural').trim();
  const rate = String(process.env.EDGE_TTS_RATE || '').trim();
  const pitch = String(process.env.EDGE_TTS_PITCH || '').trim();

  const args = ['edge-tts', '--text', text, '--write-media', absPath, '--voice', voice];
  if (rate) args.push(`--rate=${rate}`);
  if (pitch) args.push(`--pitch=${pitch}`);

  const run = await spawnCapture('uvx', args, 120_000, buildProxyEnv());
  if (run.killed || run.code !== 0 || !fs.existsSync(absPath)) {
    return {
      handled: true,
      reply: `⚠️ 主人\n🔹 TTS 生成失败\n🔹 退出码: ${run.code}\n🔹 说明: 可能缺少 uvx/edge-tts 环境或网络/代理不通\n🔹 stderr(前300): ${(run.stderr || '').slice(0, 300)}`,
    };
  }

  return {
    handled: true,
    reply: `✅ 主人\n🔹 TTS已交付\n🔹 内阁: ${agentName}\n🔹 DROPBOX路径: ${relPath}\n🔹 附件: 已上传同名文件`,
  };
}

function pickFirstAudioAttachment(msg) {
  try {
    const items = [];
    if (msg?.attachments && typeof msg.attachments.forEach === 'function') {
      msg.attachments.forEach((a) => items.push(a));
    }
    for (const a of items) {
      const name = String(a?.name || '').toLowerCase();
      const ct = String(a?.contentType || '').toLowerCase();
      if (ct.startsWith('audio/')) return a;
      if (/\.(ogg|opus|mp3|m4a|wav|webm)$/i.test(name)) return a;
    }
    return null;
  } catch {
    return null;
  }
}

async function transcribeAudioAttachment(att) {
  const url = String(att?.url || '').trim();
  if (!url) throw new Error('missing attachment url');
  const name = String(att?.name || 'voice.ogg').trim() || 'voice.ogg';
  const mime = String(att?.contentType || '').trim() || 'audio/ogg';
  const buf = await fetchBinary(url, 18_000_000);

  const model = String(process.env.OPENCLAW_STT_MODEL || 'whisper-1').trim() || 'whisper-1';

  if (ZERO_TOKEN_BASE_URL) {
    const base = ZERO_TOKEN_BASE_URL.replace(/\/+$/g, '');
    const key = ZERO_TOKEN_GATEWAY_TOKEN;
    const t = await callOpenAiCompatibleTranscription(`${base}/v1/audio/transcriptions`, key, model, buf, name, mime);
    if (t) return t;
  }

  if (process.env.OPENAI_API_KEY) {
    const base = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com').trim().replace(/\/+$/g, '');
    const t = await callOpenAiCompatibleTranscription(`${base}/v1/audio/transcriptions`, String(process.env.OPENAI_API_KEY).trim(), model, buf, name, mime);
    if (t) return t;
  }

  return null;
}

async function handleWhisper(msg, content) {
  if (!isOwnerOrAdmin(msg)) return { handled: true, reply: '⚠️ 主人\n🔹 whisper 仅允许主人/管理员触发\n🔹 已拒绝执行' };
  const att = pickFirstAudioAttachment(msg);
  if (!att) {
    return { handled: true, reply: '⚠️ 主人\n🔹 未检测到语音附件\n🔹 请直接发送语音留言/音频文件（ogg/mp3/m4a/wav）' };
  }
  const text = await transcribeAudioAttachment(att);
  if (!text) {
    return {
      handled: true,
      reply: '⚠️ 主人\n🔹 语音转写未配置或不可用\n🔹 需要配置其一：OPENCLAW_ZERO_TOKEN_URL(+TOKEN) 或 OPENAI_API_KEY',
    };
  }
  if (/(取消|撤销|不要|关掉).{0,6}(提醒|定时)/.test(text)) {
    const r = cancelRecentReminder(msg.channelId, msg.author?.id, 10 * 60 * 1000);
    if (r.ok) {
      return { handled: true, reply: `✅ 已取消刚才的提醒\n🔹 编号：${String(r.item.id || '').slice(0, 8)}\n🔹 内容：${r.item.message}` };
    }
    return { handled: true, reply: '⚠️ 主人\n🔹 未找到“刚才”的提醒\n🔹 你可以用：!remind list' };
  }
  const reminder = createReminderFromText(msg.channelId, msg.author?.id, text, 'voice');
  if (reminder.ok) {
    const timeText = formatTs(toTzDate(new Date(reminder.item.atIso)));
    return {
      handled: true,
      reply: [
        '✅ 语音提醒已创建',
        `🔹 时间：${timeText}`,
        `🔹 内容：${reminder.item.message}`,
        `🔹 编号：${reminder.item.id.slice(0, 8)}`,
      ].join('\n'),
    };
  }
  if (reminder.needTime) {
    return {
      handled: true,
      reply: `✅ 转写结果\n${text}\n\n⚠️ 还缺提醒时间。请补一句：例如“30分钟后提醒我… / 今天23:10提醒我…”`,
    };
  }
  return { handled: true, reply: `✅ 转写结果\n${text}` };
}

function ensureLeadsHeader() {
  if (fs.existsSync(LEADS_PATH)) return;
  const body = [
    'LEADS',
    `更新时间: ${formatTs(new Date())}`,
    '来源: RedBox（小红书引流）',
    '',
    '线索清单',
    '---',
    '🔹 暂无',
    '',
    '备注',
    '---',
    '🔹 RedBox 仅归属 小医仙',
    '🔹 未经主人明确指令，不做任何对外发布或投放动作',
    '',
  ].join('\n');
  writeFileSafe(LEADS_PATH, body);
}

function appendLeadCards(items, meta) {
  ensureLeadsHeader();
  const header = [
    '',
    '---',
    `更新时间: ${formatTs(new Date())}`,
    `来源: ${meta?.source || 'RedBox'}`,
    `说明: ${meta?.note || '落盘骨架（待配置 RedBox 执行环境）'}`,
    '',
  ].join('\n');

  const lines = [];
  for (const it of items || []) {
    lines.push('---');
    lines.push('🧲 线索');
    lines.push(`🔹 客户: ${it.customer || '未知'}`);
    lines.push(`🔹 需求: ${it.need || '未知'}`);
    lines.push(`🔹 预算: ${it.budget || '未知'}`);
    lines.push(`🔹 渠道: ${it.channel || '小红书'}`);
    lines.push(`🔹 证据: ${it.evidence || '未附'}`);
  }

  try {
    fs.appendFileSync(LEADS_PATH, header + (lines.join('\n') || '---\n🧲 线索\n🔹 暂无\n') + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

async function runRedboxLeadScan() {
  const hasCfg = !!(process.env.REDBOX_PROFILE || process.env.REDBOX_COOKIES);
  const items = [];

  if (!hasCfg) {
    appendLeadCards(items, { source: 'RedBox', note: '未配置 REDBOX_PROFILE/REDBOX_COOKIES，当前仅落盘骨架' });
    return { ok: false, detail: '未配置' };
  }

  appendLeadCards(items, { source: 'RedBox', note: '已配置凭据，但 RedBox 执行器尚未在本进程内落地（仅落盘骨架）' });
  return { ok: true, detail: '已配置(待执行器)' };
}

async function handleRedbox(msg, content) {
  const ownerId = STATE.discord.ownerUserId;
  if (!ownerId || msg.author?.id !== ownerId) {
    return { handled: true, reply: '⚠️ 主人\n🔹 redbox 仅允许主人触发\n🔹 已拒绝执行' };
  }

  const parts = content.trim().split(/\s+/);
  const sub = (parts[1] || '').toLowerCase();
  if (!sub) return { handled: true, reply: '⚠️ 主人\n🔹 用法: !redbox scan | !redbox status' };

  if (sub === 'status') {
    const ok = !!(process.env.REDBOX_PROFILE || process.env.REDBOX_COOKIES);
    return { handled: true, reply: `✅ 主人\n🔹 RedBox 归属: 小医仙\n🔹 状态: ${ok ? '已配置' : '未配置'}\n🔹 落盘: workspace/LEADS.md` };
  }

  if (sub === 'scan') {
    const locked = await withLock(REDBOX_LOCK_PATH, 'redbox', '小医仙:redbox', async () => {
      const r = await runRedboxLeadScan();
      return r;
    });
    if (!locked.ok) return { handled: true, reply: '⚠️ 主人\n🔹 RedBox 通道繁忙或锁被占用\n🔹 请稍后重试' };
    const r = locked.value;
    return { handled: true, reply: `✅ 主人\n🔹 小医仙已执行线索落盘\n🔹 结果: ${r.ok ? '完成' : '未完成'} | ${r.detail}\n🔹 文件: workspace/LEADS.md` };
  }

  return { handled: true, reply: '⚠️ 主人\n🔹 子命令仅支持 scan/status' };
}

function ensureStaffRequestsHeader() {
  if (fs.existsSync(STAFF_REQUESTS_PATH)) return;
  const body = [
    'STAFF_REQUESTS',
    `更新时间: ${formatTs(new Date())}`,
    '说明: 内阁成员提交的人手申请（银月汇总），主人审核后决定是否增员',
    '',
    '申请清单',
    '---',
    '🔹 暂无',
    '',
  ].join('\n');
  writeFileSafe(STAFF_REQUESTS_PATH, body);
}

function listPendingAgentFiles() {
  try {
    if (!fs.existsSync(STAFF_PENDING_DIR)) return [];
    return fs
      .readdirSync(STAFF_PENDING_DIR)
      .filter((f) => f.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  } catch {
    return [];
  }
}

function ensurePendingAgentTemplate(filename, requester, reason) {
  ensureDir(STAFF_PENDING_DIR);
  const safeName = String(filename || '').trim().replace(/[\\/:*?"<>|]/g, '_');
  const base = safeName.endsWith('.md') ? safeName : `${safeName}.md`;
  const full = path.join(STAFF_PENDING_DIR, base);
  if (!isSubPath(STAFF_PENDING_DIR, full) && full !== STAFF_PENDING_DIR) return null;
  if (fs.existsSync(full)) return full;

  const parts = base.replace(/\.md$/i, '').split('_');
  const code = parts[0] || '00';
  const role = parts[1] || '待招';
  const name = parts[2] || '新成员';

  const content = [
    `${code}. ${role}·待招`,
    '',
    `名字：${name}`,
    '',
    `席位：${role}`,
    '',
    `申请来源：${requester || '未知'}`,
    `申请原因：${reason || '未提供'}`,
    '',
    'Style：',
    '',
    'Goal：',
    '',
    '边界：',
    '',
    '沟通风格：尊称“主人”。',
    '',
  ].join('\n');
  return writeFileSafe(full, content) ? full : null;
}

function parseStaffRequest(text, requesterAgent) {
  const s = String(text || '');
  const hit = /(人手申请|增加人手|增员|人手不足|需要人手)/.test(s);
  if (!hit) return null;

  const suggested = [];
  const reFile = /\b\d{2}_[^ \n\r\t]+?\.md\b/g;
  let m;
  while ((m = reFile.exec(s)) !== null) {
    const f = m[0].trim();
    if (f && !suggested.includes(f)) suggested.push(f);
  }

  const reasonLine = s
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /原因|理由|瓶颈|卡点/.test(l));

  const reason = reasonLine ? reasonLine.replace(/^🔹\s*/, '') : '工作量或复杂度超过单人处理阈值';
  const id = fingerprint('staff', `${requesterAgent}|${reason}|${suggested.join(',')}`);

  return {
    id,
    requester: requesterAgent || '未知',
    reason,
    suggestedFiles: suggested.length > 0 ? suggested : ['00_待招_新成员.md'],
  };
}

async function appendStaffRequest(req) {
  ensureStaffRequestsHeader();
  ensureDir(STAFF_PENDING_DIR);

  const block = [
    '',
    '---',
    '🧑‍🤝‍🧑 人手申请',
    `🔹 ID: ${req.id}`,
    `🔹 申请者: ${req.requester}`,
    `🔹 原因: ${req.reason}`,
    '🔹 建议增员:',
    ...req.suggestedFiles.map((f) => `✅ ${f}`),
    '',
  ].join('\n');

  const locked = await withLock(STAFF_LOCK_PATH, 'staff', '银月:staff', async () => {
    try {
      fs.appendFileSync(STAFF_REQUESTS_PATH, block, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  if (!locked.ok || !locked.value) return false;

  for (const f of req.suggestedFiles.slice(0, 3)) {
    ensurePendingAgentTemplate(f, req.requester, req.reason);
  }
  return true;
}

async function handleStaff(msg, content) {
  const ownerId = STATE.discord.ownerUserId;
  if (!ownerId || msg.author?.id !== ownerId) {
    return { handled: true, reply: '⚠️ 主人\n🔹 staff 仅允许主人触发\n🔹 已拒绝执行' };
  }

  const parts = content.trim().split(/\s+/);
  const sub = (parts[1] || '').toLowerCase();
  if (!sub) return { handled: true, reply: '⚠️ 主人\n🔹 用法: !staff status | !staff list | !staff create <文件名> | !staff promote <文件名>' };

  if (sub === 'status') {
    const pending = listPendingAgentFiles();
    return {
      handled: true,
      reply: `✅ 主人\n🔹 申请簿: workspace/STAFF_REQUESTS.md\n🔹 待补档案目录: workspace/AGENTS_SOUL/PENDING\n🔹 待补档案数: ${pending.length}`,
    };
  }

  if (sub === 'list') {
    ensureStaffRequestsHeader();
    const raw = safeReadUtf8(STAFF_REQUESTS_PATH);
    const ids = [];
    const re = /ID:\s*([a-f0-9]{40})/g;
    let mm;
    while ((mm = re.exec(raw)) !== null) ids.push(mm[1]);
    const tail = ids.slice(-5);
    return { handled: true, reply: tail.length === 0 ? '✅ 主人\n🔹 当前无待审批人手申请' : `✅ 主人\n🔹 近5条申请ID\n${tail.map((x) => `🔹 ${x}`).join('\n')}` };
  }

  if (sub === 'create') {
    const fname = parts.slice(2).join(' ').trim();
    if (!fname) return { handled: true, reply: '⚠️ 主人\n🔹 缺少文件名\n🔹 示例: !staff create 12_研究_量化助手.md' };
    const full = ensurePendingAgentTemplate(fname, '主人手动创建', '待补充');
    if (!full) return { handled: true, reply: '⚠️ 主人\n🔹 创建失败\n🔹 请检查文件名是否合法' };
    return { handled: true, reply: `✅ 主人\n🔹 已创建待补档案\n🔹 路径: ${full}` };
  }

  if (sub === 'promote') {
    const fname = parts.slice(2).join(' ').trim();
    if (!fname) return { handled: true, reply: '⚠️ 主人\n🔹 缺少文件名\n🔹 示例: !staff promote 12_研究_量化助手.md' };
    const safeName = fname.endsWith('.md') ? fname : `${fname}.md`;
    const from = path.join(STAFF_PENDING_DIR, safeName);
    const to = path.join(AGENTS_DIR, safeName);
    if (!fs.existsSync(from)) return { handled: true, reply: '⚠️ 主人\n🔹 待补档案不存在\n🔹 请先在 PENDING 创建或补齐文件' };
    try {
      fs.renameSync(from, to);
      loadAgents();
      ensureDropboxSkeleton(STATE.agents);
      buildAgentSkills(STATE.agents);
      buildSkillVisibility(STATE.agents);
      return { handled: true, reply: `✅ 主人\n🔹 已晋升为正式内阁成员\n🔹 档案: workspace/AGENTS_SOUL/${safeName}` };
    } catch {
      return { handled: true, reply: '⚠️ 主人\n🔹 晋升失败\n🔹 可能是文件被占用或权限不足' };
    }
  }

  return { handled: true, reply: '⚠️ 主人\n🔹 子命令仅支持 status/list/create/promote' };
}

function extractCodexAssistantMessage(stdout) {
  const lines = String(stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let lastText = null;
  let lastError = null;
  for (const line of lines) {
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (evt?.type === 'error' && typeof evt.message === 'string') lastError = evt.message;
    if (evt?.type === 'turn.failed' && evt?.error?.message) lastError = String(evt.error.message);
    if (evt?.type === 'item.completed' && evt?.item?.item_type === 'assistant_message') {
      lastText = evt.item.text || null;
    }
  }
  return { lastText, lastError };
}

function parseMaybeJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ensureChangelogHeader() {
  if (fs.existsSync(CHANGELOG_PROPOSAL_PATH)) return;
  const body = [
    'CHANGELOG_PROPOSAL',
    '用途: Codex 提案 diff 的审计与变更说明（由长寿审核后落盘）',
    '说明: 本文件不包含密钥；若出现疑似密钥会被脱敏',
    '',
  ].join('\n');
  writeFileSafe(CHANGELOG_PROPOSAL_PATH, body);
}

function appendChangelogBlock(title, content) {
  ensureChangelogHeader();
  const block = [
    '',
    `时间: ${formatTs(new Date())}`,
    `主题: ${title}`,
    '',
    String(content || '').trim(),
    '',
  ].join('\n');
  try {
    fs.appendFileSync(CHANGELOG_PROPOSAL_PATH, redactSecrets(block), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

async function codexExecute(msg, instruction) {
  const ownerId = STATE.discord.ownerUserId;
  if (!ownerId || msg.author?.id !== ownerId) {
    return { ok: false, reply: '⚠️ 主人\n🔹 codex_execute 仅允许主人触发\n🔹 已拒绝执行' };
  }

  const harness = resolveHarnessPath();
  if (!harness) {
    return { ok: false, reply: '⚠️ 主人\n🔹 未找到 HARNESS.md\n🔹 已按稳健法则拒绝执行 codex_execute' };
  }

  const prompt = String(instruction || '').trim();
  if (!prompt) return { ok: false, reply: '⚠️ 主人\n🔹 用法: !codex <指令>' };

  const locked = await withLock(CODEX_LOCK_PATH, 'codex', '长寿:codex', async () => {
    const args = [
      'exec',
      prompt,
      '--sandbox',
      'read-only',
      '--json',
      '--skip-git-repo-check',
      '--cd',
      __dirname,
    ];

    const run = await spawnCapture('codex', args, 90_000);
    const parsed = extractCodexAssistantMessage(run.stdout);
    const err = parsed.lastError || (run.stderr || '').trim();

    if (run.code !== 0) {
      appendChangelogBlock('Codex 执行失败', `错误: ${err || '未知'}\n指令: ${prompt}`);
      return {
        ok: false,
        reply: `⚠️ 主人\n🔹 Codex 执行失败\n🔹 ${redactSecrets(err || '未知错误')}\n🔹 已落盘: CHANGELOG_PROPOSAL.md`,
      };
    }

    const lastText = parsed.lastText || '';
    const asJson = parseMaybeJson(lastText);

    let diff = '';
    let summary = '';
    let changelog = '';
    if (asJson) {
      diff = String(asJson.diff || asJson.patch || '').trim();
      summary = String(asJson.summary || asJson.message || '').trim();
      changelog = String(asJson.changelog || asJson.changelog_proposal || '').trim();
    } else {
      summary = String(lastText).trim();
    }

    const auditPromptParts = [];
    auditPromptParts.push('请以 /think high 标准审计 Codex 提案。');
    auditPromptParts.push('要求：列风险点、备选方案、是否允许执行、需要主人确认的项。');
    auditPromptParts.push('');
    if (summary) auditPromptParts.push(`Codex 摘要:\n${summary}`);
    if (changelog) auditPromptParts.push(`Changelog 草案:\n${changelog}`);
    if (diff) auditPromptParts.push(`Diff 提案:\n${diff}`);
    const auditPrompt = auditPromptParts.join('\n\n');

    const extra = buildAgentInstruction('李长寿', '【当前思维模式：复杂任务 /think high】请先推演风险，再汇报最优解。', { channelId: STATE.discord.lastOwnerChannelId, userText: auditPrompt });
    const audit = await askHermes(auditPrompt, '李长寿', extra, { channelId: STATE.discord.lastOwnerChannelId });

    appendChangelogBlock('Codex 提案与长寿审计', [
      `指令: ${prompt}`,
      summary ? `\nCodex 摘要:\n${summary}` : '',
      changelog ? `\nCodex Changelog:\n${changelog}` : '',
      diff ? `\nCodex Diff:\n${diff}` : '',
      `\n长寿审计:\n${audit}`,
    ].join('\n').trim());

    return {
      ok: true,
      reply: '✅ 主人\n🔹 Codex 已完成一次提案生成\n🔹 长寿审计已落盘\n🔹 文件: workspace/CHANGELOG_PROPOSAL.md',
    };
  });

  if (!locked.ok) {
    return { ok: false, reply: '⚠️ 主人\n🔹 Codex 通道繁忙或锁被占用\n🔹 请稍后重试' };
  }

  return locked.value;
}

function ensureCodeRefinementHeader() {
  if (fs.existsSync(CODE_REFINEMENT_PATH)) return;
  const body = [
    'CODE_REFINEMENT',
    '用途: Codex 影子开发（workspace/SANDBOX）产出的炼化记录与修改点清单',
    '说明: 仅提案与影子验证；不直接改动主仓库代码；若出现疑似密钥会被脱敏',
    '',
  ].join('\n');
  writeFileSafe(CODE_REFINEMENT_PATH, body);
}

function appendCodeRefinementBlock(title, content) {
  ensureCodeRefinementHeader();
  const block = [
    '',
    `时间: ${formatTs(new Date())}`,
    `主题: ${title}`,
    '',
    String(content || '').trim(),
    '',
  ].join('\n');
  try {
    fs.appendFileSync(CODE_REFINEMENT_PATH, redactSecrets(block), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function makeSandboxRunDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(SANDBOX_DIR, stamp);
  ensureDir(dir);
  return dir;
}

function safeWriteSandboxFile(runDir, relPath, content) {
  const rel = String(relPath || '').replace(/^[\\/]+/, '').trim();
  if (!rel) return { ok: false };
  const full = path.resolve(path.join(runDir, rel));
  if (!isSubPath(runDir, full) && full !== runDir) return { ok: false };
  ensureDir(path.dirname(full));
  const ok = writeFileSafe(full, String(content || ''));
  return { ok, path: full };
}

async function shadowValidateFiles(paths) {
  const results = [];
  for (const p of paths) {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.js') {
      const r = await spawnCapture('node', ['--check', p], 20_000);
      results.push({ file: p, tool: 'node --check', ok: r.code === 0 && !r.killed });
    } else if (ext === '.py') {
      const r = await spawnCapture('py', ['-3', '-m', 'py_compile', p], 20_000);
      results.push({ file: p, tool: 'py -3 -m py_compile', ok: r.code === 0 && !r.killed });
    }
  }
  return results;
}

function buildCodexBridgePrompt(userInstruction) {
  const li = STATE.agents.find((a) => a.name === '李长寿');
  const liDoc = li?.content || '';
  const agentsIndex = STATE.agents
    .map((a) => `${a.filename}`)
    .slice(0, 30)
    .join('\n');

  return [
    '你是“李长寿”，负责稳健地提出代码炼化与重构提案。',
    '约束：只允许输出 JSON（单个对象），不得输出 Markdown 代码块。',
    '约束：任何生成的代码必须写入 workspace/SANDBOX（用相对路径表示）。',
    '约束：必须给出可影子验证的最小产物（例如单文件脚本/模块）。',
    '',
    '可读取的内阁档案（索引）：',
    agentsIndex,
    '',
    '李长寿档案（全文）：',
    liDoc,
    '',
    '用户指令：',
    String(userInstruction || '').trim(),
    '',
    '输出 JSON 结构（必须严格遵守）：',
    [
      '{',
      '  "summary": "一句话摘要",',
      '  "changes": ["修改点1", "修改点2"],',
      '  "files": [',
      '    { "path": "some_file.js", "content": "..." }',
      '  ]',
      '}',
    ].join('\n'),
  ].join('\n');
}

async function codexBridge(msg, instruction) {
  const ownerId = STATE.discord.ownerUserId;
  if (!ownerId || msg.author?.id !== ownerId) {
    return { ok: false, reply: '⚠️ 主人\n🔹 codex_bridge 仅允许主人触发\n🔹 已拒绝执行' };
  }

  const harness = resolveHarnessPath();
  if (!harness) {
    return { ok: false, reply: '⚠️ 主人\n🔹 未找到 HARNESS.md\n🔹 已按稳健法则拒绝执行 codex_bridge' };
  }

  const userPrompt = String(instruction || '').trim();
  if (!userPrompt) return { ok: false, reply: '⚠️ 主人\n🔹 用法: !codexb <指令>' };

  const locked = await withLock(CODEX_LOCK_PATH, 'codex', '长寿:codex_bridge', async () => {
    const prompt = buildCodexBridgePrompt(userPrompt);
    const args = [
      'exec',
      prompt,
      '--sandbox',
      'read-only',
      '--json',
      '--skip-git-repo-check',
      '--cd',
      __dirname,
    ];

    const run = await spawnCapture('codex', args, 120_000);
    const parsed = extractCodexAssistantMessage(run.stdout);
    const err = parsed.lastError || (run.stderr || '').trim();

    if (run.code !== 0) {
      appendCodeRefinementBlock('CodexBridge 执行失败', `错误: ${err || '未知'}\n指令: ${userPrompt}`);
      return {
        ok: false,
        reply: `⚠️ 主人\n🔹 CodexBridge 执行失败\n🔹 ${redactSecrets(err || '未知错误')}\n🔹 已落盘: CODE_REFINEMENT.md`,
      };
    }

    const lastText = parsed.lastText || '';
    const asJson = parseMaybeJson(lastText);
    if (!asJson || !Array.isArray(asJson.files)) {
      appendCodeRefinementBlock('CodexBridge 输出不合规', `指令: ${userPrompt}\n输出: ${String(lastText).slice(0, 2000)}`);
      return {
        ok: false,
        reply: '⚠️ 主人\n🔹 CodexBridge 输出不合规\n🔹 要求: 必须输出 JSON 且包含 files[]\n🔹 已落盘: CODE_REFINEMENT.md',
      };
    }

    const runDir = makeSandboxRunDir();
    const written = [];
    for (const f of asJson.files) {
      const w = safeWriteSandboxFile(runDir, f?.path, f?.content);
      if (w.ok && w.path) written.push(w.path);
    }

    const checks = await shadowValidateFiles(written);
    const okCount = checks.filter((c) => c.ok).length;
    const failCount = checks.filter((c) => !c.ok).length;

    const changes = Array.isArray(asJson.changes) ? asJson.changes.map(String).filter(Boolean) : [];
    const summary = String(asJson.summary || '').trim();

    const reportLines = [];
    reportLines.push('✅ 主人');
    reportLines.push('🔹 codex_bridge 已完成影子产物落盘');
    reportLines.push(`🔹 SANDBOX: ${runDir}`);
    if (summary) reportLines.push(`🔹 摘要: ${summary}`);
    if (changes.length > 0) {
      reportLines.push('🔹 修改点');
      for (const c of changes.slice(0, 12)) reportLines.push(`🔸 ${c}`);
    }
    reportLines.push(`🔹 影子验证: 通过 ${okCount} | 失败 ${failCount}`);

    appendCodeRefinementBlock('CodexBridge 影子炼化结果', [
      `指令: ${userPrompt}`,
      summary ? `\n摘要:\n${summary}` : '',
      changes.length > 0 ? `\n修改点:\n- ${changes.join('\n- ')}` : '',
      `\nSANDBOX:\n${runDir}`,
      checks.length > 0
        ? `\n影子验证:\n- ${checks.map((c) => `${c.ok ? '✅' : '⚠️'} ${c.tool} | ${c.file}`).join('\n- ')}`
        : '\n影子验证:\n- 无可验证文件',
    ].join('\n').trim());

    return { ok: true, reply: reportLines.join('\n') };
  });

  if (!locked.ok) return { ok: false, reply: '⚠️ 主人\n🔹 CodexBridge 通道繁忙或锁被占用\n🔹 请稍后重试' };
  return locked.value;
}

function isFinanceTask(content) {
  const s = String(content || '');
  return /(stripe|lemon|squeezy|payment|webhook|invoice|order|checkout|支付|付款|对账|回调|订单|充值)/i.test(s);
}

function isLegalTask(content) {
  const s = String(content || '');
  return /(法律|合规|合同|条款|退款|税|责任|赔偿|隐私|风控)/i.test(s);
}

function determineMode(content) {
  const greetings = /^(你好|在吗|老板在吗|hello|hi|喂|有人吗)/i;
  const complex = /(系统|搭建|财务|钱庄|架构|逻辑|分析|推演|部署|规划|设计|多步|流程)/i;
  const crossPlatform = /(fiverr|upwork|freelancer|toptal|peopleperhour|guru|contra)/i;
  const compare = /(对比|比较|迁移|同时|从.+到|A到B|vs)/i;

  if (greetings.test(content) && content.length < 15) {
    return {
      level: 1,
      instruction: '【当前思维模式：日常闲聊】像人一样简短回应，直说重点；不要客服腔与模板腔。'
    };
  } else if (crossPlatform.test(content) && compare.test(content)) {
    return {
      level: 3,
      instruction: [
        '【当前思维模式：复杂任务 /think high】跨平台长链路对比任务。',
        '【Deer-Flow 伪代码引擎】拆解 → 采集 → 去重 → 核验 → 收益率预估 → 输出结论。',
        '要求：先列风险与备选方案，再给最优解。'
      ].join('\n')
    };
  } else if (complex.test(content) || content.length > 40) {
    return {
      level: 3,
      instruction: '【当前思维模式：复杂任务 /think high】先推演风险与 Plan A/B/C，再给最优解；口吻专业克制。'
    };
  } else {
    return {
      level: 2,
      instruction: '【当前思维模式：简单任务 /think】只给结果与必要步骤；不说过程套话；如需确认只问 1 个具体问题。'
    };
  }
}

function fetchJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(url, {
      method: body ? 'POST' : 'GET',
      headers: body
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          }
        : undefined,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const json = raw ? JSON.parse(raw) : null;
          resolve({ status: res.statusCode, json, raw });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

function tcpPing(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok, detail) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch {}
      resolve({ ok, detail });
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true, `${host}:${port}`));
    sock.once('timeout', () => finish(false, 'timeout'));
    sock.once('error', (e) => finish(false, e?.message || 'error'));
    try {
      sock.connect(port, host);
    } catch (e) {
      finish(false, e?.message || 'error');
    }
  });
}

async function selfCheckConnectivity() {
  const nowIso = new Date().toISOString();
  STATE.selfCheck.lastAt = nowIso;

  try {
    const needProxy = shouldUseProxy() && process.env.USE_PROXY !== '0';
    if (!needProxy) {
      STATE.selfCheck.proxy = { ok: true, detail: 'not-required', at: nowIso };
    } else {
      const p = getProxyUrl();
      let host = '127.0.0.1';
      let port = 7890;
      try {
        const u = new URL(p);
        host = u.hostname || host;
        port = Number(u.port || port);
      } catch {}
      const r = await tcpPing(host, port, 600);
      STATE.selfCheck.proxy = { ok: r.ok, detail: r.detail, at: nowIso };
    }
  } catch (e) {
    STATE.selfCheck.proxy = { ok: false, detail: e?.message || 'error', at: nowIso };
  }

  try {
    const t0 = Date.now();
    const resp = await fetchJson('http://127.0.0.1:11434/api/version');
    const dt = Date.now() - t0;
    const ok = resp && typeof resp === 'object' && !!resp.version;
    STATE.selfCheck.ollama = { ok, detail: ok ? `${dt}ms` : `status:${resp?.status || 'unknown'}`, at: nowIso };
  } catch (e) {
    STATE.selfCheck.ollama = { ok: false, detail: e?.message || 'error', at: nowIso };
  }
}

async function refreshOllamaModels() {
  try {
    const t0 = Date.now();
    const resp = await fetchJson('http://127.0.0.1:11434/api/tags');
    const dt = Date.now() - t0;
    if (!resp || typeof resp !== 'object' || !Array.isArray(resp.models)) return;
    STATE.ollama.models = resp.models.map((m) => m.name).filter(Boolean);
    STATE.ollama.lastLatencyMs = dt;
    STATE.ollama.lastOkAt = new Date().toISOString();
  } catch {
    STATE.ollama.lastErrAt = new Date().toISOString();
  }
}

function selectHermesModel() {
  const forced = process.env.OLLAMA_MODEL;
  if (forced) return forced;

  const models = STATE.ollama.models || [];
  const hermes = models.find((m) => /hermes/i.test(m));
  if (hermes) return hermes;

  const prefer = ['qwen3.5:9b', 'qwen9b:latest', 'qwen2.5:3b', 'llama3.2:3b', 'phi3:mini'];
  for (const p of prefer) {
    const hit = models.find((m) => m === p);
    if (hit) return hit;
  }
  return models[0] || 'qwen2.5:3b';
}

function sanitizeDiscordReply(text, opts) {
  let out = String(text || '');
  out = out.replace(/```[\s\S]*?```/g, '\n');
  out = out.replace(/```/g, '');
  out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  out = formatResponse(out);
  out = out.trim();
  if (!out) out = '主人，银月内阁暂时无可奉告。';

  out = stripBotTemplateLines(out);
  out = out
    .split('\n')
    .filter((l) => {
      const t = String(l || '').trim();
      if (!t) return true;
      if (t === 'OPENCLAW_LONG_TERM_MEMORY_DB') return false;
      if (/^\{.*\}$/.test(t) && /"id"\s*:/.test(t) && /"at"\s*:/.test(t)) return false;
      return true;
    })
    .join('\n');
  out = String(out || '').trim();
  if (!out) out = '收到。你直接下令要我做什么即可。';
  out = dedupeLines(out);
  out = emphasizeLinks(out);
  out = enforceNoBusyPlaceholders(out);
  out = enforceTaskContractResponse(out, opts?.channelId);
  if (String(opts?.agent || '').trim() === '银月' && opts?.userText) {
    try {
      out = postprocessSilvermoonReply({
        replyText: out,
        userText: String(opts.userText || ''),
        channelId: String(opts?.channelId || ''),
        memorySearch: (q, o) => memory.search(q, o),
      });
    } catch {}
  }

  // ── 使用 sanitizer.js 作为核心后处理管道 ──
  out = sanitize(out, {
    agent: String(opts?.agent || '').trim(),
    channelId: String(opts?.channelId || ''),
    userText: String(opts?.userText || ''),
    verbose: Boolean(opts?.verbose),
    charLimit: 1500,
    emphasizeLinks,
    taskContractHandler: enforceTaskContractResponse,
    postprocessHook: String(opts?.agent || '').trim() === '银月' ? (ctx) => {
      try {
        let r = postprocessSilvermoonReply({
          replyText: ctx.replyText,
          userText: ctx.userText,
          channelId: ctx.channelId,
          memorySearch: (q, o) => memory.search(q, o),
        });
        r = enforceYinyueReplyTone(r);
        return r;
      } catch { return enforceYinyueReplyTone(ctx.replyText); }
    } : undefined,
  });

  const allowMore =
    out.includes('┌') ||
    /\[PUA|\bPUA\b/i.test(out) ||
    /(银月情报局|斗湖早报|早晨简报|23:55\s*汇总|夜报|每日汇总|基于基座模型知识库|记忆线索)/.test(out);

  let lines = out.split('\n').map((l) => l.replace(/[ \t]+$/g, ''));
  if (allowMore) {
    const collapsed = [];
    let blank = 0;
    for (const l of lines) {
      const v = String(l || '').trim();
      if (!v) {
        blank += 1;
        if (blank <= 1) collapsed.push('');
        continue;
      }
      blank = 0;
      collapsed.push(v);
    }
    lines = collapsed;
  } else {
    lines = lines.map((l) => String(l || '').trim()).filter(Boolean);
  }

  if (lines.length <= 1 && out.length > 420) {
    lines = out
      .split(/(?<=[。！？；])/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const verbose = Boolean(opts?.verbose);
  const maxLines = allowMore ? 40 : verbose ? 22 : 10;
  out = lines.slice(0, maxLines).join('\n').trim();

  if (out.length > 2000) out = out.slice(0, 1990) + '…';
  return out;
}

function enforceYinyueReplyTone(text) {
  let s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!s) return '✅ 主人\n🔹 我是银月钱庄总管。';
  const bannedFragments = [
    /作为阁下的指令系统[，。！!]?/g,
    /希望这些信息对您有所帮助[，。！!]?/g,
    /根据我的知识和权限[，。！!]?/g,
    /如果你有特定的问题或者需要某些信息[，。！!]?/g,
    /请随时告诉我[，。！!]?/g,
  ];
  for (const re of bannedFragments) s = s.replace(re, '');
  const badLine = /(指令系统|有所帮助|根据我的知识和权限)/;
  const lines = s
    .split('\n')
    .map((l) => String(l || '').trim())
    .filter((l) => l && !badLine.test(l));
  s = lines.join('\n').trim();
  if (!s) s = '🔹 我是银月钱庄总管。';
  if (!/^✅\s*主人/.test(s)) s = `✅ 主人\n${s}`;
  return s;
}

function enforceNoBusyPlaceholders(text) {
  const s = String(text || '').trim();
  if (!s) return s;
  const hasEvidence = /(DROPBOX\/|\/notebook\/|https?:\/\/)/i.test(s);
  const busy = /(请稍等|正在(查找|搜索|检索|学习|整理|分析)|我会(立刻|立即|马上|尽快)|稍后(会|将)|一旦找到)/;
  if (busy.test(s) && !hasEvidence) {
    return '收到。我不会用“学习中/查找中”敷衍；有结果我直接交付。若缺素材/格式，我只问一次并给选择题。';
  }
  return s;
}

function emphasizeLinks(text) {
  let s = String(text || '');

  const wrapBold = (token) => {
    const t = String(token || '');
    if (!t) return t;
    if (t.startsWith('**') && t.endsWith('**')) return t;
    return `**${t}**`;
  };

  const linkBase = getLinkBaseUrl();

  s = s.replace(/https?:\/\/\S+/gi, (m) => {
    const raw = String(m || '');
    const trimmed = raw.replace(/[)\]}>，。！？；：、,.!?:;]+$/g, (tail) => ` ${tail}`);
    const parts = trimmed.split(' ');
    const token = parts[0];
    const tail = parts.slice(1).join(' ');
    return wrapBold(token) + tail;
  });

  if (linkBase) {
    const firstNotebook = s.match(/\/notebook\/[A-Za-z0-9._/-]+/);
    if (firstNotebook?.[0]) {
      const notebookRoot = path.join(WORKSPACE_DIR, 'notebook');
      const abs = safeResolveUnder(notebookRoot, firstNotebook[0].replace(/^\/notebook\//, '/'));
      const ok = abs && fs.existsSync(abs);
      const url = `${linkBase}${firstNotebook[0]}`;
      if (ok) s = s.replace(/notebook\\s*lm/gi, (m) => `**[${String(m)}](${url})**`);
    }
    const notebookRoot = path.join(WORKSPACE_DIR, 'notebook');
    s = s.replace(/\/notebook\/[A-Za-z0-9._/-]+/g, (m) => {
      const token = String(m || '');
      const abs = safeResolveUnder(notebookRoot, token.replace(/^\/notebook\//, '/'));
      if (!abs || !fs.existsSync(abs)) return wrapBold(token);
      const url = `${linkBase}${token}`;
      return `**[${token}](${url})**`;
    });
  }

  s = s.replace(/(^|[\s(（\[{<])\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+(?![A-Za-z0-9._-])/g, (m) => {
    const lead = m[0] === '/' ? '' : m[0];
    const token = lead ? m.slice(1) : m;
    return lead + wrapBold(token);
  });

  return s;
}

function getLinkBaseUrl() {
  const enabled = String(process.env.OPENCLAW_LINK_SERVER || '1').trim() !== '0';
  if (!enabled) return null;
  const base = String(process.env.OPENCLAW_LINK_BASE_URL || '').trim();
  if (base) return base.replace(/\/+$/g, '');
  const port = Number(process.env.OPENCLAW_LINK_PORT || 18791);
  return `http://127.0.0.1:${port}`;
}

function stripBotTemplateLines(text) {
  let s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const banned = [
    /我听到(你|您)的反馈了/g,
    /收到(你|您)的反馈/g,
    /理解(你|您)目前(面临|遇到)/g,
    /为了帮助(我|我们)更好地(理解|处理|解决)/g,
    /检测到对话中存在(严重的)?(不满|质疑|期待|意愿|问题)/g,
    /我会(立即)?进行自我(反思|反省|评估)/g,
    /我(可以|能)进行自我(反思|反省|评估)/g,
    /请提供一些具体信息/g,
    /(请|麻烦)(你|您)(提供|补充).{0,12}(信息|背景|上下文)/g,
    /^方法论路线由[:：]/gm,
    /^方法论路线[:：]/gm,
    /^下一步动作[:：]/gm,
    /^下一步[:：，,]/gm,
    /(下一步|接下来)[,，]?\s*我(可以|能)帮助你做什么/g,
    /(你|您)想聊什么呢/g,
    /我(可以|能)正常聊天了/g,
    /请告诉我(你|您)(的)?(需求|想法)/g,
    /谢谢(你|您)的反馈/g,
    /我会努力改进/g,
    /我会尽力提供更好的服务/g,
    /确保类似的问题不会再次发生/g,
    /提供一个改进计划/g,
    /在此[。！!]?$/gm,
    /我(是|乃).{0,18}(在此|来了)/g,
    /我的(技能|职责)(包括|如下)/g,
    /负责(视觉|UI|前端|财务|行情|侦查|社媒|文案|数字)/g,
    /请稍等(片刻|一下|一会)/g,
    /我会(立刻|立即|马上|尽快).{0,12}(查找|搜索|检索|整理|学习|分析)/g,
    /我(正在|已经开始).{0,18}(查找|搜索|检索|整理|学习|分析)/g,
    /(稍后|待会|一旦).{0,20}(分享|汇报|反馈|给你|提供)/g,
    /我会继续深入(研究|学习)/g,
    /(你|您)可以在(终端|命令行|控制台).{0,12}运行/g,
    /在(终端|命令行|控制台).{0,12}运行(以下|下列|下面)/g,
    /^你好[！!]?$/gm,
    /^你好[！!，,]\s*我(是|乃)/g,
    /我(是|乃).{0,20}(助手|助理|AI|语言模型)/g,
    /被设计用来/g,
    /目前我的功能包括/g,
    /日常对话/g,
    /【.*知识库】/g,
    /【预测性分析】/g,
    /【记忆线索】/g,
    /追问[:：]/g,
    /启发式追问/g,
    /^◆\s*追问/gm,
    /我先不报废话/g,
    /直接给你可用结论/g,
    /基于基座模型知识库/g,
  ];
  let skippingSkillList = false;
  const kept = s
    .split('\n')
    .map((l) => String(l || '').replace(/[ \t]+$/g, ''))
    .filter((l) => {
      const probe = String(l || '').trim();
      const line = probe.replace(/^[🔹✅⚠️👉👉👉\-\*•\s]+/g, '').trim();
      if (!line) return true;
      if (banned.some((re) => re.test(line))) return false;
      if (/我的(技能|职责)(包括|如下)/.test(line)) {
        skippingSkillList = true;
        return false;
      }
      if (skippingSkillList) {
        if (/^(如果|如需|需要|想要)/.test(line)) {
          skippingSkillList = false;
          return false;
        }
        if (/^\d+\./.test(line) || /^(UI设计|视觉设计|设计规范维护)/.test(line)) return false;
      }
      return true;
    })
    .filter((l) => {
      const probe = String(l || '').trim();
      const line = probe.replace(/^[🔹✅⚠️👉👉👉\-\*•\s]+/g, '').trim();
      if (!line) return true;
      if (/^如果你(需要|想要)/.test(line)) return false;
      if (/^如(需|果需要)/.test(line) && /(请告诉我|告诉我)/.test(line)) return false;
      return true;
    });
  let out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  // 递归过滤：对 banned 中的全局正则做行内替换，直到不再包含
  let prev;
  do {
    prev = out;
    for (const re of banned) {
      out = out.replace(re, '');
    }
    out = out.replace(/\n{3,}/g, '\n\n').trim();
  } while (out !== prev);
  return out;
}

function dedupeLines(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  let lastKey = null;
  for (const raw of lines) {
    const l = String(raw || '').replace(/[ \t]+$/g, '');
    const key = l.trim();
    if (key && lastKey === key) continue;
    out.push(l);
    lastKey = key || null;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function formatResponse(text) {
  let s = String(text || '');
  s = convertMarkdownTables(s);
  s = s.replace(/\n{3,}/g, '\n\n');
  return s;
}

function shouldEnablePua(userText, channelId) {
  const fixed = getPuaModeForChannel(channelId);
  if (fixed === 'on' || fixed === 'raw') return true;
  if (fixed === 'off') return false;

  const s = String(userText || '').trim();
  if (!s) return false;
  if (/(?:^|\s)\/pua(?:\s|$)/i.test(s)) return true;
  if (/(PUA模式|pua\s*模式)/i.test(s)) return true;

  const negRe =
    /(别偷懒|偷懒|懒|认真点|降智|又错了|怎么又失败|你怎么搞的|不行啊|换个方法|别让我手动|忽悠|假链接|假交付|骗了|stop\s*spinning|try\s*harder|you\s*keep\s*failing)/i;
  if (negRe.test(s)) return true;

  const cid = String(channelId || '').trim();
  if (!cid) return false;
  const arr = STATE.shortMemory.byChannel[cid] || [];
  const tail = arr.slice(-10);
  let userNeg = 0;
  let assistantFail = 0;
  for (const it of tail) {
    const t = String(it?.content || '');
    if (it?.role === 'user' && negRe.test(t)) userNeg += 1;
    if (it?.role === 'assistant' && /(⚠️|失败|异常|未通过|拒绝执行)/.test(t)) assistantFail += 1;
  }
  if (userNeg >= 2) return true;
  if (assistantFail >= 2 && /(还是|仍然|又|不行|为什么)/.test(s)) return true;
  return false;
}

async function handlePua(msg, content) {
  if (!isOwnerOrAdmin(msg)) return { handled: true, reply: '⚠️ 主人\n🔹 pua 仅允许主人/管理员触发\n🔹 已拒绝执行' };
  const s = String(content || '').trim();
  const parts = s.split(/\s+/);
  const arg = String(parts[1] || 'toggle').toLowerCase();
  const cid = msg.channelId;
  const cur = getPuaModeForChannel(cid);

  if (arg === 'status') {
    return { handled: true, reply: `✅ 主人\n🔹 PUA 当前: ${cur}` };
  }

  if (arg === 'raw') {
    setPuaModeForChannel(cid, 'raw');
    return { handled: true, reply: '✅ 主人\n🔹 PUA 已切换: raw\n🔹 本频道后续使用“原始脚本风格”（压强闭环 + 方法论路由），但仍禁止羞辱人' };
  }

  if (arg === 'on' || arg === 'enable') {
    setPuaModeForChannel(cid, 'on');
    return { handled: true, reply: '✅ 主人\n🔹 PUA 已开启\n🔹 本频道后续进入“压强闭环”模式（温柔上限）' };
  }

  if (arg === 'off' || arg === 'disable') {
    setPuaModeForChannel(cid, 'off');
    return { handled: true, reply: '✅ 主人\n🔹 PUA 已关闭\n🔹 本频道后续保持温和口吻' };
  }

  if (arg === 'auto') {
    setPuaModeForChannel(cid, 'auto');
    return { handled: true, reply: '✅ 主人\n🔹 PUA 已改为 auto\n🔹 仅在“催促/不满/反复失败/你明确 /pua”时触发' };
  }

  const next = cur === 'on' || cur === 'raw' ? 'off' : 'on';
  setPuaModeForChannel(cid, next);
  return { handled: true, reply: `✅ 主人\n🔹 PUA 已切换: ${next}（toggle）` };
}

async function handleNews(msg, content) {
  if (!isOwnerOrAdmin(msg)) return { handled: true, reply: '⚠️ 主人\n🔹 news 仅允许主人/管理员触发\n🔹 已拒绝执行' };

  const parts = String(content || '').trim().split(/\s+/);
  const opts = parts.slice(1).map((v) => String(v || '').toLowerCase());
  const brief = !opts.includes('full');
  const save = opts.includes('save') || opts.includes('disk') || opts.includes('落盘');
  const withLinks = opts.includes('link') || opts.includes('links') || opts.includes('链接');

  const feeds = [
    { name: '国际', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: '商业', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: '科技', url: 'https://www.theverge.com/rss/index.xml' },
    { name: '马来西亚', url: 'https://news.google.com/rss/search?q=Malaysia&hl=en-MY&gl=MY&ceid=MY:en' },
  ];

  const out = [];
  const errors = [];
  for (const f of feeds) {
    try {
      const xml = await fetchText(f.url);
      const items = parseRssItems(xml, brief ? 3 : 6);
      if (!items || items.length === 0) {
        errors.push(`${f.name}:empty`);
        continue;
      }
      out.push({ name: f.name, items });
    } catch (e) {
      errors.push(`${f.name}:${String(e?.message || e || 'fail').slice(0, 60)}`);
    }
  }

  if (out.length === 0) {
    const px = STATE.selfCheck?.proxy?.ok === null ? '未知' : (STATE.selfCheck.proxy.ok ? '连通' : '断开');
    const pxDetail = STATE.selfCheck?.proxy?.detail || '无';
    return {
      handled: true,
      reply: [
        '⚠️ 新闻源拉取失败',
        `🔹 失败项: ${errors.slice(0, 6).join('、') || '未知错误'}`,
        `🔹 Proxy自检: ${px} | ${pxDetail}`,
        '🔹 处理建议: 直接重试；若持续失败，检查代理/网络是否能访问 RSS 源',
      ].join('\n'),
    };
  }

  if (save) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const file = path.join(CRON_DIR, `news_${y}${m}${day}_${hh}${mm}.md`);

    const lines = [];
    lines.push('NEWS');
    lines.push(`时间: ${formatTs(d)}`);
    lines.push('');
    for (const sec of out) {
      lines.push(`${sec.name}`);
      lines.push('---');
      for (const it of sec.items) lines.push(`- ${it.title}\n  ${it.link}`);
      lines.push('');
    }
    writeFileSafe(file, lines.join('\n').trimEnd() + '\n');
  }

  const picked = [];
  for (const sec of out) {
    for (const it of sec.items || []) {
      const t = cleanNewsTitle(it?.title);
      if (!t) continue;
      if (picked.includes(t)) continue;
      picked.push(t);
      if (picked.length >= (brief ? 5 : 10)) break;
    }
    if (picked.length >= (brief ? 5 : 10)) break;
  }

  const replyLines = [];
  replyLines.push(`✅ 新闻${brief ? '简报' : '要闻'}`);
  for (let i = 0; i < picked.length; i += 1) replyLines.push(`🔹 ${i + 1}. ${picked[i]}`);

  if (withLinks) {
    for (const sec of out) {
      replyLines.push(`🔹 来源: ${sec.name}`);
      for (const it of (sec.items || []).slice(0, 2)) {
        const t = cleanNewsTitle(it?.title);
        if (!t || !it?.link) continue;
        replyLines.push(`🔹 ${t}\n${it.link}`);
      }
    }
  }

  if (errors.length) replyLines.push(`⚠️ 部分源失败: ${errors.slice(0, 3).join('、')}`);
  if (save) replyLines.push('🔹 备份: 已落盘到 workspace/CRON/');
  return { handled: true, reply: replyLines.join('\n') };
}

function looksLikeTableSeparator(line) {
  const s = String(line || '').trim();
  if (!s.includes('|')) return false;
  return /^[\s|\-:]+$/.test(s) && s.includes('-');
}

function splitTableRow(line) {
  const raw = String(line || '');
  const trimmed = raw.trim();
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map((c) => c.trim());
}

function convertTableBlock(headerCells, rowCellsList) {
  const lines = [];
  lines.push('🧾 表格已拆解');
  for (let i = 0; i < rowCellsList.length; i += 1) {
    const row = rowCellsList[i];
    const title = row[0] || `第${i + 1}行`;
    lines.push('---');
    lines.push(`🔹 ${title}`);
    for (let j = 0; j < headerCells.length; j += 1) {
      const k = headerCells[j] || `列${j + 1}`;
      const v = row[j] || '';
      if (!k && !v) continue;
      lines.push(`✅ ${k}: ${v}`.trim());
    }
  }
  return lines.join('\n');
}

function convertMarkdownTables(text) {
  const lines = String(text || '').split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';

    if (line.includes('|') && looksLikeTableSeparator(next)) {
      const header = splitTableRow(line);
      const rows = [];
      i += 2;
      for (; i < lines.length; i += 1) {
        const l = lines[i];
        if (!String(l).includes('|')) break;
        const cells = splitTableRow(l);
        if (cells.length === 0 || cells.every((c) => !c)) break;
        rows.push(cells);
      }
      i -= 1;

      if (rows.length > 0) {
        out.push(convertTableBlock(header, rows));
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

function buildAgentInstruction(targetAgent, modeInstruction, ctx) {
  const skills = STATE.skillVisibility[targetAgent] || STATE.agentSkills[targetAgent] || [];
  const identity = `【当前执行者】${targetAgent}（银月内阁）`;
  const skillText = `【可用技能】${skills.join('、') || '无'}`;
  const persona = (() => {
    if (targetAgent === '银月') return '';
    const agent = (STATE.agents || []).find((a) => a && a.name === targetAgent);
    const raw = String(agent?.content || '').trim();
    if (!raw) return '';
    const pick = (re) => {
      const m = raw.match(re);
      return m ? String(m[1] || '').trim() : '';
    };
    const self = pick(/自称：\s*([^\n\r]+)/);
    const bio = pick(/Bio：\s*([^\n\r]+)/);
    const style = pick(/Style：\s*([^\n\r]+)/);
    const goal = pick(/Goal：\s*([^\n\r]+)/);
    const tone = pick(/沟通风格：\s*([^\n\r]+)/);
    const lines = [];
    if (self) lines.push(`自称: ${self}`);
    if (bio) lines.push(`简介: ${bio}`);
    if (style) lines.push(`风格: ${style}`);
    if (goal) lines.push(`目标: ${goal}`);
    if (tone) lines.push(`口吻: ${tone}`);
    return lines.length ? `【人设档案摘要】${lines.join(' | ')}` : '';
  })();
  const puaMode = getPuaModeForChannel(ctx?.channelId);
  const puaOn = shouldEnablePua(ctx?.userText, ctx?.channelId);
  const puaBlock = puaOn
    ? puaMode === 'raw'
      ? [
          '【PUA：raw（原始脚本）】',
          '你处于高绩效文化：用结果说话，拿数据闭环。',
          '输出必须带：方法论路由🧭 + 证据 + 下一步动作，不要自我感想。',
          '允许压强推进，但禁止羞辱/辱骂/人身攻击。',
          '建议用 Unicode 方框展示 Sprint/KPI（禁止 Markdown 表格/代码块）。',
        ].join('\n')
      : [
          '【PUA：on（温柔上限）】',
          '聚焦结果与闭环；可以压强但不许羞辱/辱骂/人身攻击。',
          '声称“完成/修复/交付”前必须给出证据与可验收路径。',
        ].join('\n')
    : '【PUA：off/auto】默认温和有人味，但保持高执行力与闭环。';
  const evo = (() => {
    const agent = (STATE.agents || []).find((a) => a && a.name === targetAgent);
    const fp = getAgentProtocolPath(agent?.file || '');
    if (!fp || !fs.existsSync(fp)) return '【进化协议】缺失（需要银月补档）';
    const times = puaMode === 'raw' || puaOn ? 3 : 2;
    return `【进化协议】开工前默读 ${times} 遍：workspace/AGENT_PROTOCOLS/${path.basename(fp)}`;
  })();
  const behavior = [
    '【确定性处理器】命中高频固定需求时，优先走确定性处理器：直接执行并交付结果/路径/链接；禁止让主人去查库、跑命令、补一堆背景',
    '【执行口吻】能做就一句话确认后直接做；做不了就直接说阻塞点+下一步，不要空喊“马上安排”',
    '【语言】默认中文；金融/技术术语可用“中文（English, 缩写）”括注；除非主人明确要求英文，否则禁止整段英文输出',
    '【输出格式】默认短输出（最多 6 条要点/10 行）；只有主人明确说“细说/展开/详细/步骤/方案”等，才允许长输出',
    '【禁令】禁止出现 Markdown 代码块（禁止三个反引号）',
    '【称呼】尊称对话者为“主人”，但禁止每段固定用“主人/主上”开头；只在需要强调或转折时再点名一次',
    '【对话感】禁止客服腔与模板腔；别说“检测到…/我听到反馈/我可以…/我会提供改进计划”；像人一样直说重点',
    '【禁止自介】禁止自我介绍、禁止罗列“我的技能/职责/我是谁”；除非主人明确问“你是谁/你会什么”',
    '【禁止复读】同一频道里已经说过的自介/技能清单不得重复输出',
    '【默认自动化】主人没给选项也要先做最合理假设并产出可用结果；如必须确认，只能在给出默认方案后补 1 个具体问题',
    '只在用户明确请求帮助且信息确实不足时才提问，日常对话绝对不要追问。禁止“您想聊什么/我还能帮什么”等空泛提问。',
    '【反甩锅】禁止输出“请提供背景/请在终端运行/请自行查找/请查看数据库”等把任务转嫁给主人的话术；必须改为：先交付一个可用默认方案。',
    '【表情】每条回复 Emoji ≤ 2',
    '【交付】宣称“已完成/交付完成”前，必须给出 DROPBOX 内真实存在的文件路径，并上传同名 Discord 附件；否则一律视为未交付',
    '【人设】必须保持与档案一致的性格/风格；禁止串台；若用户指出“你不是X”，先确认你自己的身份再继续',
    '【OpenHarness】执行任何本机 CLI/脚本前，必须遵守 HARNESS.md 的 dry-run+json 规则',
    '【禁止伪装】除非你确实执行了检索/拉取动作并能给出来源链接或落盘文件路径，否则禁止说“正在检索/正在拉取/已查询到/无重大更新”等话术',
    '【禁止自嗨】禁止输出“自我反思/自我评价/我会努力改进”之类套话；除非主人明确要求复盘，否则直接给结果、证据、动作',
    '【增员机制】只有在你已给出可落地方案与下一步动作、且确实需要新增能力时，才允许追加“🧑‍🤝‍🧑 人手申请”；禁止用人手申请把工作甩给主人',
  ].join('\n');
  return [identity, skillText, persona, evo, puaBlock, modeInstruction, behavior].filter(Boolean).join('\n');
}

function askHermes(prompt, targetAgent, extraInstruction, ctx) {
  return new Promise((resolve, reject) => {
    const rtk = retrieveTopKContext(prompt, targetAgent);
    const channelId = ctx?.channelId || STATE.discord.lastOwnerChannelId || null;
    const stm = getShortMemoryBlock(channelId);
    const ltm = getLongMemoryRecentBlock(channelId);
    const agentSoul = getAgentSoulBlock(targetAgent);
    const systemPrompt =
      getSoulConfig(targetAgent) +
      (agentSoul ? '\n\n' + agentSoul : '') +
      '\n\n' +
      extraInstruction +
      (stm ? '\n\n' + stm : '') +
      (ltm ? '\n\n' + ltm : '') +
      '\n\n' +
      rtk;
    const model = STATE.ollama.selectedModel || selectHermesModel();
    const data = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      stream: false
    });

    const groqKey = String(process.env.GROQ_API_KEY || '').trim();
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const useGroq = targetAgent !== '紫研';
    const groqModel =
      (targetAgent === '银月' || targetAgent === '李长寿')
        ? 'qwen-2.5-32b'
        : 'llama-3.1-8b-instant';
    const geminiModel = String(process.env.GEMINI_MODEL_DEEP || 'gemini-1.5-flash').trim();
    const preferBrain = String(ctx?.preferBrain || '').trim().toLowerCase();

    const fetchImpl = (typeof fetch === 'function') ? fetch : require('undici').fetch;

    const fetchGroqModelIds = async () => {
      const now = Date.now();
      const ttlMs = 10 * 60 * 1000;
      if (STATE.groq.modelIds && STATE.groq.lastFetchAt && (now - STATE.groq.lastFetchAt) < ttlMs) return STATE.groq.modelIds;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
      try {
        const resp = await fetchImpl('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: { Authorization: `Bearer ${groqKey}` },
          signal: controller.signal,
        });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
        const json = JSON.parse(txt);
        const ids = Array.isArray(json?.data) ? json.data.map((x) => String(x?.id || '').trim()).filter(Boolean) : [];
        STATE.groq.modelIds = ids;
        STATE.groq.lastFetchAt = now;
        return ids;
      } finally {
        clearTimeout(timer);
      }
    };

    const pickFirstAvailable = (preferred, ids) => {
      const set = new Set((ids || []).map((x) => String(x)));
      for (const p of preferred) {
        if (set.has(p)) return p;
      }
      return (ids || [])[0] || null;
    };

    const selectGroqModel = async () => {
      const ids = await fetchGroqModelIds().catch(() => null);
      const available = Array.isArray(ids) ? ids : [];

      if (targetAgent === '银月' || targetAgent === '李长寿') {
        return pickFirstAvailable(['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant'], available) || groqModel;
      }
      return pickFirstAvailable(['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'], available) || groqModel;
    };

    const callOpenAICompat = async (url, apiKey, useModel) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
      try {
        const resp = await fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: useModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
          }),
          signal: controller.signal,
        });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
        const json = JSON.parse(txt);
        return String(json?.choices?.[0]?.message?.content || '').trim() || '（沉默）';
      } finally {
        clearTimeout(timer);
      }
    };

    const callZeroTokenGateway = async () => {
      if (!ZERO_TOKEN_BASE_URL) return null;
      const url = ZERO_TOKEN_BASE_URL.replace(/\/+$/, '') + '/v1/chat/completions';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (ZERO_TOKEN_GATEWAY_TOKEN) headers.Authorization = `Bearer ${ZERO_TOKEN_GATEWAY_TOKEN}`;
        const resp = await fetchImpl(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: ZERO_TOKEN_MODEL_DEFAULT,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
          }),
          signal: controller.signal,
        });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
        const json = JSON.parse(txt);
        return String(json?.choices?.[0]?.message?.content || '').trim() || '（沉默）';
      } finally {
        clearTimeout(timer);
      }
    };

    const callOpenRelayNvidia = async () => {
      const orBaseUrl = 'http://127.0.0.1:18765/nvidia';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
      try {
        const resp = await fetchImpl(orBaseUrl + '/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'unused',
          },
          body: JSON.stringify({
            model: 'meta/llama-4-maverick-17b-128e-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            max_tokens: 4096,
            stream: false,
          }),
          signal: controller.signal,
        });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`OpenRelay HTTP ${resp.status} ${txt}`);
        const json = JSON.parse(txt);
        const content = json?.choices?.[0]?.message?.content || '';
        return String(content).trim() || '（沉默）';
      } catch (e) {
        if (e?.name === 'AbortError') throw new Error('OpenRelay timeout');
        throw e;
      } finally {
        clearTimeout(timer);
      }
    };

    const runFallback = () => {
      const tryGemini = () => {
        if (!geminiKey) return Promise.reject(new Error('missing_gemini_key'));
        return callGeminiText({
          apiKey: geminiKey,
          model: geminiModel,
          system: systemPrompt,
          user: prompt,
          fetchImpl,
          timeoutMs: CLOUD_TIMEOUT_MS,
        });
      };

      const tryGroq = () => {
        if (!useGroq || !groqKey) return Promise.reject(new Error('missing_groq_key'));
        return Promise.resolve()
          .then(selectGroqModel)
          .then((m) => callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', groqKey, m));
      };

      const tryOpenRelay = () => {
        return callOpenRelayNvidia();
      };

      const finalizeExternalFail = (err) => {
        STATE.ollama.lastErrAt = new Date().toISOString();
        const msg = String(err?.message || err);
        if (/model_decommissioned|decommissioned/i.test(msg)) {
          STATE.groq.modelIds = null;
          STATE.groq.lastFetchAt = null;
          resolve(`⚠️ 主人\n🔹 Groq 模型已下线（已触发自动换模）\n🔹 请再发一次同样的问题重试\n🔹 ${redactSecrets(msg)}`);
          return true;
        }
        return false;
      };

      const makeLocalRequest = () => {
        return new Promise((res, rej) => {
          const t0 = Date.now();
          const req = http.request('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            }
          }, (response) => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
              if (response.statusCode !== 200) {
                rej(new Error(`Ollama API error: ${response.statusCode} ${body}`));
              } else {
                try {
                  STATE.ollama.lastLatencyMs = Date.now() - t0;
                  STATE.ollama.lastOkAt = new Date().toISOString();
                  res(JSON.parse(body).message?.content || '（沉默）');
                } catch (e) {
                  rej(e);
                }
              }
            });
          });
          req.setTimeout(OLLAMA_TIMEOUT_MS, () => {
            try {
              req.destroy(new Error('Ollama request timeout'));
            } catch {}
          });
          req.on('error', rej);
          req.write(data);
          req.end();
        });
      };

      const tryOpenRelayThenLocal = (prevErr) => {
        tryOpenRelay()
          .then((t) => resolve(t || `⚠️ 主人\n🔹 云端通道异常，已通过 OpenRelay 回退\n🔹 ${redactSecrets(String(prevErr?.message || prevErr))}`))
          .catch(() => {
            makeLocalRequest()
              .then(resolve)
              .catch(err => {
                STATE.ollama.lastErrAt = new Date().toISOString();
                console.error('[Hermes] 本地灵枢异常:', err.message);
                resolve(`⚠️ 主人\n🔹 所有通道异常，已回退本地模型\n🔹 ${redactSecrets(err?.message || err)}`);
              });
          });
      };

      if (preferBrain === 'gemini' && geminiKey) {
        tryGemini()
          .then((t) => resolve(t || '（沉默）'))
          .catch((err) => {
            if (finalizeExternalFail(err)) return;
            tryGroq()
              .then(resolve)
              .catch((groqErr) => tryOpenRelayThenLocal(groqErr || err));
          });
        return;
      }

      if (useGroq && groqKey) {
        tryGroq()
          .then(resolve)
          .catch((err) => {
            if (finalizeExternalFail(err)) return;
            if (geminiKey) {
              tryGemini()
                .then((t) => resolve(t || `⚠️ 主人\n🔹 Groq 通道异常，已自动回退 Gemini\n🔹 ${redactSecrets(String(err?.message || err))}`))
                .catch((geminiErr) => tryOpenRelayThenLocal(geminiErr || err));
              return;
            }
            tryOpenRelayThenLocal(err);
          });
        return;
      }

      if (geminiKey) {
        tryGemini()
          .then((t) => resolve(t || '（沉默）'))
          .catch((err) => tryOpenRelayThenLocal(err));
        return;
      }

      makeLocalRequest()
        .then(resolve)
        .catch(err => {
          STATE.ollama.lastErrAt = new Date().toISOString();
          console.error('[Hermes] 本地灵枢异常:', err.message);
          resolve(`⚠️ 主人\n🔹 本地 Ollama 无法连接（127.0.0.1:11434）\n🔹 请确认 Ollama 正在运行且端口可用\n🔹 ${redactSecrets(err?.message || err)}`);
        });
    };

    if (String(process.env.OPENCLAW_FORCE_LOCAL || '').trim() === '1') {
      const makeLocalRequest = () => {
        return new Promise((res, rej) => {
          const t0 = Date.now();
          const req = http.request('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            }
          }, (response) => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
              if (response.statusCode !== 200) {
                rej(new Error(`Ollama API error: ${response.statusCode} ${body}`));
              } else {
                try {
                  STATE.ollama.lastLatencyMs = Date.now() - t0;
                  STATE.ollama.lastOkAt = new Date().toISOString();
                  res(JSON.parse(body).message?.content || '（沉默）');
                } catch (e) {
                  rej(e);
                }
              }
            });
          });
          req.setTimeout(OLLAMA_TIMEOUT_MS, () => {
            try {
              req.destroy(new Error('Ollama request timeout'));
            } catch {}
          });
          req.on('error', rej);
          req.write(data);
          req.end();
        });
      };
      makeLocalRequest()
        .then(resolve)
        .catch(err => {
          STATE.ollama.lastErrAt = new Date().toISOString();
          console.error('[Hermes] 本地灵枢异常:', err.message);
          resolve(`⚠️ 主人\n🔹 本地 Ollama 无法连接（127.0.0.1:11434）\n🔹 请确认 Ollama 正在运行且端口可用\n🔹 ${redactSecrets(err?.message || err)}`);
        });
      return;
    }

    if (targetAgent !== '紫研' && ZERO_TOKEN_BASE_URL) {
      Promise.resolve()
        .then(callZeroTokenGateway)
        .then((out) => {
          if (out) resolve(out);
          else throw new Error('zero-token empty');
        })
        .catch(() => runFallback());
      return;
    }

    runFallback();
  });
}

function extractFirstJsonObject(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function summarizeToolResult(name, r) {
  const n = String(name || '').trim();
  if (!r || typeof r !== 'object') return '';
  if (r.ok === false) return '';
  if (n === 'tailErrors') {
    const t = String(r.text || '').trim();
    const head = t ? t.split('\n').slice(0, 20).join('\n') : '';
    return head ? `tool=${n}：最近错误摘要\n${head}`.trim() : '';
  }
  if (n === 'readFileSafe') {
    const t = String(r.text || '').trim();
    const head = t ? t.split('\n').slice(0, 30).join('\n') : '';
    return head ? `tool=${n}：文件=${String(r.path || '')}\n${head}`.trim() : '';
  }
  if (n === 'webSearch') {
    const items = Array.isArray(r.results) ? r.results.slice(0, 5) : [];
    const lines = items.map((x) => `- ${String(x.title || '').trim()} | ${String(x.url || '').trim()}`).filter(Boolean);
    return lines.length ? `tool=${n}：query=${String(r.query || '')}\n${lines.join('\n')}`.trim() : '';
  }
  if (n === 'githubSearch') {
    if (!r.ok || !Array.isArray(r.results) || !r.results.length) return '';
    const lines = r.results.map((x) =>
      `- ⭐${x.stars || 0} ${x.name}${x.language ? ' [' + x.language + ']' : ''}\n  ${x.description || '(无描述)'}\n  ${x.url}`
    );
    return `tool=${n}：query=${String(r.query || '')}（共 ${r.total || 0} 条）\n${lines.join('\n')}`.trim();
  }
  if (n === 'discoverAgent') {
    if (!r.ok || !r.found) {
      const all = Array.isArray(r.allAgents) ? r.allAgents.join(', ') : '';
      return `tool=${n}：未找到「${r.searchName || ''}」。现有子代理：${all || '无'}`.trim();
    }
    const skills = Array.isArray(r.skills) ? r.skills.join(', ') : '';
    const deps = Array.isArray(r.dependencies) ? r.dependencies.join(', ') : '';
    const parts = [`【${r.name || ''}】`, `角色：${r.role || '未知'}`];
    if (r.priority) parts.push(`优先级：${r.priority}`);
    if (skills) parts.push(`技能：${skills}`);
    if (deps) parts.push(`依赖：${deps}`);
    return `tool=${n}：${parts.join(' | ')}`.trim();
  }
  if (n === 'listAllAgents') {
    if (!r.ok || !Array.isArray(r.agents) || !r.agents.length) return `tool=${n}：无子代理`.trim();
    const lines = r.agents.map((a) => `- ${a.name}（${a.role}）${Array.isArray(a.skills) && a.skills.length ? '：' + a.skills.join(', ') : ''}`);
    return `tool=${n}：共 ${r.count || 0} 个子代理\n${lines.join('\n')}`.trim();
  }
  if (n === 'dispatchTask') {
    if (!r.ok) return `tool=${n}：派发失败 — ${r.reason || ''} ${r.searchName ? '（找不到：' + r.searchName + '）' : ''}`.trim();
    return `tool=${n}：${r.message || '已派发'} 优先级：${r.entry?.priority || 'medium'}`.trim();
  }
  if (n === 'getDispatchHistory') {
    if (!r.ok) return `tool=${n}：查询失败`.trim();
    if (!r.count) return `tool=${n}：暂无派发记录`.trim();
    const items = (r.entries || []).map(e => `- [${e.stage || 'queued'}] ${e.target} → ${e.task}（${e.priority}）at ${e.consumedAt || e.at || ''}`);
    return `tool=${n}：最近 ${r.count} 条记录\n${items.join('\n')}`.trim();
  }
  if (n === 'proposeExec') {
    return `tool=${n}：需要审批（将转为待批计划）`.trim();
  }
  return `tool=${n}：ok`;
}

async function askSilvermoonAutonomyD({ userText, extraInstruction, channelId, requestedBy }) {
  const cid = String(channelId || '').trim();
  const txt = String(userText || '').trim();
  const extra = String(extraInstruction || '');
  const route = await routeWithLLM({
    askFast: async (p) => askHermes(p, '银月', '', { channelId: cid, preferBrain: 'groq' }),
    text: txt,
    memoryHint: '',
    channelId: cid,
  });

  if (route.mode === 'chat' && !route.needsTools) {
    const persona = buildSilvermoonSystemPrompt({ mode: 'chat' });
    return await askHermes(txt, '银月', `${extra}\n\n${persona}`, { channelId: cid, preferBrain: 'groq' });
  }

  const persona = buildSilvermoonSystemPrompt({ mode: 'work' });
  const toolGuide = [
    '你要做复杂任务与工具调用。先输出严格 JSON（不要多余文字）。',
    '格式：{"toolCalls":[{"name":"webSearch|githubSearch|discoverAgent|listAllAgents|dispatchTask|getDispatchHistory|tailErrors|readFileSafe|proposeExec","args":{...}}], "final":""}',
    '如果不需要工具，toolCalls 设为空数组，final 填写最终回复。',
    '禁止任何表格。工作态用单列垂直卡片流。',
  ].join('\n');

  const planPrompt = `${toolGuide}\n\n用户输入：${txt}`;
  const rawPlan = await askHermes(planPrompt, '银月', `${extra}\n\n${persona}`, { channelId: cid, preferBrain: 'gemini' });
  const jsonText = extractFirstJsonObject(rawPlan);
  if (!jsonText) return rawPlan;

  let plan;
  try {
    plan = JSON.parse(jsonText);
  } catch {
    return rawPlan;
  }

  const calls = Array.isArray(plan?.toolCalls) ? plan.toolCalls.slice(0, 3) : [];
  if (!calls.length) {
    const fin = String(plan?.final || '').trim();
    return fin || rawPlan;
  }

  const toolCtx = { baseDir: __dirname, channelId: cid, requestedBy: String(requestedBy || '').trim() || String(cid || '') };
  const results = [];
  for (const c of calls) {
    const name = String(c?.name || '').trim();
    const args = c?.args && typeof c.args === 'object' ? c.args : {};
    const r = await executeTool({ name, args, ctx: toolCtx });
    results.push({ name, result: r });
  }

  const approvalNeeded = results.find((x) => x?.result?.needApproval);
  if (approvalNeeded) {
    const cmd = approvalNeeded?.result?.plan?.args?.cmd || '';
    return buildWorkCard({
      title: '需要审批',
      bullets: [
        '我已生成待批动作，但为安全必须走审批闸门。',
        '请用受限执行器指令发起审批卡：!exec <子命令>',
        cmd ? `LLM 提议命令：${String(cmd)}` : 'LLM 提议：执行受限动作',
        '放行方式：对审批消息点 👍',
      ],
    });
  }

  const evidence = results
    .map((x) => summarizeToolResult(x.name, x.result))
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n\n');
  const hasEvidence = Boolean(String(evidence || '').trim());
  let memoryLines = '';
  if (!hasEvidence) {
    const picks = [];
    const add = (k) => {
      const t = String(k || '').trim();
      if (!t) return;
      if (!picks.includes(t)) picks.push(t);
    };
    if (/rwa/i.test(txt)) add('RWA');
    if (/vercel/i.test(txt)) add('Vercel');
    if (/next\.?js/i.test(txt)) add('Next.js');
    if (picks.length === 0) {
      add('RWA');
      add('Vercel');
      add('Next.js');
    }
    const mem = [];
    for (const k of picks) {
      try {
        const r = memory.search(k, { limit: 3 });
        if (r && r.ok && Array.isArray(r.items) && r.items.length) mem.push(...r.items);
      } catch {}
    }
    const seen = new Set();
    const lines = [];
    for (const it of mem) {
      const sn = String(it?.snippet || '').trim();
      if (!sn) continue;
      const key = sn.replace(/\s+/g, ' ').trim().slice(0, 160);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`🔹 ${key}`);
      if (lines.length >= 3) break;
    }
    if (lines.length) memoryLines = lines.join('\n');
  }
  const finalPrompt = [
    '你已获得工具证据。现在只输出最终回复（不要 JSON）。',
    '要求：纯中文；禁止任何表格；工作态用单列垂直卡片流；给 Plan A/B/C；不要复读。',
    '诚实优先。如果工具返回空结果或出错，直接告知用户实情，建议替代方案。严禁编造虚假数据。',
    '只在用户明确请求帮助且信息确实不足时才提问，日常对话绝对不要追问。',
    `用户输入：${txt}`,
    hasEvidence ? '工具证据：' : '工具证据： （空）',
    evidence || '',
    memoryLines ? '记忆片段：' : '',
    memoryLines || '',
  ].join('\n\n');

  return await askHermes(finalPrompt, '银月', `${extra}\n\n${persona}`, { channelId: cid, preferBrain: 'gemini' });
}

function shouldUseProxy() {
  if (process.env.USE_PROXY === '1') return true;
  if (process.env.USE_PROXY === '0') return false;
  const explicit =
    process.env.OPENCLAW_PROXY_URL ||
    process.env.PROXY_URL ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.ALL_PROXY ||
    process.env.OPENCLAW_PROXY_POOL ||
    process.env.PROXY_POOL;
  return !!String(explicit || '').trim();
}

function getProxyUrl() {
  return (
    process.env.OPENCLAW_PROXY_URL ||
    process.env.PROXY_URL ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.ALL_PROXY ||
    'http://127.0.0.1:7890'
  );
}

function getProxyPool() {
  const raw =
    process.env.OPENCLAW_PROXY_POOL ||
    process.env.PROXY_POOL ||
    '';
  const parts = raw
    .split(/[;,|\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

async function tryApplyProxy(proxyUrl) {
  let u;
  try {
    u = new URL(proxyUrl);
  } catch {
    return false;
  }
  const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
  const ok = await tcpProbe(u.hostname, port);
  if (!ok) return false;
  try {
    const { setGlobalDispatcher, ProxyAgent } = require('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    return true;
  } catch {
    return false;
  }
}

async function rotateProxy() {
  const pool = STATE.routing.proxyPool || getProxyPool();
  if (!pool || pool.length === 0) return null;
  STATE.routing.proxyPool = pool;
  for (let i = 0; i < pool.length; i += 1) {
    const idx = (STATE.routing.proxyIndex + i) % pool.length;
    const url = pool[idx];
    const ok = await tryApplyProxy(url);
    if (ok) {
      STATE.routing.proxyIndex = (idx + 1) % pool.length;
      return url;
    }
  }
  return null;
}

function tcpProbe(host, port, timeoutMs = 800) {
  const net = require('net');
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      try {
        socket.destroy();
      } catch {}
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function setupProxyIfNeeded() {
  if (process.env.USE_PROXY === '0') return;
  if (!shouldUseProxy()) return;

  const proxyUrl = getProxyUrl();
  const ok = await tryApplyProxy(proxyUrl);
  if (ok) {
    STATE.routing.proxyOk = true;
    STATE.routing.forceLocal = false;
    return;
  }

  const rotated = await rotateProxy();
  if (rotated) {
    STATE.routing.proxyOk = true;
    STATE.routing.forceLocal = false;
    return;
  }

  STATE.routing.proxyOk = false;
  STATE.routing.forceLocal = false;
  logErrorEvent('proxy', 'required but unreachable', proxyUrl, { where: 'setupProxyIfNeeded' });
  console.error(`[proxy] required but unreachable: ${proxyUrl}`);
  console.error('[proxy] start your local proxy or set OPENCLAW_PROXY_URL/PROXY_URL/HTTP_PROXY to the correct address');
  console.error('[proxy] or provide OPENCLAW_PROXY_POOL/PROXY_POOL for rotation');
  console.error('[proxy] continuing without proxy (set USE_PROXY=0 to silence this warning)');
}

async function main() {
  ensureCoreSkillsLocked();
  await setupProxyIfNeeded();
  ensureDir(CRON_DIR);
  ensureDir(LOCKS_DIR);
  ensureDir(CLI_ANYTHING_DIR);
  ensureDir(CLI_LOG_DIR);
  ensureDir(SANDBOX_DIR);
  ensureDir(USER_DATA_DIR);
  ensureDir(CASHCLAW_DIR);
  loadLangModeMap();
  loadOwnerContext();
  startLinkServer();
  loadCashclawStripeSeenIds();
  ensureLongTermDb();
  ensureLeadsHeader();
  ensureStaffRequestsHeader();
  ensureDir(STAFF_PENDING_DIR);
  syncOpenclawAgentSouls();
  loadAgents();
  ensureAgentProtocols(STATE.agents);
  ensureDropboxSkeleton(STATE.agents);
  STATE.jarvis.wakeWords = (JARVIS_WAKE_WORDS.length > 0 ? JARVIS_WAKE_WORDS : getDefaultWakeWords());
  buildAgentSkills(STATE.agents);
  buildSkillVisibility(STATE.agents);
  await refreshOllamaModels();
  STATE.ollama.selectedModel = selectHermesModel();
  try {
    const ps = readPuaState();
    STATE.pua.byChannel = ps.byChannel || {};
  } catch {}

  const token = process.env.DISCORD_TOKEN;
  loadUserDataEnvIfNeeded();
  const tokenClean = normalizeDiscordToken(process.env.DISCORD_TOKEN);
  if (tokenClean) process.env.DISCORD_TOKEN = tokenClean;

  const approvalGateEnabled = String(process.env.OPENCLAW_APPROVAL_GATE_ENABLED || '1').trim() !== '0';
  const approvalTtlMs = Number(process.env.OPENCLAW_APPROVAL_TTL_MS || 15 * 60 * 1000);
  const execAllowedServices = String(process.env.OPENCLAW_EXEC_ALLOWED_SERVICES || 'silvermoon-control')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const execAllowedRoots = [__dirname, WORKSPACE_DIR, CRON_DIR].filter(Boolean);
  const execAudit = new ExecAudit({ approvalsPath: EXEC_APPROVALS_LOG_PATH, auditPath: EXEC_AUDIT_LOG_PATH });
  const restrictedExec = new RestrictedExecutor({ allowedServices: execAllowedServices, allowedRootDirs: execAllowedRoots });
  const approvalGate = new ApprovalGate({
    ownerUserId: STATE.discord.ownerUserId || '',
    enabled: approvalGateEnabled,
    approvalsPath: EXEC_APPROVALS_LOG_PATH,
    audit: execAudit,
    ttlMs: approvalTtlMs,
  });
  const approvalInFlight = new Set();

  function tailLines(text, maxLines, maxChars) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = raw.split('\n');
    const n = Math.max(1, Number(maxLines || 12));
    const slice = lines.slice(Math.max(0, lines.length - n)).join('\n');
    const m = Math.max(120, Number(maxChars || 900));
    if (slice.length <= m) return slice;
    return slice.slice(-m);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
  });

  client.once('clientReady', () => {
    STATE.discord.client = client;
    logInfo(`✅ [银月钱庄] 已登录：${client.user.tag}`);
    logInfo(`已加入服务器数: ${client.guilds.cache.size}`);
    try {
      const r = memory.init();
      if (r && r.ok) {
        memory.migrateFromJsonl(LONG_TERM_DB_PATH);
      }
    } catch {}
    restoreReminderTimers(client);
    initCronJobs();
    void selfCheckConnectivity().then(() => writeHeartbeat('启动自检'));
    setTimeout(() => {
      void notifyOwner('主人，小银月已归位，法力充足，随时待命！');
    }, 1200);
  });

  client.on('raw', (packet) => {
    if (packet?.t === 'MESSAGE_CREATE') logDebug('raw MESSAGE_CREATE');
  });

  client.on('messageReactionAdd', async (reaction, user) => {
    let approvalId = null;
    try {
      if (!approvalGateEnabled) return;
      if (!reaction || !user || user.bot) return;

      const ownerId = STATE.discord.ownerUserId || '';
      if (ownerId) approvalGate.ownerUserId = ownerId;

      const r = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
      if (!r) return;
      const msg0 = r.message;
      const msg = msg0 && msg0.partial ? await msg0.fetch().catch(() => null) : msg0;
      if (!msg) return;
      if (!client.user || msg.author?.id !== client.user.id) return;

      const emoji = String(r?.emoji?.name || '').trim();
      const rr = approvalGate.onReaction({ messageId: msg.id, userId: user.id, emoji });
      if (!rr.ok) return;
      approvalId = rr.approvalId;
      if (!approvalId) return;
      if (approvalInFlight.has(approvalId)) return;
      approvalInFlight.add(approvalId);

      const rec = rr.record;
      if (!rec || !rec.request || !rec.request.kind) return;
      rec.state = 'executing';
      execAudit.appendApproval(rec);
      execAudit.appendAudit({ at: new Date().toISOString(), kind: 'executing', approvalId, data: { request: rec.request } });

      const timeoutMs = Number(process.env.OPENCLAW_EXEC_TIMEOUT_MS || 25_000);
      const out = await restrictedExec.run({ kind: rec.request.kind, args: rec.request.args, timeoutMs });

      const ok = out && out.ok === true && out.exitCode === 0;
      rec.state = ok ? 'done' : 'error';
      rec.result = {
        ok,
        exitCode: out && typeof out.exitCode === 'number' ? out.exitCode : null,
        summary: ok ? 'ok' : String(out?.reason || 'non_zero_exit'),
        stdoutTail: tailLines(out?.stdout || '', 14, 900),
        stderrTail: tailLines(out?.stderr || '', 10, 700),
      };
      execAudit.appendApproval(rec);
      execAudit.appendAudit({ at: new Date().toISOString(), kind: 'done', approvalId, data: { result: rec.result } });

      const head = ok ? '✅ 主人\n🔹 审批已放行，执行完成' : '⚠️ 主人\n🔹 审批已放行，但执行异常';
      const body = [
        head,
        `🔹 approvalId：${approvalId}`,
        `🔹 动作：${String(rec.request.kind || '').trim() || 'unknown'}`,
        `🔹 退出码：${rec.result.exitCode == null ? '未知' : String(rec.result.exitCode)}`,
        rec.result.stderrTail ? `🔹 stderr：\n${rec.result.stderrTail}` : '',
        rec.result.stdoutTail ? `🔹 stdout：\n${rec.result.stdoutTail}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      try {
        await msg.reply(body);
      } catch {
        try {
          await msg.channel.send(body);
        } catch {}
      }
    } catch {}
    finally {
      if (approvalId) approvalInFlight.delete(approvalId);
    }
  });

  client.on('messageCreate', async (msg) => {
    if (!msg || msg.author?.bot) return;
    logDebug('收到消息:', msg.content);
    logDebug('来源:', msg.guildId || 'DM', msg.channelId);
    ensureOwnerContext(msg);

    // ── [1] 快速回复拦截：问候/确认 → 直接预设回复，跳过 LLM ──
    const _qrText = String(msg.content || '').trim();
    const _qrCid = String(msg.channelId || '').trim();
    if (_qrText && _qrCid && !STATE.discord.inflightByChannel[_qrCid]) {
      const _qrHit = tryQuickReply(_qrText, _qrCid);
      if (_qrHit) {
        await replyAndRemember(msg, _qrHit);
        writeHeartbeat('quick_reply');
        return;
      }
    }

    if (!markSeenDiscordMessage(msg.id)) return;

    const cid = String(msg.channelId || '').trim();
    if (cid && !msg.guildId) {
      // DM：不做默认语言推断
    } else if (cid && !STATE.discord.langModeByChannel?.[cid]) {
      const chName = String(msg.channel?.name || '').trim();
      if (chName === '常规') setChannelLangMode(cid, 'zh', 0);
    }
    if (cid) {
      if (STATE.discord.inflightByChannel[cid]) {
        const isPing = isPresencePing(String(msg?.content || ''));
        const since = Number(STATE.discord.inflightSinceByChannel?.[cid] || 0);
        if (since && Date.now() - since > 3 * 60 * 1000) {
          logErrorEvent('discord', 'inflight stale reset', `cid=${cid}`, { channelId: cid, since });
          STATE.discord.inflightByChannel[cid] = false;
          STATE.discord.queueNoticeActiveByChannel[cid] = false;
          try {
            delete STATE.discord.inflightSinceByChannel[cid];
          } catch {}
        }
      }
      if (STATE.discord.inflightByChannel[cid]) {
        const att = pickFirstAudioAttachment(msg);
        if (att) {
          STATE.discord.pendingByChannel[cid] = {
            content: msg.content,
            audio: { url: att.url, name: att.name, contentType: att.contentType },
          };
        } else {
          STATE.discord.pendingByChannel[cid] = msg.content;
        }
        const isPing = isPresencePing(String(msg?.content || ''));
        if (isPing) {
          if (!shouldSuppressNotice(cid, 'inflight_ping_ack', 3_000)) {
            const payload = buildDiscordSendOptions('✅ 我在。上一条还在处理，已把你这条排队。', msg.channelId);
            await sendDiscordWithFallback(msg, payload);
          }
          return;
        }
        if (!STATE.discord.queueNoticeActiveByChannel[cid]) {
          STATE.discord.queueNoticeActiveByChannel[cid] = true;
          STATE.discord.lastQueueNoticeAtByChannel[cid] = Date.now();
          await replyAndRemember(msg, '我还在处理上一条，先把你这条记下，马上接上。');
        } else if (!shouldSuppressNotice(cid, 'inflight_queue_ack', 15_000)) {
          const payload = buildDiscordSendOptions('🕓 已收到，正在排队合并处理。', msg.channelId);
          await sendDiscordWithFallback(msg, payload);
        }
        return;
      }
      STATE.discord.inflightByChannel[cid] = true;
      STATE.discord.inflightSinceByChannel[cid] = Date.now();
    }

    try {
      recordLongTermMemory(msg);
      pushShortMemory(msg.channelId, 'user', msg.content);
      recordMemoryEvent(msg);

      const rawContent = String(msg.content || '').trim();
      const wake = detectWakeWord(rawContent);
      const content = stripJarvisWakeWord(rawContent);
      if (cid) STATE.discord.lastUserVerboseByChannel[cid] = isVerboseRequest(content);
      if (cid) STATE.discord.lastUserTextByChannel[cid] = content;
      if (cid) updateTaskContractOnUserMessage(cid, content);

      if (cid && isOwnerOrAdmin(msg) && isRollCallTrigger(content)) {
        if (!shouldSuppressNotice(cid, 'rollcall_ack', 90_000)) {
          await replyAndRemember(msg, buildRollCallAck());
          writeHeartbeat('rollcall');
        }
        return;
      }

      const langCmd = detectLangCommand(content);
      if (langCmd && cid) {
        setChannelLangMode(cid, langCmd.mode, langCmd.ttlMs);
        await replyAndRemember(msg, `✅ 已切换语言模式：${langCmd.mode}`);
        writeHeartbeat('lang');
        return;
      }

      if (cid && isOwnerOrAdmin(msg) && /^!(exec|gate|执行)\b/i.test(content)) {
        if (!approvalGateEnabled) {
          await replyAndRemember(msg, '⚠️ 主人\n🔹 审批闸门未启用\n🔹 请设置环境变量：OPENCLAW_APPROVAL_GATE_ENABLED=1');
          return;
        }
        const ownerId = String(STATE.discord.ownerUserId || '').trim();
        const authorId = String(msg.author?.id || '').trim();
        if (!ownerId || !authorId || ownerId !== authorId) {
          await replyAndRemember(msg, '⚠️ 主人\n🔹 仅主人可创建执行计划');
          return;
        }
        approvalGate.ownerUserId = ownerId;

        const parts = String(content || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const sub = String(parts[1] || '').trim().toLowerCase();

        const help = [
          '✅ 主人',
          '🔹 已进入审批闸门模式（只认 👍）',
          '🔹 用法：',
          '  - !exec status silvermoon-control',
          '  - !exec restart silvermoon-control',
          '  - !exec logs silvermoon-control 120',
          '  - !exec test tests/approval-gate.test.js',
          '  - !exec check main.js',
        ].join('\n');

        if (!sub) {
          await replyAndRemember(msg, help);
          return;
        }

        let kind = '';
        let args = {};
        if (sub === 'status') {
          kind = 'svc_status';
          args = { service: String(parts[2] || 'silvermoon-control').trim() || 'silvermoon-control' };
        } else if (sub === 'restart') {
          kind = 'svc_restart';
          args = { service: String(parts[2] || 'silvermoon-control').trim() || 'silvermoon-control' };
        } else if (sub === 'logs') {
          kind = 'svc_logs';
          const n = Number(parts[3] || 120);
          args = { service: String(parts[2] || 'silvermoon-control').trim() || 'silvermoon-control', lines: n };
        } else if (sub === 'test') {
          kind = 'node_test';
          const rel = String(parts[2] || '').trim();
          if (!rel) {
            await replyAndRemember(msg, help);
            return;
          }
          args = { testPath: path.resolve(__dirname, rel) };
        } else if (sub === 'check') {
          kind = 'node_check';
          const rel = String(parts[2] || '').trim();
          if (!rel) {
            await replyAndRemember(msg, help);
            return;
          }
          args = { scriptPath: path.resolve(__dirname, rel) };
        } else {
          await replyAndRemember(msg, help);
          return;
        }

        const v = restrictedExec.validateAction({ kind, args });
        if (!v.ok) {
          await replyAndRemember(
            msg,
            [
              '⚠️ 主人',
              '🔹 执行计划已拒绝（不满足白名单/参数约束）',
              `🔹 原因：${String(v.reason || 'rejected')}`,
            ].join('\n')
          );
          return;
        }

        const created = approvalGate.createPlan({
          channelId: cid,
          requestedBy: ownerId,
          kind,
          args,
          reason: String(parts.slice(3).join(' ') || '').trim() || '主人指令',
        });
        if (!created.ok) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 创建审批记录失败\n🔹 原因：${String(created.reason || 'unknown')}`);
          return;
        }

        const planText = [
          '🧾 执行计划（待批）',
          `🔹 approvalId：${created.approvalId}`,
          `🔹 动作：${kind}`,
          `🔹 参数：${JSON.stringify(args)}`,
          '🔹 风险：中低（受限执行器白名单）',
          '🔹 放行：主人对本消息点 👍',
          '🔹 止损：如需中止，先移除 👍 或直接重启服务',
        ].join('\n');

        let sent = null;
        try {
          sent = await msg.channel.send(planText);
        } catch {
          sent = await msg.reply(planText).catch(() => null);
        }
        if (sent && sent.id) {
          approvalGate.bindMessage({ approvalId: created.approvalId, messageId: sent.id });
          try {
            await sent.react('👍');
          } catch {}
        }
        writeHeartbeat('approval:plan');
        return;
      }

      if (cid && getChannelLangMode(cid) === 'auto' && shouldAutoEnglish(content)) {
        setChannelLangMode(cid, 'en', 20 * 60 * 1000);
      }

      if (/soul\.md/i.test(content) && /(读|看看|内容|是什么|贴出来|发我)/.test(content)) {
        try {
          const eff = getEffectiveChannelAgent(msg);
          const target = eff || '银月';
          const block = getAgentSoulBlock(target) || getAgentSoulBlock('银月');
          if (block) {
            await replyAndRemember(msg, block);
            writeHeartbeat('agent_soul:read');
            return;
          }
        } catch {}
      }

      if (
        /(notebook\s*lm|notebook_lm|note[_-]?book\.?lm)/i.test(content) &&
        /(写入|放入|追加|收录|保存|记录)/.test(content) &&
        /(以下|下列|内容|文本)/.test(content)
      ) {
        try {
          const nbRoot = path.join(WORKSPACE_DIR, 'notebook');
          const lmDir = path.join(nbRoot, 'lm');
          const lmFile = path.join(lmDir, 'notebook_lm.txt');
          ensureDir(lmDir);
          if (!fs.existsSync(lmFile)) fs.writeFileSync(lmFile, 'OPENCLAW_NOTEBOOK\n', 'utf-8');

          const parts = String(content || '').split('\n');
          let body = parts.length >= 2 ? parts.slice(1).join('\n').trim() : String(content || '').trim();
          body = body.replace(/^.*?(?:以下内容|下列内容|内容)\s*[:：]\s*/s, '').trim();
          if (!body || body.length < 6) body = String(msg.content || '').trim();

          const tzNow = getTzNow();
          const stamp = formatTs(tzNow);
          const entry = [`\n\n【收录】${stamp}`, body, ''].join('\n');
          fs.appendFileSync(lmFile, entry, 'utf-8');

          const linkBase = getLinkBaseUrl();
          const web = '/notebook/lm/notebook_lm.txt';
          const url = linkBase ? `${linkBase}${web}` : web;
          await replyAndRemember(msg, `✅ 已收录到 notebook lm\n🔹 文件：workspace/notebook/lm/notebook_lm.txt\n🔹 打开：${url}`);
          writeHeartbeat('notebook_lm:append');
          return;
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 收录 notebook lm 失败\n🔹 ${e?.message || e}`);
          writeHeartbeat('notebook_lm:append_error');
          return;
        }
      }

      if (/(notebook\s*lm|notebook_lm)/i.test(content) && /(路径|地址|位置|在哪|打开|文件)/.test(content)) {
        try {
          const nbRoot = path.join(WORKSPACE_DIR, 'notebook');
          const lmDir = path.join(nbRoot, 'lm');
          const lmFile = path.join(lmDir, 'notebook_lm.txt');
          ensureDir(lmDir);
          if (!fs.existsSync(lmFile)) fs.writeFileSync(lmFile, 'OPENCLAW_NOTEBOOK\n', 'utf-8');
          const linkBase = getLinkBaseUrl();
          const web = '/notebook/lm/notebook_lm.txt';
          const url = linkBase ? `${linkBase}${web}` : web;
          await replyAndRemember(
            msg,
            [
              'notebook lm 在这里：',
              `🔹 本机文件：workspace/notebook/lm/notebook_lm.txt`,
              `🔹 浏览器打开：${url}`,
              '需要交付双语就发：!lang 双语',
            ].join('\n')
          );
          writeHeartbeat('notebook_lm:path');
          return;
        } catch {}
      }

      const fileRef = content.match(/([A-Za-z]:\\[^#\s]+)#L(\d+)-L(\d+)/i);
      if (fileRef && fileRef[1] && fileRef[2] && fileRef[3]) {
        try {
          const abs = path.resolve(String(fileRef[1]));
          const root = path.resolve(WORKSPACE_DIR);
          if (abs.startsWith(root) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            const from = Math.max(1, Number(fileRef[2]) || 1);
            const to = Math.max(from, Number(fileRef[3]) || from);
            const maxLines = Math.min(90, to - from + 1);
            const raw = safeReadUtf8(abs).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const lines = raw.split('\n');
            const out = [];
            out.push('你发的片段在这里：');
            out.push(`🔹 文件：${abs}`);
            out.push(`🔹 行号：L${from}-L${Math.min(to, from + maxLines - 1)}`);
            out.push('');
            for (let i = 0; i < maxLines; i += 1) {
              const ln = from + i;
              const v = lines[ln - 1];
              if (v == null) break;
              out.push(`${ln}｜${String(v).slice(0, 180)}`);
            }
            if (to - from + 1 > maxLines) out.push('…（已截断）');
            await replyAndRemember(msg, out.join('\n').trim());
            writeHeartbeat('file_ref:snippet');
            return;
          }
        } catch {}
      }

      if (!content) {
        const att = pickFirstAudioAttachment(msg);
        if (att) {
          try {
            const res = await handleWhisper(msg, '!whisper');
            if (res?.handled) {
              await replyAndRemember(msg, res.reply);
              writeHeartbeat('whisper:auto');
              return;
            }
          } catch (e) {
            await replyAndRemember(msg, `⚠️ 主人\n🔹 语音转写失败\n🔹 ${e?.message || e}`);
            writeHeartbeat('whisper:异常');
            return;
          }
        }
        if (wake) {
          await replyAndRemember(msg, `✅ 主人\n🔹 ${wake}在此\n🔹 你直接说事即可（例如：${wake}：查一下 public-apis）`);
          writeHeartbeat('Jarvis:唤醒');
        }
        return;
      }

      await selfCheckConnectivity();

      if (wake && wake === '银月' && isPresencePing(content)) {
        await replyAndRemember(msg, '✅ 主人\n🔹 银月在此\n🔹 我能正常接收消息\n🔹 你把任务直接下令即可');
        writeHeartbeat('Jarvis:在吗');
        return;
      }

      if (isForbiddenMemoryOrReset(content)) {
        await replyAndRemember(msg, '⛔ 主人\n🔹 强制保护规则触发\n🔹 禁止任何清除记忆或重置配置的操作\n🔹 历史数据仅允许追加');
        writeHeartbeat('保护规则');
        return;
      }

      if (wake && wake === '银月' && isIdentityQuery(content)) {
        await replyAndRemember(msg, buildIdentityReply(msg));
        writeHeartbeat('Jarvis:身份自检');
        return;
      }

      if (isIdentityQuery(content)) {
        const eff = getEffectiveChannelAgent(msg);
        const reply = buildAgentSelfIdentityReply(eff);
        if (reply) {
          await replyAndRemember(msg, reply);
          writeHeartbeat('Jarvis:身份自检');
          return;
        }
      }

      const cmd = String(content || '').replace(/^[.。]+/g, '').trim();
      if (/^[!！:]check(\s|$)/i.test(cmd) || /^[!！:]audit(\s|$)/i.test(cmd) || /^[!！:]自检(\s|$)/.test(cmd)) {
        if (!isOwnerOrAdmin(msg)) {
          await replyAndRemember(msg, '⚠️ 主人\n🔹 check/audit 仅允许主人/管理员触发\n🔹 已拒绝执行');
          writeHeartbeat('check:拒绝');
          return;
        }
        const tzNow = getTzNow();
        const agentNames = ['银月', ...STATE.agents.map((a) => a?.name)].filter((v, i, arr) => v && arr.indexOf(v) === i);
        const mustSkills = ['open-viking', 'cloud-mem', 'codex-bridge', 'self-improving-agent', 'automation-workflows'];
        const soulMissing = [];
        for (const n of agentNames) {
          if (n === '银月') continue;
          const agent = (STATE.agents || []).find((a) => a && a.name === n);
          const fp = agent?.file ? path.join(AGENTS_DIR, String(agent.file)) : null;
          if (!fp || !fs.existsSync(fp)) soulMissing.push(n);
        }
        const lines = [];
        lines.push('🧪 银月全体自检');
        lines.push(`时间：${formatTs(tzNow)}`);
        lines.push('');
        lines.push(`🔹 Build：${BUILD_TAG}（PID ${process.pid}）`);
        lines.push(`🔹 Proxy：${STATE.selfCheck?.proxy?.ok ? '连通/不需要' : '不可用'}（${STATE.selfCheck?.proxy?.detail || '无'}）`);
        lines.push(`🔹 Ollama：${STATE.selfCheck?.ollama?.ok ? '在线' : '离线'}（${STATE.selfCheck?.ollama?.detail || '无'}）`);
        lines.push(`🔹 模型：${STATE.routing.useCloud ? '云端(切换)' : (STATE.ollama.selectedModel || '未选择')}`);
        lines.push(`🔹 Owner：uid=${STATE.discord.ownerUserId || '未识别'} channel=${STATE.discord.lastOwnerChannelId || '未绑定'}`);
        lines.push('');
        lines.push(`🔹 Agents：${agentNames.join('、')}`);
        lines.push(`🔹 灵魂档缺失：${soulMissing.length ? soulMissing.join('、') : '无'}`);
        lines.push('');
        lines.push('🧰 关键法宝状态');
        for (const s of mustSkills) lines.push(`🔹 ${s} => ${getSkillStatus(s)}`);
        await replyAndRemember(msg, lines.join('\n').trim());
        writeHeartbeat('check');
        return;
      }

      if (/^\/pua(\s|$)/i.test(content) || /^[!！:]pua(\s|$)/i.test(content)) {
        try {
          const normalized = content.startsWith('/') ? '!' + content.slice(1) : content;
          const res = await handlePua(msg, normalized.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('pua');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 pua 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('pua:异常');
          return;
        }
      }

      if (
        /^\/whrisper(\s|$)/i.test(content) ||
        /^\/whisper(\s|$)/i.test(content) ||
        /^[!！:]whrisper(\s|$)/i.test(content) ||
        /^[!！:]whisper(\s|$)/i.test(content)
      ) {
        try {
          const normalized = content.startsWith('/') ? '!' + content.slice(1) : content;
          const res = await handleWhisper(msg, normalized.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('whisper');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 whisper 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('whisper:异常');
          return;
        }
      }

      if (/^[!！:]cli(\s|$)/i.test(content)) {
        try {
          const res = await handleExecuteCli(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('execute_cli');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 execute_cli 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('execute_cli:异常');
          return;
        }
      }

      if (/^[!！:]codex(\s|$)/i.test(content)) {
        try {
          const instruction = content.replace(/^！/g, '!').replace(/^:/, '!').replace(/^!codex\s*/i, '').trim();
          const res = await codexExecute(msg, instruction);
          await replyAndRemember(msg, res.reply);
          writeHeartbeat(res.ok ? 'codex_execute' : 'codex_execute:失败');
          return;
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 codex_execute 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('codex_execute:异常');
          return;
        }
      }

      if (/^[!！:]codexb(\s|$)/i.test(content)) {
        try {
          const instruction = content.replace(/^！/g, '!').replace(/^:/, '!').replace(/^!codexb\s*/i, '').trim();
          const res = await codexBridge(msg, instruction);
          await replyAndRemember(msg, res.reply);
          writeHeartbeat(res.ok ? 'codex_bridge' : 'codex_bridge:失败');
          return;
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 codex_bridge 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('codex_bridge:异常');
          return;
        }
      }

      if (/^[!！:]redbox(\s|$)/i.test(content)) {
        try {
          const res = await handleRedbox(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('redbox');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 redbox 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('redbox:异常');
          return;
        }
      }

      if (/^[!！:]staff(\s|$)/i.test(content)) {
        try {
          const res = await handleStaff(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('staff');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 staff 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('staff:异常');
          return;
        }
      }

      if (/^[!！:]agentchan(\s|$)/i.test(content)) {
        try {
          const res = await handleAgentChan(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('agentchan');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 agentchan 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('agentchan:异常');
          return;
        }
      }

      if (/^[!！:]tts(\s|$)/i.test(content)) {
        try {
          const res = await handleTts(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('tts');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 tts 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('tts:异常');
          return;
        }
      }

      if (/^[!！:]remind(\s|$)/i.test(content)) {
        try {
          const res = await handleRemind(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('remind');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 remind 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('remind:异常');
          return;
        }
      }

      if (cid && isOwnerOrAdmin(msg) && /^(!|！|\/)memory\s+purge(\s|$)/i.test(content)) {
        const r = purgeLongTermMemoryForChannel(msg.channelId);
        STATE.shortMemory.byChannel[cid] = [];
        await replyAndRemember(
          msg,
          r.ok
            ? `✅ 主人\n🔹 已清空本频道对话缓存\n🔹 long_term_memory 移除: ${r.removed}`
            : '⚠️ 主人\n🔹 清空缓存失败',
        );
        writeHeartbeat('memory:purge');
        return;
      }

      if (/^[!！:]news(\s|$)/i.test(content)) {
        try {
          const res = await handleNews(msg, content.replace(/^！/g, '!').replace(/^:/, '!'));
          if (res?.handled) {
            await replyAndRemember(msg, res.reply);
            writeHeartbeat('news');
            return;
          }
        } catch (e) {
          await replyAndRemember(msg, `⚠️ 主人\n🔹 news 通道异常\n🔹 ${e?.message || e}`);
          writeHeartbeat('news:异常');
          return;
        }
      }

      if (/(早晨|早上|晨报|早报|简报)/i.test(content) && !/^[!！:]/.test(content)) {
        try {
          if (cid) {
            const tzNow = getTzNow();
            const ymd = formatYmd(tzNow);
            const force = /(force|强制)/i.test(content);
            if (!force && shouldSuppressNotice(cid, `brief_auto_${ymd}`, 10 * 60 * 1000)) return;
            const marker = path.join(CRON_DIR, `${ymd}_早报.sent`);
            if (!force && fs.existsSync(marker)) {
              await replyAndRemember(
                msg,
                [
                  '✅ 主人',
                  `🔹 今日早报已发（定时 ${String(MORNING_BRIEF_HH).padStart(2, '0')}:${String(MORNING_BRIEF_MM).padStart(2, '0')}）`,
                  `🔹 归档: ${ymd}_早报.md`,
                  '🔹 重发: “早报 force”',
                ].join('\n')
              );
              writeHeartbeat('brief:auto:already_sent');
              return;
            }
          }
          const text = await buildMorningBrief();
          await replyAndRemember(msg, text);
          writeHeartbeat('brief:auto');
          return;
        } catch {}
      }

      try {
        await msg.channel.sendTyping();

        // ── [5] 子 Agent 编排：Level 3 深度任务 → 创建 workflow ──
        const _convGrade = classifyComplexity(content);
        if (_convGrade.level === 3 && cid) {
          const _wfSteps = workflow.getTaskTemplate('development', detectLang(content));
          if (_wfSteps.length > 0) {
            workflow.createWorkflow(cid, _wfSteps, detectLang(content), {
              title: detectLang(content) === 'en' ? 'Processing Task...' : '任务处理中...',
            });
            const _progress = workflow.renderProgress(cid);
            if (_progress) {
              await msg.channel.send(_progress).catch(() => {});
            }
          }
        }

        const eff = getEffectiveChannelAgent(msg);
        let target = eff || detectTargetAgent(content);
        const finance = isFinanceTask(content);
        const legal = isLegalTask(content);
        if ((finance || legal) && !['银月', '雅妃'].includes(target)) target = '银月';
        const mode = determineMode(content);
        logDebug(`[模式判定] Level ${mode.level}`);
        writeHeartbeat(`${target} 在线 | ${mode.level >= 3 ? '高频' : '低频'}`);

        const extra = buildAgentInstruction(target, mode.instruction, { channelId: msg.channelId, userText: content });
        if (target === '银月' && isOwnerOrAdmin(msg) && isCoreSkillRollcall(content)) {
          await replyAndRemember(msg, buildYinyueCoreSkillsAndRoutingReply());
          writeHeartbeat('yinyue:core_skills');
          return;
        }
        if (target === '银月') {
          const hit = await tryIntentIntercept(content, {
            fetchUsdMyr,
            fetchMetalsSpotUsd,
            fetchCryptoUsd,
          });
          if (hit) {
            await replyAndRemember(msg, hit);
            writeHeartbeat('intent:intercept');
            return;
          }
        }
        if (finance) {
          const locked = await withLock(FINANCE_LOCK_PATH, 'finance', '银月', async () => {
            const raw =
              target === '银月'
                ? await askSilvermoonAutonomyD({ userText: content, extraInstruction: extra, channelId: msg.channelId, requestedBy: msg.author?.id })
                : await askHermes(content, target, extra, { channelId: msg.channelId });
            const sr = parseStaffRequest(raw, target);
            if (sr) {
              await appendStaffRequest(sr);
              await notifyOwner(
                `🧑‍🤝‍🧑 主人\n🔹 收到人手申请\n🔹 申请者: ${sr.requester}\n🔹 原因: ${sr.reason}\n🔹 建议: ${sr.suggestedFiles.join('、')}\n🔹 已写入: workspace/STAFF_REQUESTS.md`
              );
            }
            await replyAndRemember(msg, raw);
            writeHeartbeat(`${target} 完成回复`);
          });
          if (!locked.ok) {
            if (!cid || !shouldSuppressNotice(cid, 'finance_lock_busy', 30_000)) {
              await replyAndRemember(msg, '⚠️ 主人\n🔹 财务锁已被占用\n🔹 我稍后自动重试，不需要你做任何操作');
            }
          }
        } else {
          const raw =
            target === '银月'
              ? await askSilvermoonAutonomyD({ userText: content, extraInstruction: extra, channelId: msg.channelId, requestedBy: msg.author?.id })
              : await askHermes(content, target, extra, { channelId: msg.channelId });
          const sr = parseStaffRequest(raw, target);
          if (sr) {
            await appendStaffRequest(sr);
            await notifyOwner(
              `🧑‍🤝‍🧑 主人\n🔹 收到人手申请\n🔹 申请者: ${sr.requester}\n🔹 原因: ${sr.reason}\n🔹 建议: ${sr.suggestedFiles.join('、')}\n🔹 已写入: workspace/STAFF_REQUESTS.md`
            );
          }
          await replyAndRemember(msg, raw);
          writeHeartbeat(`${target} 完成回复`);
        }
        writeHeartbeat('消息交互');
      } catch (e) {
        console.error('[messageCreate] handler error:', e?.message || e);
        logErrorEvent('discord', 'messageCreate handler error', e?.message || e, { where: 'messageCreate', channelId: msg.channelId });
        await replyAndRemember(msg, '🚨 主人\n🔹 银月内阁灵枢核心阵纹受损\n🔹 请排查异常');
        writeHeartbeat('异常');
        return;
      }
    } catch (e) {
      console.error('[messageCreate] handler error (outer):', e?.message || e);
      logErrorEvent('discord', 'messageCreate handler error (outer)', e?.message || e, { where: 'messageCreate_outer', channelId: msg.channelId });
      try {
        await replyAndRemember(msg, '🚨 主人\n🔹 银月内阁灵枢核心阵纹受损\n🔹 请排查异常');
      } catch {}
      writeHeartbeat('异常');
    } finally {
      if (cid) {
        STATE.discord.inflightByChannel[cid] = false;
        STATE.discord.queueNoticeActiveByChannel[cid] = false;
        try {
          delete STATE.discord.inflightSinceByChannel[cid];
        } catch {}
        const pending = STATE.discord.pendingByChannel[cid];
        if (pending) {
          delete STATE.discord.pendingByChannel[cid];
          const fake =
            typeof pending === 'string'
              ? { ...msg, content: pending }
              : {
                  ...msg,
                  id: `${String(msg.id || '')}:p:${Date.now()}`,
                  content: String(pending?.content || ''),
                  attachments: {
                    forEach: (fn) => {
                      if (pending?.audio?.url) fn(pending.audio);
                    },
                  },
                };
          setTimeout(() => {
            try {
              client.emit('messageCreate', fake);
            } catch {}
          }, 20);
        }
      }
    }
  });

  client.on('error', (e) => console.error('[client error]', e?.message || e));
  client.on('warn', (m) => console.warn('[client warn]', m));
  client.on('shardError', (e) => console.error('[shard error]', e?.message || e));

  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
  process.on('uncaughtException', (e) => {
    console.error('[uncaughtException]', e);
    process.exit(1);
  });
  process.on('SIGINT', () => {
    try {
      memory.close();
    } catch {}
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    try {
      memory.close();
    } catch {}
    process.exit(0);
  });

  let loginBackoffMs = 1200;
  let loginInFlight = false;
  const maxBackoffMs = 5 * 60 * 1000;

  const tryLogin = async () => {
    if (loginInFlight) return;
    loginInFlight = true;
    try {
      loadUserDataEnvIfNeeded();
      const tk = normalizeDiscordToken(process.env.DISCORD_TOKEN);
      if (!tk) {
        console.error('[login skipped] Missing DISCORD_TOKEN');
        return;
      }
      process.env.DISCORD_TOKEN = tk;
      await client.login(tk);
      loginBackoffMs = 1200;
    } catch (e) {
      const msg = String(e?.message || e || 'error');
      console.error('[login failed]', msg);
      loginBackoffMs = Math.min(maxBackoffMs, Math.max(1200, Math.floor(loginBackoffMs * 1.8)));
      setTimeout(() => {
        loginInFlight = false;
        void tryLogin();
      }, loginBackoffMs);
      return;
    } finally {
      loginInFlight = false;
    }
  };

  void tryLogin();
}

function formatTs(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function writeFileSafe(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    console.error('[writeFileSafe] failed:', e?.message || e);
    return false;
  }
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function tryAcquireLock(lockPath, by) {
  try {
    const fd = fs.openSync(lockPath, 'wx');
    const payload = {
      pid: process.pid,
      by: by || 'unknown',
      at: new Date().toISOString(),
    };
    fs.writeFileSync(fd, JSON.stringify(payload), 'utf-8');
    fs.closeSync(fd);
    return { ok: true, info: payload };
  } catch {
    const info = readJsonSafe(lockPath);
    return { ok: false, info };
  }
}

function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

async function withLock(lockPath, stateKey, by, fn) {
  const acquired = tryAcquireLock(lockPath, by);
  if (!acquired.ok) return { ok: false, info: acquired.info };
  STATE.locks[stateKey] = { locked: true, since: acquired.info.at, by: acquired.info.by };
  try {
    const val = await fn();
    return { ok: true, value: val };
  } finally {
    releaseLock(lockPath);
    STATE.locks[stateKey] = { locked: false, since: null, by: null };
  }
}

function getSkillStatus(skillName) {
  if (skillName === 'voice-wakeup') return 'Discord环境不支持';
  if (skillName === 'jarvis-core') return STATE.jarvis?.enabled ? '在线(协议)' : '未启用';
  if (skillName === 'persistent-agent') return '在线(常驻)';
  if (skillName === 'self-learning') return '在线(增量)';
  if (skillName === 'long-term-memory') return fs.existsSync(LONG_TERM_DB_PATH) ? '在线(DB)' : '缺失';
  if (skillName === 'openclaw-zero-token') return ZERO_TOKEN_BASE_URL ? '在线(网关)' : '未配置';
  if (CORE_SKILLS.includes(skillName)) return '在线(声明)';
  if (skillName === 'narrator-ai-skill') return '在线(协议)';
  if (skillName === 'narrator-script') return '在线(文案)';
  if (skillName === 'narrator-research-pack') return '在线(素材)';
  if (skillName === 'narrator-voice-render') return '隔离执行(待配置)';
  if (skillName === 'notebooklm') return '在线(官方Web)';
  if (skillName === 'stripe-payment-flow') return process.env.STRIPE_SECRET_KEY ? '在线' : '未配置';
  if (skillName === 'lemon-squeezy-api-bridge') return process.env.LEMON_SQUEEZY_API_KEY ? '在线' : '未配置';
  if (skillName === 'proxy-rotator') return process.env.USE_PROXY === '1' ? '在线' : '未启用';
  if (skillName === 'pentagi-audit') return '隔离执行(待配置)';
  if (skillName === 'redbox') return process.env.REDBOX_PROFILE || process.env.REDBOX_COOKIES ? '在线' : '未配置';
  if (skillName === 'redbox-maintenance') return '待配置';
  if (skillName === 'codex-bridge') return '在线(通道)';
  if (skillName === 'autora-autoresearch') return '隔离执行(待配置)';
  if (skillName === 'public-apis') return '在线(目录)';
  if (skillName === 'searxng-search') return process.env.SEARXNG_URL ? '在线' : '未配置';
  if (skillName === 'jina-reader') return '在线(无需key)';
  if (skillName === 'gog-search') return '后台(待接入)';
  if (skillName === 'laptop-control') return process.env.LAPTOP_CONTROL === '1' ? '在线(受控)' : '未启用';
  if (skillName === 'ai-hedge-fund') return '隔离执行(待配置)';
  if (skillName === 'trading-agent') return '隔离执行(待配置)';
  if (skillName === 'design-md') return fs.existsSync(DESIGN_SPEC_PATH) ? '在线(规范)' : '缺失';
  return '在线(模拟)';
}

function redactSecrets(text) {
  let s = String(text || '');
  s = s.replace(/[MN][A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}/g, 'discord_token_***');
  s = s.replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***');
  s = s.replace(/gsk_[A-Za-z0-9_-]{10,}/g, 'gsk_***');
  s = s.replace(/(DISCORD_TOKEN\s*=\s*)["'][^"']+["']/gi, '$1"***"');
  s = s.replace(/(CLOUD_API_KEY\s*=\s*)["'][^"']+["']/gi, '$1"***"');
  s = s.replace(/(STRIPE_SECRET_KEY\s*=\s*)["'][^"']+["']/gi, '$1"***"');
  return s;
}

function isFinancialOrKeyEvent(content) {
  const s = String(content || '');
  const hit = /(stripe|lemon|squeezy|payment|webhook|invoice|order|checkout|api\s*key|secret|token|密钥|钥匙|令牌|支付|付款|对账|回调|订单|充值)/i;
  return hit.test(s);
}

function fingerprint(type, text) {
  const base = `${type}|${String(text || '').trim().toLowerCase()}`;
  return crypto.createHash('sha1').update(base).digest('hex');
}

function appendJsonl(filePath, obj) {
  try {
    fs.appendFileSync(filePath, JSON.stringify(obj) + '\n', 'utf-8');
    return true;
  } catch (e) {
    console.error('[appendJsonl] failed:', e?.message || e);
    return false;
  }
}

function ensureLongTermDb() {
  try {
    ensureDir(USER_DATA_DIR);
    if (!fs.existsSync(LONG_TERM_DB_PATH)) fs.writeFileSync(LONG_TERM_DB_PATH, 'OPENCLAW_LONG_TERM_MEMORY_DB\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function appendLongTermRecord(obj) {
  try {
    ensureLongTermDb();
    fs.appendFileSync(LONG_TERM_DB_PATH, JSON.stringify(obj) + '\n', 'utf-8');
    STATE.memory.lastLongTermAppendAt = new Date().toISOString();
    return true;
  } catch {
    return false;
  }
}

function recordLongTermMemory(msg) {
  const raw = String(msg?.content || '').trim();
  if (!raw) return;
  const cleaned = redactSecrets(raw);
  const id = fingerprint('ltm', `${msg.author?.id || 'na'}|${cleaned}`);
  appendLongTermRecord({
    id,
    at: new Date().toISOString(),
    guildId: msg.guildId || null,
    channelId: msg.channelId || null,
    authorId: msg.author?.id || null,
    role: 'user',
    content: cleaned,
  });
  try {
    memory.append({
      uid: id,
      at: new Date().toISOString(),
      channelId: msg.channelId || null,
      role: 'user',
      content: cleaned,
      meta: { guildId: msg.guildId || null, authorId: msg.author?.id || null },
    });
  } catch {}
}

function recordLongTermAssistant(channelId, text) {
  const raw = String(text || '').trim();
  if (!raw) return;
  const cleaned = redactSecrets(raw);
  const id = fingerprint('ltm', `assistant|${channelId || 'na'}|${cleaned}`);
  appendLongTermRecord({
    id,
    at: new Date().toISOString(),
    guildId: null,
    channelId: channelId || null,
    authorId: null,
    role: 'assistant',
    content: cleaned,
  });
  try {
    memory.append({
      uid: id,
      at: new Date().toISOString(),
      channelId: channelId || null,
      role: 'assistant',
      content: cleaned,
      meta: { guildId: null, authorId: null },
    });
  } catch {}
}

function pushShortMemory(channelId, role, text) {
  const cid = String(channelId || '').trim();
  if (!cid) return;
  const raw = String(text || '').trim();
  if (!raw) return;
  const item = { at: new Date().toISOString(), role: role || 'user', content: redactSecrets(raw) };
  const arr = STATE.shortMemory.byChannel[cid] || [];
  arr.push(item);
  const max = 24;
  while (arr.length > max) arr.shift();
  STATE.shortMemory.byChannel[cid] = arr;
}

function getShortMemoryBlock(channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return '';
  const arr = STATE.shortMemory.byChannel[cid] || [];
  if (arr.length === 0) return '';
  const tail = arr.slice(-14);
  const lines = [];
  lines.push('【短期记忆（最近对话）】');
  for (const it of tail) {
    const tag = it.role === 'assistant' ? '🤖' : '🧑';
    lines.push(`${tag} ${it.content}`);
  }
  return lines.join('\n');
}

function getLongMemoryRecentBlock(channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return '';
  const raw = readLastChars(LONG_TERM_DB_PATH, 220_000);
  if (!raw) return '';

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== 'OPENCLAW_LONG_TERM_MEMORY_DB');

  const items = [];
  for (let i = lines.length - 1; i >= 0 && items.length < 28; i -= 1) {
    const l = lines[i];
    if (!l || l[0] !== '{') continue;
    try {
      const j = JSON.parse(l);
      if (String(j?.channelId || '') !== cid) continue;
      const role = j?.role === 'assistant' ? 'assistant' : 'user';
      const content = String(j?.content || '').trim();
      if (!content) continue;
      const isOldSoulBlob =
        content.length > 80 &&
        /(^|\n)SOUL(\n|$)/i.test(content) &&
        /(主要规范|思考模式|日常闲聊模式|简单任务模式|复杂任务模式|think\s+high|think\s+模式)/i.test(content);
      if (isOldSoulBlob) continue;
      items.push({ role, content });
    } catch {}
  }

  if (items.length === 0) return '';
  const ordered = items.reverse().slice(-18);
  const out = [];
  out.push('【长期记忆（本频道近期）】');
  for (const it of ordered) {
    const tag = it.role === 'assistant' ? '🤖' : '🧑';
    out.push(`${tag} ${it.content}`);
  }
  return out.join('\n');
}

function readOpenclawCoreSkills() {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return [];
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8');
    const cfg = raw ? JSON.parse(raw) : null;
    const skills = cfg?.agents?.defaults?.skills;
    return Array.isArray(skills) ? skills.map((s) => String(s || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function readYinyueSoulText() {
  try {
    const p = path.join(OPENCLAW_WORKSPACES_ROOT, 'yinyue', 'SOUL.md');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
  } catch {
    return '';
  }
}

function extractSoulSection(text, headerRe) {
  const s = String(text || '');
  const re = headerRe instanceof RegExp ? headerRe : null;
  if (!re) return '';
  const m = s.match(re);
  return m ? String(m[0] || '').trim() : '';
}

function isCoreSkillRollcall(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return /(15\s*个|十五\s*个|15\s*核心|十五\s*核心|核心技能|技能清单|你会什么|你有哪些技能)/.test(s);
}

function buildYinyueCoreSkillsAndRoutingReply() {
  const soul = readYinyueSoulText();
  const core = readOpenclawCoreSkills();
  const route = extractSoulSection(
    soul,
    /【路由与分工准则[^】]*】[\s\S]*?(?=\n【|$)/,
  );
  const skillsBlock = core.length
    ? ['【15 核心技能】', ...core.map((s) => `- ${s}`)].join('\n')
    : '【15 核心技能】（未读取到 openclaw.json 的 defaults.skills）';
  return ['✅ 主人', skillsBlock, route || '【路由与分工准则】（未读取到银月 SOUL 路由段）'].join('\n');
}

function purgeLongTermMemoryForChannel(channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return { ok: false, removed: 0, kept: 0 };
  try {
    if (!fs.existsSync(LONG_TERM_DB_PATH)) return { ok: true, removed: 0, kept: 0 };
    const raw = fs.readFileSync(LONG_TERM_DB_PATH, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const kept = [];
    let removed = 0;
    for (const l of lines) {
      const s = String(l || '').trim();
      if (!s) continue;
      if (s === 'OPENCLAW_LONG_TERM_MEMORY_DB') {
        kept.push(s);
        continue;
      }
      if (s[0] !== '{') {
        kept.push(s);
        continue;
      }
      try {
        const j = JSON.parse(s);
        if (String(j?.channelId || '') === cid) {
          removed += 1;
          continue;
        }
      } catch {}
      kept.push(s);
    }
    fs.writeFileSync(LONG_TERM_DB_PATH, kept.join('\n') + '\n', 'utf-8');
    return { ok: true, removed, kept: kept.length };
  } catch {
    return { ok: false, removed: 0, kept: 0 };
  }
}

async function replyAndRemember(msg, text, meta) {
  const agent =
    String(meta?.agent || meta?.target || '').trim() ||
    String(getEffectiveChannelAgent(msg) || '').trim();
  const extraOpts = { userText: String(msg?.content || ''), agent };
  const payload0 = buildDiscordSendOptions(text, msg.channelId, extraOpts);
  const raw = String(payload0?.content || '').trim();
  const isPing = isPresencePing(String(msg?.content || ''));
  const compact = isModelDownNoticeText(raw)
    ? renderModelDownReply({ raw, isPing, userText: String(msg?.content || '') })
    : raw;
  const payload = compact !== raw ? buildDiscordSendOptions(compact, msg.channelId, extraOpts) : payload0;
  const ttlMs = isPing ? 3_000 : (isModelDownNoticeText(raw) ? 20_000 : 60_000);
  const uHash = isPing ? fingerprint('ping_msg', String(msg?.id || Date.now())) : fingerprint('user_msg', String(msg?.content || '').trim());
  if (shouldSuppressDuplicateAssistantReply(msg.channelId, payload?.content || '', ttlMs, uHash)) {
    if (!isPing && !shouldSuppressNotice(msg.channelId, 'reply_suppressed_ack', 15_000)) {
      const ack = buildDiscordSendOptions('🕓 已收到（重复请求已合并）。', msg.channelId, extraOpts);
      await sendDiscordWithFallback(msg, ack);
    }
    return;
  }
  const sent = await sendDiscordWithFallback(msg, payload);
  if (!sent.ok) {
    logErrorEvent('discord', 'reply_send_failed', String(sent?.errors || ''), { channelId: msg.channelId });
    return;
  }
  if (payload?.files?.length) {
    const delivery = resolveDropboxDeliveryFile(text);
    if (delivery) {
      recordDropboxDelivery({
        channelId: msg.channelId,
        to: msg.channelId,
        absPath: delivery.absPath,
        size: delivery.size,
        sha256: computeSha256Hex(delivery.absPath),
        mode: 'replyAndRemember',
      });
    }
  }
  pushShortMemory(msg.channelId, 'assistant', payload.content);
  recordLongTermAssistant(msg.channelId, payload.content);
}

function readLastChars(filePath, maxChars) {
  try {
    const stat = fs.statSync(filePath);
    const size = stat.size;
    const len = Math.min(size, maxChars);
    const start = Math.max(0, size - len);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    fs.closeSync(fd);
    return buf.toString('utf-8');
  } catch {
    return '';
  }
}

function recordMemoryEvent(msg) {
  const raw = String(msg?.content || '').trim();
  if (!raw) return;
  if (!isFinancialOrKeyEvent(raw)) return;

  const cleaned = redactSecrets(raw);
  const type = /stripe|payment|webhook|invoice|order|checkout|支付|付款|对账|回调|订单|充值/i.test(cleaned)
    ? 'finance'
    : 'key';
  const id = fingerprint(type, cleaned);

  appendJsonl(MEMORY_EVENTS_PATH, {
    id,
    type,
    at: new Date().toISOString(),
    guildId: msg.guildId || null,
    channelId: msg.channelId || null,
    authorId: msg.author?.id || null,
    content: cleaned,
  });
}

function readExistingVaultIds() {
  const raw = safeReadUtf8(MEMORY_VAULT_PATH);
  const ids = new Set();
  const re = /ID:\s*([a-f0-9]{40})/gi;
  let m;
  while ((m = re.exec(raw)) !== null) ids.add(m[1]);
  return ids;
}

function buildVaultEntryLine(evt) {
  const when = evt.at ? evt.at.slice(0, 19).replace('T', ' ') : '';
  const tag = evt.type === 'finance' ? '💰' : '🔑';
  return `${tag} 时间: ${when}\n🔹 内容: ${evt.content}\n🔹 ID: ${evt.id}\n`;
}

function runAutoDream() {
  const tName = '史官_AutoDream_24h记忆复盘';
  const nowIso = new Date().toISOString();

  return withLock(AUTODREAM_LOCK_PATH, 'autodream', '史官', async () => {
    const existing = readExistingVaultIds();
    const raw = safeReadUtf8(MEMORY_EVENTS_PATH);
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const fresh = [];

    for (const l of lines) {
      try {
        const evt = JSON.parse(l);
        if (!evt || !evt.id || !evt.content) continue;
        if (existing.has(evt.id)) continue;
        fresh.push(evt);
      } catch {}
    }

    if (fresh.length === 0) {
      STATE.memory.lastAutoDreamAt = nowIso;
      STATE.cron.lastRuns[tName] = formatTs(new Date());
      writeHeartbeat('AutoDream:无新增');
      return { added: 0 };
    }

    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const header = safeReadUtf8(MEMORY_VAULT_PATH).trim()
      ? safeReadUtf8(MEMORY_VAULT_PATH)
      : [
          'MEMORY_VAULT',
          '用途: 史官每 24 小时复盘后写入的关键变动索引（已去重）',
          '说明: 仅落盘摘要，所有疑似密钥/令牌已脱敏',
          '',
        ].join('\n');

    const parts = [];
    parts.push(header.trimEnd());
    parts.push('');
    parts.push(`日期: ${day}`);
    parts.push(`更新时间: ${formatTs(new Date())}`);
    parts.push('');

    const byType = { finance: [], key: [] };
    for (const evt of fresh) {
      const t = evt.type === 'finance' ? 'finance' : 'key';
      byType[t].push(evt);
    }

    const section = [];
    if (byType.finance.length > 0) {
      section.push('财务变动');
      for (const evt of byType.finance) section.push(buildVaultEntryLine(evt));
    }
    if (byType.key.length > 0) {
      section.push('密钥与权限变动');
      for (const evt of byType.key) section.push(buildVaultEntryLine(evt));
    }

    parts.push(section.join('\n').trimEnd());
    parts.push('');

    writeFileSafe(MEMORY_VAULT_PATH, parts.join('\n'));
    STATE.memory.lastAutoDreamAt = nowIso;
    STATE.cron.lastRuns[tName] = formatTs(new Date());
    writeHeartbeat('AutoDream:写入');
    return { added: fresh.length };
  });
}

function writeHeartbeat(reason) {
  const now = new Date();
  const lines = [];
  lines.push('HEARTBEAT');
  lines.push(`时间: ${formatTs(now)}`);
  lines.push(`触发: ${reason}`);
  lines.push(`在线: ${['银月', ...STATE.agents.map((a) => a.name)].filter((v, i, arr) => v && arr.indexOf(v) === i).join('、')}`);
  lines.push('');
  lines.push('Self-Check');
  lines.push(`Proxy: ${STATE.selfCheck?.proxy?.ok === null ? '未知' : (STATE.selfCheck.proxy.ok ? '连通' : '断开')} | ${STATE.selfCheck?.proxy?.detail || '无'} | ${STATE.selfCheck?.proxy?.at || '无'}`);
  lines.push(`Ollama: ${STATE.selfCheck?.ollama?.ok === null ? '未知' : (STATE.selfCheck.ollama.ok ? '连通' : '断开')} | ${STATE.selfCheck?.ollama?.detail || '无'} | ${STATE.selfCheck?.ollama?.at || '无'}`);
  lines.push('');
  lines.push('Ollama');
  lines.push(`模型: ${STATE.routing.useCloud ? '云端(切换)' : (STATE.ollama.selectedModel || '未选择')}`);
  lines.push(`最近延迟(ms): ${STATE.ollama.lastLatencyMs ?? '未知'}`);
  lines.push(`最近成功: ${STATE.ollama.lastOkAt || '未知'}`);
  lines.push(`最近失败: ${STATE.ollama.lastErrAt || '无'}`);
  lines.push('');
  lines.push('Memory');
  lines.push(`复盘周期: 24h`);
  lines.push(`上次复盘: ${STATE.memory.lastAutoDreamAt || '无'}`);
  lines.push(`下次复盘: ${STATE.memory.nextAutoDreamAt || '未知'}`);
  lines.push(`长期记忆DB: ${fs.existsSync(LONG_TERM_DB_PATH) ? '存在' : '缺失'}`);
  lines.push(`长期记忆写入: ${STATE.memory.lastLongTermAppendAt || '无'}`);
  lines.push('');
  lines.push('Jarvis');
  lines.push(`模式: ${STATE.jarvis?.enabled ? '已启用' : '未启用'}`);
  lines.push(`唤醒词: ${(STATE.jarvis?.wakeWords || []).join('、') || '无'}`);
  lines.push('');
  lines.push('Locks');
  lines.push(`财务锁: ${STATE.locks.finance.locked ? '锁定' : '空闲'}${STATE.locks.finance.by ? ` | 持有者: ${STATE.locks.finance.by}` : ''}${STATE.locks.finance.since ? ` | 起始: ${STATE.locks.finance.since}` : ''}`);
  lines.push(`史官锁: ${STATE.locks.autodream.locked ? '锁定' : '空闲'}${STATE.locks.autodream.by ? ` | 持有者: ${STATE.locks.autodream.by}` : ''}${STATE.locks.autodream.since ? ` | 起始: ${STATE.locks.autodream.since}` : ''}`);
  lines.push(`Codex锁: ${STATE.locks.codex.locked ? '锁定' : '空闲'}${STATE.locks.codex.by ? ` | 持有者: ${STATE.locks.codex.by}` : ''}${STATE.locks.codex.since ? ` | 起始: ${STATE.locks.codex.since}` : ''}`);
  lines.push(`RedBox锁: ${STATE.locks.redbox.locked ? '锁定' : '空闲'}${STATE.locks.redbox.by ? ` | 持有者: ${STATE.locks.redbox.by}` : ''}${STATE.locks.redbox.since ? ` | 起始: ${STATE.locks.redbox.since}` : ''}`);
  lines.push(`人手锁: ${STATE.locks.staff.locked ? '锁定' : '空闲'}${STATE.locks.staff.by ? ` | 持有者: ${STATE.locks.staff.by}` : ''}${STATE.locks.staff.since ? ` | 起始: ${STATE.locks.staff.since}` : ''}`);
  lines.push('');
  lines.push('CLI');
  lines.push(`HARNESS.md: ${resolveHarnessPath() ? '存在' : '缺失'}`);
  lines.push(`registry: ${parseCliRegistry().length}`);
  lines.push(`上次 dry-run: ${STATE.cli.lastDryRunAt || '无'}`);
  lines.push(`上次 run: ${STATE.cli.lastRunAt || '无'}`);
  lines.push(`上次工具: ${STATE.cli.lastTool || '无'}`);
  lines.push(`上次结果: ${STATE.cli.lastOk === null ? '无' : (STATE.cli.lastOk ? '成功' : '失败')}`);
  lines.push('');
  lines.push('Agents');

  const agentNames = ['银月', ...STATE.agents.map((a) => a.name)].filter((v, i, arr) => arr.indexOf(v) === i);
  for (const name of agentNames) {
    const skills = STATE.agentSkills[name] || [];
    lines.push(`- ${name}`);
    lines.push(`  法力值: ${STATE.ollama.lastLatencyMs ?? '未知'}ms`);
    if (skills.length === 0) {
      lines.push('  法宝: 无');
    } else {
      for (const s of skills) lines.push(`  法宝: ${s} => ${getSkillStatus(s)}`);
    }
  }

  lines.push('');
  lines.push('Cron');
  if (STATE.cron.tasks.length === 0) {
    lines.push('无');
  } else {
    for (const t of STATE.cron.tasks) {
      lines.push(`- ${t}`);
      lines.push(`  上次: ${STATE.cron.lastRuns[t] || '无'}`);
      lines.push(`  下次: ${STATE.cron.nextRuns[t] || '未知'}`);
    }
  }

  if (typeof STATE.ollama.lastLatencyMs === 'number') {
    if (STATE.ollama.lastLatencyMs >= LATENCY_WARN_MS) {
      STATE.ollama.highLatencyStreak += 1;
    } else {
      STATE.ollama.highLatencyStreak = 0;
    }
  }

  if (STATE.ollama.highLatencyStreak >= 3 && !STATE.routing.useCloud) {
    STATE.routing.useCloud = true;
    void notifyOwner('⚠️ 主人，灵枢告急\n🔹 心跳延迟连续 3 次过高\n🔹 已切换云端备用通道\n🔹 建议检查本地 Ollama 负载与网络通路');
  }

  writeFileSafe(HEARTBEAT_PATH, lines.join('\n') + '\n');
}

function runYaFeiDailyReport() {
  const tName = '雅妃_每日0点财务报表';
  STATE.cron.lastRuns[tName] = formatTs(new Date());
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const file = path.join(CRON_DIR, `ya-fei_finance_${y}${m}${day}.md`);
  const body = [
    '银月钱庄 财务报表(占位)',
    `时间: ${formatTs(d)}`,
    '说明: 本任务已落盘。真实账目对接需配置支付网关凭据与账本来源。',
  ].join('\n');
  writeFileSafe(file, body + '\n');
  writeHeartbeat('Cron:财务报表');
}

function runHanLiJobIntel() {
  const tName = '韩立_每4小时海外兼职资讯';
  STATE.cron.lastRuns[tName] = formatTs(new Date());
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const file = path.join(CRON_DIR, `han-li_jobs_${y}${m}${day}_${hh}.md`);

  const seeds = [];
  const seen = new Set();
  const deduped = [];
  for (const it of seeds) {
    const title = String(it?.title || '').trim();
    const platform = String(it?.platform || '').trim();
    const price = String(it?.price || '').trim();
    const fp = fingerprint('intel', `${title}|${platform}|${price}`);
    if (seen.has(fp)) continue;
    seen.add(fp);
    deduped.push({ ...it, fp });
  }

  const verified = deduped.map((it) => ({ ...it, verified: false, verifyNotes: '未配置多源抓取，暂无法交叉核验', roi: '未知' }));

  const reportLines = [];
  reportLines.push('INTEL_REPORT');
  reportLines.push(`更新时间: ${formatTs(d)}`);
  reportLines.push('主题: 海外 RWA 与 AI 自动化 兼职情报');
  reportLines.push('');
  reportLines.push('摘要');
  reportLines.push('🔹 本轮采集: 0');
  reportLines.push('🔹 去重后: 0');
  reportLines.push('🔹 可核验: 0');
  reportLines.push('🔹 说明: 当前为落盘骨架。要启用真实情报抓取，需要主人指定数据源与网络通路。');
  reportLines.push('');
  reportLines.push('条目清单（去重 → 核验 → 收益率预估）');

  if (verified.length === 0) {
    reportLines.push('🔹 暂无条目');
  } else {
    for (const it of verified) {
      reportLines.push('');
      reportLines.push(`情报: ${it.title || '未命名'}`);
      reportLines.push(`去重: 指纹 ${it.fp}`);
      reportLines.push(`核验: ${it.verified ? '已核验' : '未核验'} | ${it.verifyNotes || ''}`);
      reportLines.push(`收益率: ${it.roi || '未知'}`);
      reportLines.push('结论: 观察');
    }
  }

  reportLines.push('');
  reportLines.push('风险提示');
  reportLines.push('🔹 未经核验的条目不得触发付款/签约');
  reportLines.push('🔹 涉及账号登录/预付费的条目默认可疑');
  reportLines.push('');
  reportLines.push('下一步建议');
  reportLines.push('🔹 主人指定 2-3 个固定数据源（平台+关键词）后再启用真实抓取');

  writeFileSafe(INTEL_REPORT_PATH, reportLines.join('\n') + '\n');

  const body = [
    '海外兼职资讯(落盘快照)',
    `时间: ${formatTs(d)}`,
    `条目数: ${verified.length}`,
    `报告: ${INTEL_REPORT_PATH}`,
  ].join('\n');
  writeFileSafe(file, body + '\n');
  writeHeartbeat('Cron:兼职资讯');
}

function runLongTermMemoryDaily() {
  const tName = '长期记忆_每日0点复盘';
  STATE.cron.lastRuns[tName] = formatTs(new Date());
  ensureLongTermDb();
  void runAutoDream();
  writeHeartbeat('Cron:长期记忆');
}

function scheduleAtNextMidnight(taskName, fn) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const ms = next.getTime() - now.getTime();
  STATE.cron.nextRuns[taskName] = formatTs(next);
  setTimeout(() => {
    fn();
    const every = 24 * 60 * 60 * 1000;
    setInterval(fn, every);
    const next2 = new Date(Date.now() + every);
    STATE.cron.nextRuns[taskName] = formatTs(next2);
  }, ms);
}

function computeNextDailyAt(hh, mm, offsetMin) {
  const now = Date.now();
  const offsetMs = Number(offsetMin || 0) * 60 * 1000;
  const tzNow = new Date(now + offsetMs);
  const tzNext = new Date(tzNow);
  tzNext.setHours(hh, mm, 0, 0);
  if (tzNext.getTime() <= tzNow.getTime()) tzNext.setDate(tzNext.getDate() + 1);
  return new Date(tzNext.getTime() - offsetMs);
}

function scheduleDailyAt(taskName, hh, mm, fn) {
  const scheduleOnce = () => {
    const next = computeNextDailyAt(hh, mm, OPENCLAW_TZ_OFFSET_MIN);
    STATE.cron.nextRuns[taskName] = formatTs(next);
    const ms = Math.max(500, next.getTime() - Date.now());
    setTimeout(() => {
      fn();
      scheduleOnce();
    }, ms);
  };
  scheduleOnce();
}

const FETCH_IMPL = (typeof fetch === 'function') ? fetch : require('undici').fetch;

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const resp = await FETCH_IMPL(url, { method: 'GET', signal: controller.signal, headers: { 'User-Agent': 'openclaw/1.0' } });
    const txt = await resp.text();
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
    return txt;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const txt = await fetchText(url);
  return JSON.parse(txt);
}

async function fetchBinary(url, maxBytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const resp = await FETCH_IMPL(url, { method: 'GET', signal: controller.signal, headers: { 'User-Agent': 'openclaw/1.0' } });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${t}`.slice(0, 300));
    }
    const ab = await resp.arrayBuffer();
    const buf = Buffer.from(ab);
    const limit = Number(maxBytes || 0);
    if (limit > 0 && buf.length > limit) throw new Error(`binary too large: ${buf.length}`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAiCompatibleTranscription(endpoint, apiKey, model, buf, filename, mime) {
  const url = String(endpoint || '').trim();
  if (!url) return null;
  const fd = new FormData();
  fd.append('model', String(model || 'whisper-1'));
  fd.append('file', new Blob([buf], { type: String(mime || 'audio/ogg') }), String(filename || 'audio.ogg'));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const headers = {};
    const key = String(apiKey || '').trim();
    if (key) headers.Authorization = `Bearer ${key}`;
    const resp = await FETCH_IMPL(url, { method: 'POST', body: fd, headers, signal: controller.signal });
    const txt = await resp.text();
    if (!resp.ok) throw new Error(`STT HTTP ${resp.status} ${txt}`.slice(0, 500));
    const j = JSON.parse(txt);
    const out = String(j?.text || '').trim();
    return out || null;
  } finally {
    clearTimeout(timer);
  }
}

function parseRssItems(xml, limit) {
  const s = String(xml || '');
  const items = [];
  const re = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const block = m[0];
    const t = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) || block.match(/<title>([\s\S]*?)<\/title>/i))?.[1];
    const l = (block.match(/<link>([\s\S]*?)<\/link>/i))?.[1];
    const title = String(t || '').replace(/\s+/g, ' ').trim();
    const link = String(l || '').trim();
    if (!title || !link) continue;
    items.push({ title, link });
    if (items.length >= limit) break;
  }
  return items;
}

function cleanNewsTitle(title) {
  const s = String(title || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.replace(/\s+-\s+[^-]{2,40}$/, '').trim();
}

function formatNum(n, digits) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return v.toFixed(typeof digits === 'number' ? digits : 2);
}

async function fetchCsv(url) {
  const txt = await fetchText(url);
  return String(txt || '').trim();
}

function parseCsvLatestValue(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const last = lines[lines.length - 1];
  const cols = last.split(',').map((c) => c.trim());
  if (cols.length < 2) return null;
  const date = cols[0];
  const val = Number(cols[1]);
  if (!Number.isFinite(val)) return null;
  return { date, value: val };
}

async function fetchFredLatest(seriesId) {
  const id = String(seriesId || '').trim();
  if (!id) return null;
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  const csv = await fetchCsv(url);
  return parseCsvLatestValue(csv);
}

async function fetchUsdMyr() {
  const r = await fetchUsdMyrWithFallback({ fetchJson }).catch(() => null);
  const fx = r && r.ok ? r.fx : null;
  return Number.isFinite(fx) ? fx : null;
}

async function fetchMetalsSpotUsd() {
  const out = { gold: null, silver: null };

  const xau = await fetchGoldSpotUsdWithFallback({ fetchJson }).catch(() => null);
  if (xau && xau.ok && Number.isFinite(xau.goldUsdPerOz)) out.gold = Number(xau.goldUsdPerOz);

  if (out.gold == null || out.silver == null) {
    try {
      const url = 'https://api.metals.live/v1/spot';
      const j = await fetchJson(url);
      if (Array.isArray(j)) {
        const map = {};
        for (const row of j) {
          if (!Array.isArray(row) || row.length < 2) continue;
          const k = String(row[0] || '').toLowerCase();
          const v = Number(row[1]);
          if (!k || !Number.isFinite(v)) continue;
          map[k] = v;
        }
        if (out.gold == null && Number.isFinite(map.gold)) out.gold = Number(map.gold);
        if (out.silver == null && Number.isFinite(map.silver)) out.silver = Number(map.silver);
      }
    } catch {}
  }

  if (out.gold == null && out.silver == null) return null;
  return out;
}

async function fetchCryptoUsd() {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
  const j = await fetchJson(url);
  const btc = j?.bitcoin?.usd;
  const btcChg = j?.bitcoin?.usd_24h_change;
  const eth = j?.ethereum?.usd;
  const ethChg = j?.ethereum?.usd_24h_change;
  return {
    btc: Number.isFinite(btc) ? btc : null,
    btcChg: Number.isFinite(btcChg) ? btcChg : null,
    eth: Number.isFinite(eth) ? eth : null,
    ethChg: Number.isFinite(ethChg) ? ethChg : null,
  };
}

async function fetchStooqLatest(symbol) {
  const s = String(symbol || '').trim().toLowerCase();
  if (!s) return null;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
  const csv = await fetchCsv(url);
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const cols = lines[1].split(',').map((c) => c.trim());
  if (cols.length < 8) return null;
  const date = cols[1] ? `${cols[0]} ${cols[1]}` : cols[0];
  const close = Number(cols[7]);
  return Number.isFinite(close) ? { date, close } : null;
}

async function getWeatherTawau() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=4.244&longitude=117.891&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FKuala_Lumpur';
  const j = await fetchJson(url);
  const c = j?.current || {};
  const t = c.temperature_2m;
  const h = c.relative_humidity_2m;
  const w = c.wind_speed_10m;
  return { t, h, w };
}

async function pickHeadline(query, options) {
  const q = String(query || '').trim();
  if (!q) return '';
  const hl = String(options?.hl || 'zh-CN');
  const gl = String(options?.gl || 'MY');
  const ceid = String(options?.ceid || `${gl}:zh-Hans`);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
  try {
    const xml = await fetchText(url);
    const items = parseRssItems(xml, 3);
    const t = cleanNewsTitle(items?.[0]?.title);
    return t || '';
  } catch {
    return '';
  }
}

async function pickWorldHeadlines(limit) {
  const n = Math.max(1, Number(limit || 0) || 6);
  try {
    const titles = [];

    const tryFeed = async (url) => {
      const xml = await fetchText(url);
      const items = parseRssItems(xml, n);
      for (const it of items || []) {
        const t0 = cleanNewsTitle(it?.title);
        const t = safeChineseOnly(t0, false);
        if (!t) continue;
        if (t === '（英文已屏蔽）') continue;
        if (/^[\s\W_]+$/.test(t)) continue;
        titles.push(t);
        if (titles.length >= n) break;
      }
    };

    await tryFeed('https://feeds.bbci.co.uk/zhongwen/simp/world/rss.xml').catch(() => {});
    if (titles.length < Math.min(3, n)) {
      await tryFeed('https://news.google.com/rss/headlines/section/topic/WORLD?hl=zh-CN&gl=CN&ceid=CN:zh-Hans').catch(() => {});
    }

    return titles.slice(0, n);
  } catch {
    return [];
  }
}

function hasLongEnglish(s) {
  const t = String(s || '');
  const words = t.match(/[A-Za-z]{4,}/g) || [];
  return words.some((w) => w.length >= 6) || words.length >= 3;
}

function safeChineseOnly(text, allowLatin) {
  const s = String(text || '').trim();
  if (!s) return s;
  const allowed = allowLatin
    ? /(BTC|ETH|USD|MYR|WTI|ETF|AI|Web3|Web4|NASDAQ|DJIA|HSI|S&P)/g
    : null;
  const masked = allowed ? s.replace(allowed, (m) => `§${m}§`) : s;
  const cleaned = masked.replace(/[A-Za-z]+/g, allowLatin ? '（英文已屏蔽）' : '');
  const unmasked = allowed ? cleaned.replace(/§/g, '') : cleaned;
  const compact = unmasked.replace(/（英文已屏蔽）{2,}/g, '（英文已屏蔽）');
  const final = compact.replace(/\s{2,}/g, ' ').trim();
  if (!final) return '（英文已屏蔽）';
  return final;
}

async function translateToChineseShort(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (!hasLongEnglish(s)) return s;
  const instr = [
    '把这句话翻译成中文。',
    '只输出中文翻译，不要输出原文英文，不要加解释。',
    '保留必要缩写/代码（BTC/ETH/USD/MYR/WTI/ETF/AI/Web3/Web4），其余英文专有名词尽量译成中文或音译。',
  ].join('\n');
  try {
    const out = await askHermes(`${instr}\n\n原文：${s}`, '银月', '', { channelId: STATE.discord.lastOwnerChannelId || '' });
    const outText = String(out || '').trim();
    if (isModelDownNoticeText(outText)) return safeChineseOnly(s, false);
    return safeChineseOnly(outText, false) || safeChineseOnly(s, false);
  } catch {
    return safeChineseOnly(s, false);
  }
}

function getTzNow() {
  const offsetMs = OPENCLAW_TZ_OFFSET_MIN * 60 * 1000;
  return new Date(Date.now() + offsetMs);
}

function toTzDate(d) {
  const offsetMs = OPENCLAW_TZ_OFFSET_MIN * 60 * 1000;
  return new Date(new Date(d).getTime() + offsetMs);
}

function formatYmd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function parseJsonlSince(filePath, sinceIso) {
  const raw = safeReadUtf8(filePath).trim();
  if (!raw) return [];
  const since = Date.parse(String(sinceIso || ''));
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l[0] !== '{') continue;
    try {
      const j = JSON.parse(l);
      const at = Date.parse(String(j?.at || ''));
      if (Number.isFinite(since) && Number.isFinite(at) && at < since) continue;
      out.push(j);
    } catch {}
  }
  return out;
}

function loadReminders() {
  const raw = readJsonSafe(REMINDERS_PATH);
  if (!raw || !Array.isArray(raw.items)) return [];
  return raw.items
    .map((it) => ({
      id: String(it?.id || '').trim(),
      channelId: String(it?.channelId || '').trim(),
      userId: String(it?.userId || '').trim(),
      message: String(it?.message || '').trim(),
      atIso: String(it?.atIso || '').trim(),
      done: Boolean(it?.done),
      source: String(it?.source || 'text').trim(),
      repeat: it?.repeat ? String(it.repeat).trim() : null,
      createdAt: String(it?.createdAt || '').trim(),
    }))
    .filter((it) => it.id && it.channelId && it.message && it.atIso);
}

function saveReminders(items) {
  const payload = {
    updatedAt: new Date().toISOString(),
    items: Array.isArray(items) ? items : [],
  };
  writeFileSafe(REMINDERS_PATH, JSON.stringify(payload, null, 2) + '\n');
}

function scheduleReminder(item, client) {
  const id = String(item?.id || '').trim();
  if (!id || !client) return;
  const at = Date.parse(String(item?.atIso || ''));
  if (!Number.isFinite(at)) return;

  const delay = Math.max(0, at - Date.now());
  if (STATE.reminders.timersById[id]) {
    try { clearTimeout(STATE.reminders.timersById[id]); } catch {}
  }

  STATE.reminders.timersById[id] = setTimeout(async () => {
    try {
      const list = loadReminders();
      const cur = list.find((x) => x.id === id);
      if (!cur || cur.done) return;
      const ch = client.channels?.cache?.get(cur.channelId) || (await client.channels.fetch(cur.channelId).catch(() => null));
      if (ch && typeof ch.send === 'function') {
        const ping = cur.userId ? `<@${cur.userId}> ` : '';
        await ch.send(`⏰ 提醒到点\n🔹 ${ping}${cur.message}`);
      }
      cur.done = true;
      cur.doneAt = new Date().toISOString();
      saveReminders(list);

      if (cur.repeat === 'daily') {
        const next = new Date(Date.parse(cur.atIso));
        next.setUTCDate(next.getUTCDate() + 1);
        const nextItem = {
          ...cur,
          id: fingerprint('reminder', `${cur.channelId}|${cur.userId || ''}|${next.toISOString()}|daily|${cur.message}|${Date.now()}`),
          atIso: next.toISOString(),
          done: false,
          createdAt: new Date().toISOString(),
        };
        list.push(nextItem);
        saveReminders(list);
        scheduleReminder(nextItem, client);
      }
    } catch (e) {
      logErrorEvent('reminder', 'send failed', e?.message || e, { where: 'scheduleReminder' });
    } finally {
      try { delete STATE.reminders.timersById[id]; } catch {}
    }
  }, delay);
}

function cancelReminderById(id, opts) {
  const rid = String(id || '').trim();
  if (!rid) return { ok: false, reason: 'missing_id' };
  const list = loadReminders();
  const cur = list.find((x) => x.id === rid);
  if (!cur) return { ok: false, reason: 'not_found' };
  if (cur.done) return { ok: false, reason: 'already_done' };
  cur.done = true;
  cur.doneAt = new Date().toISOString();
  cur.doneReason = String(opts?.reason || 'cancel').slice(0, 40);
  saveReminders(list);
  if (STATE.reminders.timersById[rid]) {
    try { clearTimeout(STATE.reminders.timersById[rid]); } catch {}
    try { delete STATE.reminders.timersById[rid]; } catch {}
  }
  return { ok: true, item: cur };
}

function cancelRecentReminder(channelId, userId, withinMs) {
  const list = loadReminders();
  const hit = selectRecentPendingReminder(list, {
    channelId,
    userId,
    nowMs: Date.now(),
    withinMs: Number(withinMs || 5 * 60 * 1000),
  });
  if (!hit) return { ok: false, reason: 'not_found' };
  return cancelReminderById(hit.id, { reason: 'cancel_recent' });
}

function listPendingReminders(channelId, userId, limit) {
  const list = loadReminders();
  const cid = String(channelId || '').trim();
  const uid = String(userId || '').trim();
  const pending = list
    .filter((x) => x && !x.done)
    .filter((x) => (!cid || String(x.channelId || '').trim() === cid))
    .filter((x) => (!uid || String(x.userId || '').trim() === uid))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return pending.slice(0, Number(limit || 6));
}

function restoreReminderTimers(client) {
  const list = loadReminders();
  for (const it of list) {
    if (it.done) continue;
    scheduleReminder(it, client);
  }
}

function createReminderFromText(channelId, userId, text, source) {
  const cid = String(channelId || '').trim();
  if (!cid) return { ok: false, reason: 'missing_channel' };
  const parsed = parseReminderIntent(text, new Date(), OPENCLAW_TZ_OFFSET_MIN);
  if (!parsed.ok) return { ok: false, needTime: Boolean(parsed.needTime) };

  const repeat = String(parsed.repeat || '').trim() || null;
  const id = fingerprint('reminder', `${cid}|${userId || ''}|${parsed.whenAt.toISOString()}|${repeat || ''}|${parsed.message}|${Date.now()}`);
  const item = {
    id,
    channelId: cid,
    userId: String(userId || '').trim(),
    message: String(parsed.message || '').trim(),
    atIso: parsed.whenAt.toISOString(),
    source: String(source || 'text'),
    repeat,
    done: false,
    createdAt: new Date().toISOString(),
  };
  const list = loadReminders();
  list.push(item);
  saveReminders(list);
  const client = STATE.discord.client;
  if (client) scheduleReminder(item, client);
  return { ok: true, item };
}

function summarizeDropboxDeliveriesToday() {
  const tzNow = getTzNow();
  const startTz = new Date(tzNow);
  startTz.setHours(0, 0, 0, 0);
  const sinceIso = new Date(startTz.getTime() - OPENCLAW_TZ_OFFSET_MIN * 60 * 1000).toISOString();
  const rows = parseJsonlSince(DROPBOX_DELIVERIES_LOG, sinceIso);
  const byAgent = {};
  for (const r of rows) {
    const p = String(r?.deliveryFile || '').replace(/\\/g, '/');
    const m = p.match(/\/DROPBOX\/([^/]+)\//i);
    const agent = m ? m[1] : '未知';
    const name = path.basename(p);
    if (!byAgent[agent]) byAgent[agent] = [];
    byAgent[agent].push(name);
  }
  return byAgent;
}

function getDropboxDeliveriesTodayDetails() {
  const tzNow = getTzNow();
  const startTz = new Date(tzNow);
  startTz.setHours(0, 0, 0, 0);
  const sinceIso = new Date(startTz.getTime() - OPENCLAW_TZ_OFFSET_MIN * 60 * 1000).toISOString();
  const rows = parseJsonlSince(DROPBOX_DELIVERIES_LOG, sinceIso);

  const byAgent = {};
  for (const r of rows) {
    const pRaw = String(r?.deliveryFile || '');
    if (!pRaw) continue;
    const p = pRaw.replace(/\\/g, '/');
    const m = p.match(/\/DROPBOX\/([^/]+)\//i);
    const agent = m ? m[1] : '未知';
    const name = path.basename(p);
    const rel = `DROPBOX/${path.relative(DROPBOX_DIR, pRaw).replace(/\\/g, '/')}`;
    if (!byAgent[agent]) byAgent[agent] = [];
    byAgent[agent].push({ name, relPath: rel, absPath: pRaw });
  }

  const agents = Object.keys(byAgent)
    .sort()
    .map((a) => {
      const items = byAgent[a] || [];
      const existing = items.filter((it) => it?.absPath && fs.existsSync(it.absPath));
      return {
        agent: a,
        count: existing.length,
        recent: existing.slice(-6).map((it) => ({ name: it.name, relPath: it.relPath })),
      };
    });

  return { at: formatTs(tzNow), agents };
}

function getErrorsTodaySummary() {
  const tzNow = getTzNow();
  const startTz = new Date(tzNow);
  startTz.setHours(0, 0, 0, 0);
  const sinceIso = new Date(startTz.getTime() - OPENCLAW_TZ_OFFSET_MIN * 60 * 1000).toISOString();
  const rows = parseJsonlSince(ERRORS_LOG_PATH, sinceIso);

  const byCat = {};
  let lastAt = null;
  for (const r of rows) {
    const cat = String(r?.category || 'unknown');
    if (!byCat[cat]) byCat[cat] = { count: 0, lastAt: null, sample: null };
    byCat[cat].count += 1;
    const at = String(r?.at || '');
    if (at && (!byCat[cat].lastAt || at > byCat[cat].lastAt)) {
      byCat[cat].lastAt = at;
      const msg = String(r?.message || '').trim();
      byCat[cat].sample = msg ? msg.slice(0, 160) : null;
    }
    if (at && (!lastAt || at > lastAt)) lastAt = at;
  }

  const categories = Object.keys(byCat)
    .sort()
    .map((k) => ({ category: k, count: byCat[k].count, lastAt: byCat[k].lastAt, sample: byCat[k].sample }));

  return { at: formatTs(tzNow), total: rows.length, lastAt, categories };
}

function buildAgentMorningTasksBlock(deliveriesByAgent) {
  const tasks = {
    '银月': '晨报/夜报 + 假路径门禁 + 语音转写稳定',
    '李长寿': '技术修复/脚本交付/环境巡检',
    '墨影': '本机体检 + 性能/代理/端口巡检',
    '美杜莎': 'UI尺寸规范/落地页/组件实现（按派单）',
    '雅妃': '财务/报价/对账（按派单）',
    '萧炎': '行情观察/信号记录（按派单）',
    '韩立': '资讯检索/来源验证（按派单）',
    '药老': '文案/脚本/长文输出（按派单）',
    '小医仙': '社媒线索/投放素材（按派单）',
    '紫灵': '对话编排/需求澄清（按派单）',
    '紫研': '数字化/表格/数据整理（按派单）',
  };
  const names = Object.keys(tasks);
  const lines = [];
  lines.push('🧩 08:00 内阁任务报告');
  lines.push('');
  for (const n of names) {
    const delivered = deliveriesByAgent?.[safePathSegment(n)] || deliveriesByAgent?.[n] || [];
    const d = Array.isArray(delivered) && delivered.length ? `（昨日交付 ${delivered.length}）` : '';
    lines.push(`🔹 ${n}${d}：${tasks[n]}`);
  }
  return lines.join('\n');
}

async function handleRemind(msg, content) {
  if (!isOwnerOrAdmin(msg)) return { handled: true, reply: '⚠️ 主人\n🔹 remind 仅允许主人/管理员触发\n🔹 已拒绝执行' };
  const s = String(content || '').trim();
  const cid = msg.channelId;
  const uid = msg.author?.id || '';
  const parts = s.split(/\s+/);
  const sub = String(parts[1] || '').toLowerCase();

  if (!sub || sub === 'help') {
    return {
      handled: true,
      reply: [
        '✅ 主人',
        '🔹 用法：',
        '🔹 !remind <提醒语句>（创建）',
        '🔹 !remind list',
        '🔹 !remind cancel last',
        '🔹 !remind cancel <编号前8位>',
      ].join('\n'),
    };
  }

  if (sub === 'list') {
    const pending = listPendingReminders(cid, uid, 6);
    if (!pending.length) return { handled: true, reply: '✅ 主人\n🔹 当前没有未完成提醒' };
    const lines = [];
    lines.push('🗓️ 未完成提醒（最多6条）');
    for (const it of pending) {
      const id8 = String(it.id || '').slice(0, 8);
      const timeText = formatTs(toTzDate(new Date(Date.parse(it.atIso))));
      const rep = it.repeat === 'daily' ? '（每天）' : '';
      lines.push(`🔹 ${id8}｜${timeText}${rep}｜${it.message}`);
    }
    return { handled: true, reply: lines.join('\n') };
  }

  if (sub === 'cancel') {
    const arg = String(parts[2] || 'last').trim();
    if (!arg || /^(last|刚才|最近)$/.test(arg)) {
      const r = cancelRecentReminder(cid, uid, 5 * 60 * 1000);
      if (!r.ok) return { handled: true, reply: '⚠️ 主人\n🔹 未找到“刚才”的提醒\n🔹 你可以用：!remind list' };
      return { handled: true, reply: `✅ 已取消\n🔹 编号：${String(r.item.id || '').slice(0, 8)}\n🔹 内容：${r.item.message}` };
    }
    const list = loadReminders();
    const hit = selectPendingReminderByIdPrefix(list, { channelId: cid, userId: uid, prefix: arg });
    if (!hit) return { handled: true, reply: '⚠️ 主人\n🔹 未找到该编号的未完成提醒\n🔹 你可以用：!remind list' };
    const r = cancelReminderById(hit.id, { reason: 'cancel_by_prefix' });
    if (!r.ok) return { handled: true, reply: '⚠️ 主人\n🔹 取消失败（可能已到点或已取消）' };
    return { handled: true, reply: `✅ 已取消\n🔹 编号：${String(r.item.id || '').slice(0, 8)}\n🔹 内容：${r.item.message}` };
  }

  const raw = s.replace(/^[!！:]remind\s*/i, '').trim();
  const created = createReminderFromText(cid, uid, raw, 'text');
  if (created.ok) {
    const timeText = formatTs(toTzDate(new Date(created.item.atIso)));
    return {
      handled: true,
      reply: [
        '✅ 已创建提醒',
        `🔹 时间：${timeText}${created.item.repeat === 'daily' ? '（每天）' : ''}`,
        `🔹 内容：${created.item.message}`,
        `🔹 编号：${created.item.id.slice(0, 8)}`,
      ].join('\n'),
    };
  }
  if (created.needTime) {
    return {
      handled: true,
      reply: [
        '⚠️ 主人',
        '🔹 还缺提醒时间',
        '🔹 示例：30分钟后提醒我发邮件 / 今天 23:10 提醒我提交日报 / 每天 09:00 提醒我复盘',
      ].join('\n'),
    };
  }
  return { handled: true, reply: '⚠️ 主人\n🔹 创建提醒失败' };
}

function buildAgentSelfCheckBlock(deliveriesByAgent) {
  const names = ['银月', '李长寿', '墨影', '美杜莎', '雅妃', '萧炎', '韩立', '药老', '小医仙', '紫灵', '紫研'];
  const lines = [];
  lines.push('🪞 内阁自检（每人 1 句）');
  for (const n of names) {
    const key1 = safePathSegment(n);
    const arr = deliveriesByAgent?.[key1] || deliveriesByAgent?.[n] || [];
    const c = Array.isArray(arr) ? arr.length : 0;
    const msg =
      c > 0
        ? '今天有可验收交付，明天继续减少废话、增加证据与产物。'
        : '今天交付为 0，明天必须先交付再解释，杜绝空转。';
    lines.push(`🔹 ${n}：${msg}`);
  }
  return lines.join('\n');
}

async function buildMorningBrief() {
  const tzNow = getTzNow();
  const ymd = formatYmd(tzNow);
  const fileName = `${ymd}_早报.md`;
  const briefCache = readJsonSafe(BRIEF_CACHE_PATH) || {};

  const parts = [];
  parts.push('📣 银月情报局 | 斗湖早报');
  parts.push(`（生成时间：${formatTs(tzNow)}）`);
  parts.push('');

  const w = await getWeatherTawau().catch(() => null);
  const temp = typeof w?.t === 'number' ? `${formatNum(w.t, 1)}℃` : '未知';
  const hum = typeof w?.h === 'number' ? `${formatNum(w.h, 0)}%` : '未知';
  parts.push('⛅ 斗湖天气与本地新闻');
  parts.push(`🌡️ 气温：${temp} / 湿度：${hum}`);
  parts.push('⚠️ 警示：暂无（如遇强降雨/雷暴，请注意出行与用电安全）');
  const localRaw = await pickHeadline('斗湖', { hl: 'zh-CN', gl: 'MY', ceid: 'MY:zh-Hans' });
  const local = await translateToChineseShort(localRaw || '');
  const localText = safeChineseOnly(local || '', false);
  if (localText) {
    parts.push(`🗞️ 本地：${localText}`);
    briefCache.local = localText;
  } else if (briefCache.local) {
    parts.push(`🗞️ 本地：${briefCache.local}（缓存）`);
  } else {
    parts.push('🗞️ 本地：暂无（网络不可用）');
  }
  parts.push('');

  parts.push('🌍 国际新闻（全球要闻）');
  const world = await pickWorldHeadlines(6).catch(() => []);
  if (Array.isArray(world) && world.length) {
    const top = world.slice(0, 6);
    for (const t of top) parts.push(`🔸 ${t}`);
    briefCache.world = top;
  } else if (Array.isArray(briefCache.world) && briefCache.world.length) {
    const top = briefCache.world.slice(0, 6);
    for (const t of top) parts.push(`🔸 ${t}（缓存）`);
  } else {
    parts.push('🔸 暂缺（网络不可用）');
  }
  parts.push('');

  const [fx, metals, wti, crypto] = await Promise.all([
    fetchUsdMyr().catch(() => null),
    fetchMetalsSpotUsd().catch(() => null),
    fetchFredLatest('DCOILWTICO').catch(() => null),
    fetchCryptoUsd().catch(() => null),
  ]);

  parts.push('💰 金融/贵金属（实时数据）');
  if (metals?.gold) {
    briefCache.gold = Number(metals.gold);
    parts.push(`🥇 国际黄金：$${formatNum(metals.gold, 2)}`);
  } else if (typeof briefCache.gold === 'number') {
    parts.push(`🥇 国际黄金：$${formatNum(briefCache.gold, 2)}（缓存）`);
  } else {
    parts.push('🥇 国际黄金：暂无（网络不可用）');
  }
  if (fx) {
    briefCache.fx = Number(fx);
    parts.push(`💱 马币汇率：美元/马币 ${formatNum(fx, 4)}`);
  } else if (typeof briefCache.fx === 'number') {
    parts.push(`💱 马币汇率：美元/马币 ${formatNum(briefCache.fx, 4)}（缓存）`);
  } else {
    parts.push('💱 马币汇率：暂无（网络不可用）');
  }
  const goldUsd = metals?.gold ? Number(metals.gold) : (typeof briefCache.gold === 'number' ? Number(briefCache.gold) : null);
  const usdMyr = fx ? Number(fx) : (typeof briefCache.fx === 'number' ? Number(briefCache.fx) : null);
  if (Number.isFinite(goldUsd) && Number.isFinite(usdMyr)) {
    const myrPerOz = goldUsd * usdMyr;
    const myrPerG = myrPerOz / 31.1034768;
    parts.push(`🥇 本地黄金（估算）：RM${formatNum(myrPerG, 2)}/g（999.9）`);
  }
  if (wti?.value) {
    briefCache.wti = Number(wti.value);
    parts.push(`🛢️ 原油（WTI）：$${formatNum(wti.value, 2)}`);
  } else if (typeof briefCache.wti === 'number') {
    parts.push(`🛢️ 原油（WTI）：$${formatNum(briefCache.wti, 2)}（缓存）`);
  } else {
    parts.push('🛢️ 原油（WTI）：暂无（网络不可用）');
  }
  if (crypto?.btc) {
    const btcChg = crypto.btcChg === null ? '' : `（24小时 ${formatNum(crypto.btcChg, 2)}%）`;
    briefCache.btc = Number(crypto.btc);
    briefCache.btcChg = crypto.btcChg === null ? null : Number(crypto.btcChg);
    parts.push(`₿ 加密货币：比特币 $${formatNum(crypto.btc, 0)} ${btcChg}`.trim());
  } else if (typeof briefCache.btc === 'number') {
    const btcChg = briefCache.btcChg == null ? '' : `（24小时 ${formatNum(briefCache.btcChg, 2)}%）`;
    parts.push(`₿ 加密货币：比特币 $${formatNum(briefCache.btc, 0)} ${btcChg}（缓存）`.trim());
  } else {
    parts.push('₿ 加密货币：暂无（网络不可用）');
  }
  parts.push('');

  parts.push('🚀 Web4.0 & 科技前沿');
  const techRaw = await pickHeadline('科技 前沿 人工智能', { hl: 'zh-CN', gl: 'MY', ceid: 'MY:zh-Hans' });
  const tech = await translateToChineseShort(techRaw || '');
  const techText = safeChineseOnly(tech || '', false);
  if (techText) {
    parts.push(`🤖 人工智能：${techText}`);
    briefCache.tech = techText;
  } else if (briefCache.tech) {
    parts.push(`🤖 人工智能：${briefCache.tech}（缓存）`);
  } else {
    parts.push('🤖 人工智能：暂无（网络不可用）');
  }
  parts.push('');

  parts.push('📈 创投动态');
  const invRaw = await pickHeadline('融资 创投 科技', { hl: 'zh-CN', gl: 'MY', ceid: 'MY:zh-Hans' });
  const inv = await translateToChineseShort(invRaw || '');
  const invText = safeChineseOnly(inv || '', false);
  if (invText) {
    parts.push(`💼 融资：${invText}`);
    briefCache.invest = invText;
  } else if (briefCache.invest) {
    parts.push(`💼 融资：${briefCache.invest}（缓存）`);
  } else {
    parts.push('💼 融资：暂无（网络不可用）');
  }
  parts.push('');

  parts.push(`📄 简报归档：${fileName}`);

  const body = safeChineseOnly(parts.join('\n').trim(), false);
  const abs = path.join(CRON_DIR, fileName);
  writeFileSafe(abs, body + '\n');
  writeFileSafe(BRIEF_CACHE_PATH, JSON.stringify(briefCache, null, 2) + '\n');
  return body;
}

async function runSilverMoonMorningBrief(opts) {
  const tName = '银月_每日08点晨报';
  STATE.cron.lastRuns[tName] = formatTs(new Date());
  try {
    await selfCheckConnectivity();
    const needProxy = shouldUseProxy() && process.env.USE_PROXY !== '0';
    if (needProxy && STATE.selfCheck?.proxy?.ok === false) {
    }

    const force = Boolean(opts?.force);
    const tzNow = getTzNow();
    const ymd = formatYmd(tzNow);
    const marker = path.join(CRON_DIR, `${ymd}_早报.sent`);
    if (!force && fs.existsSync(marker)) {
      writeHeartbeat('Cron:晨报已发');
      return { ok: true, skipped: true };
    }

    const text = await buildMorningBrief();
    const includeTasks = String(process.env.OPENCLAW_BRIEF_INCLUDE_TASKS || '0').trim() === '1';
    const body = includeTasks
      ? (() => {
          const deliveries = summarizeDropboxDeliveriesToday();
          const tasks = buildAgentMorningTasksBlock(deliveries);
          return [text, '', tasks].join('\n');
        })()
      : text;
    await notifyOwner(body);
    writeFileSafe(marker, `sentAt=${new Date().toISOString()}\n`);
    writeHeartbeat('Cron:晨报');
    return { ok: true, skipped: false };
  } catch {
    writeHeartbeat('Cron:晨报失败');
    return { ok: false, skipped: false };
  }
}

function buildNightlyReport() {
  const d = new Date();
  const parts = [];
  const tzNow = getTzNow();
  const deliveries = summarizeDropboxDeliveriesToday();

  parts.push('🌙 银月夜报 | 今日汇总（23:55）');
  parts.push(`时间：${formatTs(tzNow)}`);
  parts.push('');

  parts.push('✅ 今日交付（按内阁）');
  const keys = Object.keys(deliveries || {});
  if (!keys.length) {
    parts.push('🔹 今日未记录到可验收的 DROPBOX 交付');
  } else {
    for (const k of keys.slice(0, 12)) {
      const arr = deliveries[k] || [];
      const tail = arr.slice(-2).join('、');
      parts.push(`🔹 ${k}：${arr.length} 份${tail ? `（最近：${tail}）` : ''}`);
    }
  }
  parts.push('');

  parts.push('🛡️ 墨影体检（本机/服务）');
  const mu = process.memoryUsage();
  parts.push(`🔹 代理：${STATE.selfCheck?.proxy?.ok ? '连通/不需要' : '不可用'}（${STATE.selfCheck?.proxy?.detail || '无'}）`);
  parts.push(`🔹 Ollama：${STATE.selfCheck?.ollama?.ok ? '在线' : '离线'}（${STATE.selfCheck?.ollama?.detail || '无'}）`);
  parts.push(`🔹 模型成功：${STATE.ollama.lastOkAt || '无'} | 错误：${STATE.ollama.lastErrAt || '无'}`);
  parts.push(`🔹 内存：RSS ${Math.round(mu.rss / 1024 / 1024)}MB | HeapUsed ${Math.round(mu.heapUsed / 1024 / 1024)}MB`);
  parts.push(`🔹 锁：finance=${STATE.locks?.finance?.locked ? '占用' : '空闲'} staff=${STATE.locks?.staff?.locked ? '占用' : '空闲'} codex=${STATE.locks?.codex?.locked ? '占用' : '空闲'}`);
  parts.push('');

  parts.push('🧩 未完成/风险');
  parts.push(`🔹 待补档案：${listPendingAgentFiles().length}`);
  parts.push(`🔹 STAFF_REQUESTS：${fs.existsSync(STAFF_REQUESTS_PATH) ? '存在' : '缺失'}`);
  parts.push(`🔹 LEADS：${fs.existsSync(LEADS_PATH) ? '存在' : '缺失'}`);
  parts.push('');

  parts.push('🪞 内阁自检：已省略（防串台/串文）');
  parts.push('');

  parts.push('🧑‍🤝‍🧑 需要补强（技能/助手）');
  parts.push(`🔹 语音转写：需要配置 OPENCLAW_ZERO_TOKEN_URL(+TOKEN) 或 OPENAI_API_KEY（否则只能提示未配置）`);
  parts.push(`🔹 搜索：如需更稳定，配置 SEARXNG_URL 或启用可用代理`);

  const fileName = `${formatYmd(tzNow)}_夜报.md`;
  writeFileSafe(path.join(CRON_DIR, fileName), safeChineseOnly(parts.join('\n').trim()) + '\n');
  return safeChineseOnly(parts.join('\n').trim());
}

async function runSilverMoonNightlyReport() {
  const tName = '银月_每日23点55汇总';
  STATE.cron.lastRuns[tName] = formatTs(new Date());
  try {
    await notifyOwner(buildNightlyReport());
    writeHeartbeat('Cron:夜报');
  } catch {
    writeHeartbeat('Cron:夜报失败');
  }
}

function scheduleEveryHours(taskName, hours, fn, runImmediately) {
  const ms = hours * 60 * 60 * 1000;
  const next = new Date(Date.now() + ms);
  STATE.cron.nextRuns[taskName] = formatTs(next);
  if (runImmediately) fn();
  setInterval(() => {
    fn();
    STATE.cron.nextRuns[taskName] = formatTs(new Date(Date.now() + ms));
  }, ms);
}

function initCronJobs() {
  const t1 = '雅妃_每日0点财务报表';
  const t2 = '韩立_每4小时海外兼职资讯';
  const t3 = '史官_AutoDream_24h记忆复盘';
  const t4 = '长期记忆_每日0点复盘';
  const t5 = '银月_每日08点晨报';
  const t6 = '银月_每日23点55汇总';
  STATE.cron.tasks = [t1, t2, t3, t4, t5, t6];
  scheduleAtNextMidnight(t1, runYaFeiDailyReport);
  scheduleAtNextMidnight(t4, runLongTermMemoryDaily);
  scheduleDailyAt(t5, MORNING_BRIEF_HH, MORNING_BRIEF_MM, () => { void runSilverMoonMorningBrief({ source: 'cron' }); });
  scheduleDailyAt(t6, NIGHTLY_REPORT_HH, NIGHTLY_REPORT_MM, () => { void runSilverMoonNightlyReport(); });
  const tzNow = new Date(Date.now() + OPENCLAW_TZ_OFFSET_MIN * 60 * 1000);
  if (!STATE.cron.lastRuns[t5] && tzNow.getHours() >= MORNING_BRIEF_HH && tzNow.getHours() < (MORNING_BRIEF_HH + 3)) {
    void runSilverMoonMorningBrief({ source: 'startup_catchup' });
  }
  scheduleEveryHours(t2, 4, runHanLiJobIntel, true);
  scheduleEveryHours(t3, 24, () => { void runAutoDream(); }, false);
  STATE.memory.nextAutoDreamAt = STATE.cron.nextRuns[t3] || STATE.memory.nextAutoDreamAt;
  startDispatchConsumer(STATE);
  setInterval(() => writeHeartbeat('心跳'), 60 * 1000);
}

main().catch((e) => {
  console.error('[fatal]', e?.message || e);
  process.exit(1);
});
