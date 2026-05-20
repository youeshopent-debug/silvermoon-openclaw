const path = require('path');

/**
 * 统一管理环境变量与常量
 */
const WORKSPACE_DIR = path.join(__dirname, '..', 'workspace');
const USER_DATA_DIR = path.join(__dirname, '..', 'user_data');
const LOCKS_DIR = path.join(WORKSPACE_DIR, '.locks');
const CRON_DIR = path.join(WORKSPACE_DIR, 'CRON');
const CASHCLAW_DIR = path.join(WORKSPACE_DIR, 'CASHCLAW');
const DROPBOX_DIR = path.join(WORKSPACE_DIR, 'DROPBOX');

const CONFIG = {
  // 路径常量
  paths: {
    workspace: WORKSPACE_DIR,
    userData: USER_DATA_DIR,
    cron: CRON_DIR,
    cashclaw: CASHCLAW_DIR,
    dropbox: DROPBOX_DIR,
    locks: LOCKS_DIR,
    memorySqlite: path.join(USER_DATA_DIR, 'memory', 'silvermoon_memory.sqlite'),
    stripeEvents: path.join(CASHCLAW_DIR, 'stripe.events.jsonl'),
    langModeMap: path.join(WORKSPACE_DIR, 'CHANNEL_LANG_MODE.json'),
    ownerContext: path.join(USER_DATA_DIR, 'owner_context.json'),
    errorsLog: path.join(CRON_DIR, 'errors.jsonl'),
  },

  // 超时与限制
  limits: {
    ollamaTimeout: Number(process.env.OLLAMA_TIMEOUT_MS || 30_000),
    cloudTimeout: Number(process.env.CLOUD_TIMEOUT_MS || 30_000),
    discordMaxUpload: Number(process.env.DISCORD_MAX_UPLOAD_BYTES || 8 * 1024 * 1024),
    latencyWarnMs: Number(process.env.LATENCY_WARN_MS || 2500),
  },

  // 业务常量
  business: {
    tzOffsetMin: Number(process.env.OPENCLAW_TZ_OFFSET_MIN || 480),
    morningBriefHH: Number(process.env.MORNING_BRIEF_HH || 8),
    morningBriefMM: Number(process.env.MORNING_BRIEF_MM || 0),
    nightlyReportHH: Number(process.env.NIGHTLY_REPORT_HH || 23),
    nightlyReportMM: Number(process.env.NIGHTLY_REPORT_MM || 55),
    wakeWords: (process.env.JARVIS_WAKE_WORDS || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  // 核心技能
  coreSkills: [
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
  ],

  // API 密钥 (仅映射，不硬编码)
  keys: {
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    groqApiKey: process.env.GROQ_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    ownerUserId: process.env.OWNER_USER_ID,
  }
};

module.exports = CONFIG;
