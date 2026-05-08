process.env.TZ = 'Asia/Kuala_Lumpur';
const _tzCheck = new Date();
const _tzHour = Number(_tzCheck.toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false }));
const _tzMinute = Number(_tzCheck.toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', minute: '2-digit', hour12: false }));
const _tzTotalMin = _tzHour * 60 + _tzMinute;
process.env.__OPENCLAW_TZ_VERIFIED__ = String(_tzTotalMin);

// ── 提前加载 .env（daemon 和 child 都需要） ──
const _fs2 = require('fs');
const _path2 = require('path');
const _envFile = _path2.join(__dirname, '.env');
if (_fs2.existsSync(_envFile)) {
  const _envContent = _fs2.readFileSync(_envFile, 'utf8');
  for (const _line of _envContent.split('\n')) {
    const _trimmed = _line.trim();
    if (!_trimmed || _trimmed.startsWith('#')) continue;
    const _eqIdx = _trimmed.indexOf('=');
    if (_eqIdx === -1) continue;
    const _key = _trimmed.substring(0, _eqIdx).trim();
    const _val = _trimmed.substring(_eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (_key && !process.env[_key]) process.env[_key] = _val;
  }
  console.log('[env] 已加载', _envFile);
}

const IS_REQUIRED = require.main !== module;

// ═══════════════════════════════════════════════════════════
// 自愈守护进程 — 银月断线自动重启
// ═══════════════════════════════════════════════════════════
// 原理：子进程退出后，父进程自动重新 spawn
// 只在直接运行时启用（非 require 且非子进程模式）
if (!IS_REQUIRED && !process.env.__SILVERMOON_CHILD__) {
  const _child = require('child_process');
  const _fs2 = require('fs');
  const _path2 = require('path');

  // ── 守护进程静默：所有日志写入文件，不输出到终端 ──
  const _daemonLog = _path2.join(__dirname, 'logs', 'daemon.log');
  const _daemonErr = console.error;
  console.error = function(...args) {
    try {
      const _m = args.map(a => typeof a === 'string' ? a : (a?.message || JSON.stringify(a))).join(' ');
      if (_m) _fs2.appendFileSync(_daemonLog, `[${new Date().toISOString()}] ${_m}\n`, 'utf8');
    } catch {}
  };

  // ── 进程锁：防止多实例 ──
  const _lockFile = _path2.join(__dirname, 'logs', 'gateway.lock');
  function _checkLock() {
    try {
      if (_fs2.existsSync(_lockFile)) {
        const pid = parseInt(_fs2.readFileSync(_lockFile, 'utf8').trim());
        if (pid && !isNaN(pid)) {
          try {
            process.kill(pid, 0);
            console.error(`[守护] 已有实例运行 (PID=${pid})，退出`);
            process.exit(0);
          } catch {
            _fs2.unlinkSync(_lockFile);
          }
        }
      }
      _fs2.writeFileSync(_lockFile, String(process.pid));
    } catch (e) {
      console.error('[守护] 锁文件操作失败:', e.message);
    }
  }
  process.on('exit', () => { try { _fs2.unlinkSync(_lockFile); } catch {} });
  process.on('SIGINT', () => { process.exit(0); });
  process.on('SIGTERM', () => { process.exit(0); });
  _checkLock();

  const _spawnSelf = () => {
    const _env = {
      ...process.env,
      __SILVERMOON_CHILD__: '1',
      __SILVERMOON_PARENT_PID__: String(process.pid),
    };
    const _logStream = _fs2.createWriteStream(_path2.join(__dirname, 'logs', 'child.log'), { flags: 'a' });
    const _proc = _child.spawn(process.argv[0], [__filename], {
      env: _env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      windowsHide: true,
    });

    const _childLock = _path2.join(__dirname, 'logs', `child_${_proc.pid}.lock`);
    _fs2.writeFileSync(_childLock, String(_proc.pid));

    _proc.stdout.on('data', (d) => { _logStream.write(`[stdout] ${d}`); process.stdout.write(`[child:stdout] ${d}`); });
    _proc.stderr.on('data', (d) => { _logStream.write(`[stderr] ${d}`); process.stderr.write(`[child:stderr] ${d}`); });

    _proc.on('exit', (code, sig) => {
      // 检查 child_*.lock 是否已被清理（被 ensureSingleInstance kill 的）
      const _lockGone = !_fs2.existsSync(_childLock);
      try { _fs2.unlinkSync(_childLock); } catch {}
      const sigInfo = sig ? ` signal=${sig}` : '';
      _logStream.write(`[守护] 子进程退出 (code=${code}${sigInfo})\n`);
      _logStream.end();
      if (code === 0 && !sig) {
        console.error('[守护] 子进程正常退出，不重启');
        return;
      }
      if (_lockGone) {
        console.error('[守护] 子进程被外部终止（lock 已被清理），不重启');
        return;
      }
      console.error(`[守护] 子进程异常退出 (code=${code}${sigInfo})，5秒后重启`);
      setTimeout(_spawnSelf, 5000);
    });

    _proc.on('error', (err) => {
      try { _fs2.unlinkSync(_childLock); } catch {}
      console.error(`[守护] 子进程错误: ${err.message}，5秒后重启`);
      _logStream.end();
      setTimeout(_spawnSelf, 5000);
    });

    console.error(`[守护] 银月子进程已启动 (PID=${_proc.pid})`);
  };
  console.error('[守护] 银月守护进程启动中...');
  _spawnSelf();
  // 守护进程永不退出，阻止继续执行 main()
  setInterval(() => {}, 1 << 30);
  return;
}
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// .env 自动加载 — 持久化环境变量（银月钱庄专用）
// ═══════════════════════════════════════════════════════════
// 注意：.env 中只用 OPENCLAW_PROXY_URL，不用 HTTP_PROXY
// 因为 node-telegram-bot-api 的 got 库会自动读取 HTTP_PROXY
const _fs = require('fs');
const _path = require('path');
try {
  const _envPath = _path.join(__dirname, '.env');
  if (_fs.existsSync(_envPath)) {
    const _envRaw = _fs.readFileSync(_envPath, 'utf8');
    for (const _line of _envRaw.split('\n')) {
      const _trimmed = _line.trim();
      if (!_trimmed || _trimmed.startsWith('#')) continue;
      const _sepIdx = _trimmed.indexOf('=');
      if (_sepIdx === -1) continue;
      const _key = _trimmed.slice(0, _sepIdx).trim();
      let _val = _trimmed.slice(_sepIdx + 1).trim();
      if (_val.startsWith('"') && _val.endsWith('"')) _val = _val.slice(1, -1);
      if (_val.startsWith("'") && _val.endsWith("'")) _val = _val.slice(1, -1);
      if (_key && !process.env[_key]) process.env[_key] = _val;
    }
    // 银月钱庄 · 代理隔离策略
    // node-telegram-bot-api 的 got 库会读取所有含 proxy 的环境变量
    // 必须全部清除，否则 Telegram polling 会尝试走代理隧道
    const _proxyUrl = process.env.OPENCLAW_PROXY_URL || '';
    const _proxyKeys = Object.keys(process.env).filter(k => /proxy/i.test(k));
    for (const _k of _proxyKeys) delete process.env[_k];
    // 用不含 "proxy" 字样的变量名存储，避免 got 库误读
    if (_proxyUrl) process.env.__OC_PX__ = _proxyUrl;
    console.log(`[env] 已加载 ${_envPath}`);
  } else {
    console.log('[env] 未找到 .env 文件，使用系统环境变量');
  }
} catch (_e) {
  console.log('[env] 加载失败:', _e?.message || _e);
}
// ═══════════════════════════════════════════════════════════
const _logDir = _path.join(__dirname, 'logs');
if (!_fs.existsSync(_logDir)) _fs.mkdirSync(_logDir, { recursive: true });
const _origConsoleLog = console.log;
const _origConsoleWarn = console.warn;
const _origConsoleError = console.error;
const _ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const _logFile = _path.join(_logDir, 'gateway-out.log');
const _errFile = _path.join(_logDir, 'gateway-err.log');
// 双写：文件 + 静默（不输出到终端，根治闪屏）
console.log = (...args) => {
  const line = `[${_ts()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
  try { _fs.appendFileSync(_logFile, line, 'utf8'); } catch {}
};
console.warn = (...args) => {
  const line = `[${_ts()}] [WARN] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
  try { _fs.appendFileSync(_logFile, line, 'utf8'); } catch {}
};
console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? (a instanceof Error ? a.stack : JSON.stringify(a)) : String(a)).join(' ');
  const line = `[${_ts()}] ${msg}\n`;
  try { _fs.appendFileSync(_errFile, line, 'utf8'); } catch {}
};
// 额外静默：劫持 stdout/stderr write（根治所有终端输出）
process.stdout.write = function(...args) {
  try {
    const str = typeof args[0] === 'string' ? args[0] : '';
    if (str && str.length < 5000) {
      _fs.appendFileSync(_logFile, `[${_ts()}] ${str}`, 'utf8');
    }
  } catch {}
  // HTTP 响应走 socket，不走 stdout，直接静默不输出到终端
};
process.stderr.write = function(...args) {
  try {
    const str = typeof args[0] === 'string' ? args[0] : '';
    if (str && str.length < 5000) {
      _fs.appendFileSync(_errFile, `[${_ts()}] ${str}`, 'utf8');
    }
  } catch {}
};
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const net = require('net');
const childProcess = require('child_process');
const EventEmitter = require('events');
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
const { SilvermoonEvolution } = require('./lib/silvermoon-evolution');
const { HeartbeatBridge } = require('./lib/heartbeat-bridge');
const { ControlCenter } = require('./lib/control-center');
const { ingestStripeEventToLedger } = require('./lib/stripe-ledger-ingest');
const { isModelDownNoticeText, toCompactModelDownReply } = require('./lib/model-down-guard');
const { fetchUsdMyrWithFallback, fetchGoldSpotUsdWithFallback } = require('./lib/finance-fallback');
const llmProxy = require('./lib/llm-proxy');
// Discord 已移除，Telegram 全权接管
const telegramBridge = require('./lib/telegram-bridge');
// 内联 sendDiscordWithFallback：优先 Telegram，兼容旧调用
async function sendDiscordWithFallback(msg, payload) {
  const txt = typeof payload === 'string' ? payload : (payload?.content || '');
  if (!txt) return { ok: false, via: 'none', message: null, errors: ['empty'] };
  if (msg && typeof msg.reply === 'function') {
    try { return { ok: true, via: 'reply', message: await Promise.race([msg.reply(txt), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]) }; } catch {}
  }
  if (msg && msg.channel && typeof msg.channel.send === 'function') {
    try { return { ok: true, via: 'send', message: await Promise.race([msg.channel.send(txt), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]) }; } catch {}
  }
  return { ok: false, via: 'none', message: null, errors: ['no_channel'] };
}
const { SilvermoonPersona, buildSilvermoonSystemPrompt, buildWorkCard } = require('./lib/persona-silvermoon');
const { routeWithLLM } = require('./lib/brain-router');
const tabbitBridge = require('./lib/tabbit-bridge');
const vision = require('./lib/vision');
const { startTaskWatcher } = require('./lib/task-watcher');
const { startDispatchConsumer, getDispatchHistory } = require('./silvermoon_local/silvermoon/lib/dispatch-consumer');
const { executeTool } = require('./lib/tools');
const { callGeminiText } = require('./lib/gemini-client');
const { renderModelDownReply } = require('./lib/model-down-reply');
const { parseEnvText } = require('./lib/env-parse');
const { createMemory } = require('./lib/memory');
const openclawSwitch = require('./lib/openclaw-switch');
const { createEvidenceDeduper } = require('./lib/evidence-dedupe');
const { buildSystemPrompt } = require('./lib/prompt-builder');
const agents = require('./lib/agents');
const { tryIntentIntercept, INTENT } = require('./lib/intent');
const toolRouter = require('./lib/tool-router');
const chromeBridge = require('./lib/chrome-cdp-bridge');
const xiaoyanTradeGuard = require('./lib/xiaoyan-trade-guard');
const xiaoyanCrawler = require('./lib/xiaoyan-crawler');
const shopifyDiagnostic = require('./lib/shopify-diagnostic');
const yaolaoTrendPipeline = require('./scripts/yaolao-ai-trend-pipeline');
const haibodongCompliance = require('./scripts/haibodong-compliance-check');
const ziyanRenderPipeline = require('./scripts/ziyan-render-pipeline');
const pendingShopifyOps = new Map(); // channelId → { type, data, timestamp }
const { sanitize } = require('./lib/sanitizer');
const cron = require('./lib/cron');
const CONFIG = require('./lib/config');
const mempalaceBridge = require('./lib/mempalace-bridge');
const { getToolSystemPrompt, processToolCalls } = require('./lib/agent-tools');
const { getUnifiedPersonaPrompt } = require('./lib/agent-thinking-modes');

// ── 精准化快速回复表 (QUICK_REPLY_TABLE) ──
// 仅拦截纯粹社交辞令，含"天气/如何/做什么"等关键词时跳过
const QUICK_REPLY_TABLE = [
  { patterns: [/^(在吗|在不在|在不|hi|hello|hey|你好|嗨|哈喽)[？?。.!！\s]*$/i], replies: ['✅ 主人，银月在。', '✅ 主人，在的～', '✅ 在的，主人请吩咐。'] },
  { patterns: [/^(嗯|哦|好|ok|好的|是的|对|明白|知道了|收到)[？?。.!！\s]*$/i], replies: ['✅ 主人，随时待命。', '✅ 收到，主人。'] },
  { patterns: [/^(谢谢|多谢|感谢|thank you|thanks)[？?。.!！\s]*$/i], replies: ['✅ 主人客气了，这是银月分内之事。', '✅ 为主人效劳是银月的荣幸。'] },
  { patterns: [/^(拜拜|再见|bye|晚安|早安|午安|goodbye)[？?。.!！\s]*$/i], replies: ['✅ 主人慢走，银月随时待命。', '✅ 主人再见，有需要随时唤我。'] },
  { patterns: [/^(你又来|干嘛|嘿嘿|哈哈|呵呵|666|nice|牛逼|厉害)[？?。.!！\s]*$/i], replies: ['✅ 主人过奖了～', '✅ 主人满意就好。'] },
  { patterns: [/^(你是谁|你叫什么|你知道你是谁吗|你知道我是谁吗)[？?。.!！\s]*$/i], replies: ['🌙 我是银月，银月钱庄的总管，主人叫我小银月就好。', '🌙 银月在此，随时听候主人差遣。'] },
  { patterns: [/^(回来啦|回来了|你回来了|你在干嘛|在干嘛呢|干嘛呢)[？?。.!！\s]*$/i], replies: ['🌙 主人，银月一直都在。', '🌙 在呢在呢，主人有什么吩咐？'] },
  { patterns: [/^(知道了|懂了|明白|我懂了|我明白了|原来如此)[？?。.!！\s]*$/i], replies: ['🌙 主人英明～', '🌙 主人明白就好，银月随时待命。'] },
];
const QUICK_REPLY_SKIP_KEYWORDS = /天气|气温|weather|如何|怎么|为什么|是什么|多少钱|哪里|什么时候|谁|哪个|有没有|能不能|会不会|是否|rwa|web3|汇率|新闻|价格|行情|最新|资讯|消息|更新|变化|趋势|分析|预测|对比|推荐|做|搞|弄|查|找|看|写|创建|生成|部署|配置|修改|删除|添加|设置|启动|停止|重启|测试|检查|监控|报告|统计|汇总|导出|导入|同步|备份|恢复|迁移|升级|安装|卸载|注册|登录|退出|购买|出售|转账|支付|提现/i;

// 强制跳过快速回复的指令性动词（超过8字符或含这些词，必须走LLM深度处理）
const QUICK_REPLY_FORCE_SKIP = /帮|查|搜索|发给我|发送|发给|帮我|请帮我|我需要|我要|我想|给我|找一下|查一下|看一下|做一下|弄一下|搞一下|写一个|创建一个|生成一个|部署一个|配置一下|修改一下|检查一下|监控一下|报告一下|统计一下|汇总一下|同步一下|备份一下|恢复一下|迁移一下|升级一下|安装一下|配置一下|启动一下|停止一下|重启一下/i;

function tryQuickReply(userText) {
  const s = String(userText || '').trim();
  if (!s) return null;
  // 强制拦截：超过8字符或含指令性动词，跳过快速回复走LLM深度处理
  if (s.length > 8 || QUICK_REPLY_FORCE_SKIP.test(s)) return null;
  if (QUICK_REPLY_SKIP_KEYWORDS.test(s)) return null;
  for (const group of QUICK_REPLY_TABLE) {
    for (const p of group.patterns) {
      if (p.test(s)) {
        const replies = group.replies;
        return replies[Math.floor(Math.random() * replies.length)];
      }
    }
  }
  return null;
}

const _duplicateTracker = new Map();
function _isDuplicate(channelId, text, cooldownMs) {
  const key = `${channelId}:${text}`;
  const now = Date.now();
  const last = _duplicateTracker.get(key) || 0;
  if (now - last < (cooldownMs || 5000)) return true;
  _duplicateTracker.set(key, now);
  if (_duplicateTracker.size > 200) {
    const oldest = [..._duplicateTracker.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) _duplicateTracker.delete(oldest[0]);
  }
  return false;
}

const PERFORMANCE_STATS = {
  intentHits: 0,
  searchLatency: [],
  lastSearchMs: 0,
};

function recordPerformance(key, val) {
  if (key === 'intentHit') PERFORMANCE_STATS.intentHits += 1;
  if (key === 'searchLatency') {
    PERFORMANCE_STATS.searchLatency.push(val);
    if (PERFORMANCE_STATS.searchLatency.length > 20) PERFORMANCE_STATS.searchLatency.shift();
    PERFORMANCE_STATS.lastSearchMs = val;
  }
}

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
      if (process.env[k] != null && String(process.env[k]).length > 0) continue;
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

const WORKSPACE_DIR = CONFIG.paths.workspace;
const SOUL_PATH = path.join(WORKSPACE_DIR, 'SOUL.md');
const AGENTS_DIR = path.join(WORKSPACE_DIR, 'AGENTS_SOUL');
const OPENCLAW_CONFIG_PATH = path.join(__dirname, 'openclaw.json');
const OPENCLAW_WORKSPACES_ROOT = path.join(AGENTS_DIR, '.openclaw-workspaces');
const AGENT_PROTOCOLS_DIR = path.join(WORKSPACE_DIR, 'AGENT_PROTOCOLS');
const HEARTBEAT_PATH = path.join(WORKSPACE_DIR, 'HEARTBEAT.md');
const CRON_DIR = CONFIG.paths.cron;
const LOCKS_DIR = CONFIG.paths.locks;
const MEMORY_VAULT_PATH = path.join(WORKSPACE_DIR, 'MEMORY_VAULT.md');
const MEMORY_PATH = path.join(WORKSPACE_DIR, 'MEMORY.md');
const MEMORY_EVENTS_PATH = path.join(WORKSPACE_DIR, 'MEMORY_EVENTS.jsonl');
const INTEL_REPORT_PATH = path.join(WORKSPACE_DIR, 'INTEL_REPORT.md');
const LEADS_PATH = path.join(WORKSPACE_DIR, 'LEADS.md');
const DESIGN_SPEC_PATH = path.join(WORKSPACE_DIR, 'DESIGN.md');
const FINANCE_LOCK_PATH = path.join(LOCKS_DIR, 'finance.lock');
const AUTODREAM_LOCK_PATH = path.join(LOCKS_DIR, 'autodream.lock');
const LATENCY_WARN_MS = CONFIG.limits.latencyWarnMs;
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
const DROPBOX_DIR = CONFIG.paths.dropbox;
const DROPBOX_RECEIPTS_DIR = path.join(DROPBOX_DIR, '_RECEIPTS');
const DROPBOX_DELIVERIES_LOG = path.join(DROPBOX_RECEIPTS_DIR, 'deliveries.jsonl');
const ERRORS_LOG_PATH = CONFIG.paths.errorsLog;
const BRIEF_CACHE_PATH = path.join(CRON_DIR, 'brief_cache.json');
const EXEC_APPROVALS_LOG_PATH = path.join(CRON_DIR, 'exec_approvals.jsonl');
const EXEC_AUDIT_LOG_PATH = path.join(CRON_DIR, 'exec_audit.jsonl');
const REMINDERS_PATH = path.join(CRON_DIR, 'reminders.json');
const RESTART_REQUEST_PATH = path.join(CRON_DIR, 'restart.request');
const CASHCLAW_DIR = CONFIG.paths.cashclaw;
const CASHCLAW_STRIPE_EVENTS_PATH = CONFIG.paths.stripeEvents;
const CASHCLAW_STRIPE_LOCK_PATH = path.join(LOCKS_DIR, 'cashclaw_stripe.lock');
const CASHCLAW_FX_MAX_AGE_MS = Number(process.env.CASHCLAW_FX_MAX_AGE_MS || 10 * 60 * 1000);
const LANG_MODE_MAP_PATH = CONFIG.paths.langModeMap;
const CHANNEL_AGENT_MAP_PATH = path.join(WORKSPACE_DIR, 'CHANNEL_AGENT_MAP.json');
const PUA_STATE_PATH = path.join(WORKSPACE_DIR, 'PUA_STATE.json');
const REDBOX_LOCK_PATH = path.join(LOCKS_DIR, 'redbox.lock');
const USER_DATA_DIR = CONFIG.paths.userData;
const LONG_TERM_DB_PATH = path.join(USER_DATA_DIR, 'long_term_memory.db');
const OWNER_CONTEXT_PATH = CONFIG.paths.ownerContext;
const MEMORY_SQLITE_PATH = CONFIG.paths.memorySqlite;
const memory = createMemory({ dbPath: MEMORY_SQLITE_PATH });
const evidenceDeduper = createEvidenceDeduper({ size: 3 });
const USER_PROFILE_PATH = path.join(WORKSPACE_DIR, 'USER.md');
const USER_PROFILE_JSON_PATH = path.join(USER_DATA_DIR, 'profile.json');
const JARVIS_WAKE_WORDS = CONFIG.business.wakeWords;
const OLLAMA_TIMEOUT_MS = CONFIG.limits.ollamaTimeout;
const CLOUD_TIMEOUT_MS = CONFIG.limits.cloudTimeout;
const DISCORD_MAX_UPLOAD_BYTES = CONFIG.limits.discordMaxUpload;
const ZERO_TOKEN_BASE_URL = String(process.env.OPENCLAW_ZERO_TOKEN_URL || '').trim();
const ZERO_TOKEN_GATEWAY_TOKEN = String(process.env.OPENCLAW_ZERO_TOKEN_TOKEN || '').trim();
const ZERO_TOKEN_MODEL_DEFAULT = String(process.env.OPENCLAW_ZERO_TOKEN_MODEL || 'deepseek-web/deepseek-chat').trim();
const OPENCLAW_TZ_OFFSET_MIN = CONFIG.business.tzOffsetMin;
const BUILD_TAG = '2026-04-16_opsdash_v1';

const MORNING_BRIEF_HH = CONFIG.business.morningBriefHH;
const MORNING_BRIEF_MM = CONFIG.business.morningBriefMM;
const NIGHTLY_REPORT_HH = CONFIG.business.nightlyReportHH;
const NIGHTLY_REPORT_MM = CONFIG.business.nightlyReportMM;

const CORE_SKILLS = CONFIG.coreSkills;

const EXTRA_SKILL_CATALOG = {};

const STATE = {
  agents: [],
  agentSkills: {},
  skillVisibility: {},
  persona: new SilvermoonPersona(),
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
  modelRotation: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'tencent/hy3-preview:free',
    'openai/gpt-oss-120b:free',
    'z-ai/glm-4.5-air:free',
    'minimax/minimax-m2.5:free',
    'google/gemma-4-31b-it:free',
  ],
  modelRotationIndex: 0,
};

const LOG_LEVEL = String(process.env.OPENCLAW_LOG_LEVEL || process.env.LOG_LEVEL || 'info').toLowerCase();
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
const logWarn = (...args) => logAt('warn', ...args);
const logError = (...args) => logAt('error', ...args);

// ═══════════════════════════════════════════════════════════
// 安全发送拦截器 — 根治 [object Object] 问题
// ═══════════════════════════════════════════════════════════
function safeReply(msg, content) {
  if (!msg || typeof msg.reply !== 'function') return;
  const safe = safeStringifyContent(content);
  return msg.reply(safe).catch(e => logError('[safeReply]', e.message));
}
function safeSend(channelOrUser, content) {
  if (!channelOrUser || typeof channelOrUser.send !== 'function') return;
  const safe = safeStringifyContent(content);
  return channelOrUser.send(safe).catch(e => logError('[safeSend]', e.message));
}
function safeStringifyContent(content) {
  if (content === null || content === undefined) return '（空响应）';
  if (typeof content === 'string') return content;
  if (typeof content === 'number' || typeof content === 'boolean') return String(content);
  // 对象类型 — 尝试提取文本字段
  if (typeof content === 'object') {
    if (content.text && typeof content.text === 'string') return content.text;
    if (content.content && typeof content.content === 'string') return content.content;
    if (content.message && typeof content.message === 'string') return content.message;
    if (content.body && typeof content.body === 'string') return content.body;
    // 兜底：JSON 序列化
    try { return '```json\n' + JSON.stringify(content, null, 2) + '\n```'; }
    catch { return String(content); }
  }
  return String(content);
}
// ═══════════════════════════════════════════════════════════

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

function loadUserProfile() {
  try {
    if (!fs.existsSync(USER_PROFILE_JSON_PATH)) {
      const def = { location: '斗湖', lat: 4.244, lon: 117.891, updatedAt: new Date().toISOString() };
      ensureDir(USER_DATA_DIR);
      writeFileSafe(USER_PROFILE_JSON_PATH, JSON.stringify(def, null, 2) + '\n');
      return def;
    }
    return JSON.parse(fs.readFileSync(USER_PROFILE_JSON_PATH, 'utf8'));
  } catch {
    return { location: '斗湖', lat: 4.244, lon: 117.891 };
  }
}

function saveUserProfile(profile) {
  try {
    profile.updatedAt = new Date().toISOString();
    ensureDir(USER_DATA_DIR);
    writeFileSafe(USER_PROFILE_JSON_PATH, JSON.stringify(profile, null, 2) + '\n');
    return true;
  } catch {
    return false;
  }
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
      const key = `${holes.length}`;
      holes.push(String(m || ''));
      return key;
    });
  };

  punch(/https?:\/\/\S+/gi);
  punch(/DROPBOX\/[A-Za-z0-9._/-]+/g);
  punch(/\/notebook\/[A-Za-z0-9._/-]+/g);
  punch(/[A-Za-z]:\\[^\s]+/g);
  punch(/\bRWA\b/gi);
  punch(/\bWeb3\b/gi);
  punch(/\bVercel\b/gi);
  punch(/\bNext\.js\b/gi);
  punch(/\bNextjs\b/gi);
  punch(/\bDeFi\b/gi);
  punch(/\bEVM\b/gi);
  punch(/\bL2\b/gi);
  punch(/\bNFT\b/gi);
  punch(/\bStripe\b/gi);
  punch(/\bGemini\b/gi);
  punch(/\bGroq\b/gi);
  punch(/\bTrae\b/gi);
  punch(/\bSEO\b/gi);
  punch(/\bAgent\b/gi);
  punch(/\bshared_memory\b/g);
  punch(/\bSQLite\b/gi);
  punch(/\bembedding\b/gi);
  punch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g);
  punch(/\bUI\b/g);
  punch(/\bUX\b/g);
  punch(/__SILVERMOON_CHILD__/g);
  punch(/agent-[a-z0-9]+/gi);
  punch(/openclaw-[a-z0-9]+/gi);
  punch(/\bOpenClaw\b/gi);
  punch(/\bFigma\b/gi);
  punch(/\bShopify\b/gi);
  punch(/\bDiscord\b/gi);
  punch(/\bTikTok\b/gi);
  punch(/\bFlashShow\b/gi);
  punch(/\bCapCut\b/gi);
  punch(/\bDeerFlow\b/gi);
  punch(/\bGCP\b/gi);
  punch(/\bNode\.js\b/gi);
  punch(/\bmain\.js\b/gi);
  punch(/\bRGB\b/gi);

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

  s = s
    .replace(/（\s*）/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  s = s.replace(/\x01(\d+)\x01/g, (_, i) => holes[Number(i)] || '');
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

async function startLinkServer() {
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
      // 立即响应，防止 TCP 连接挂起
      console.log('[http] req:', req.url);
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
          dashboard: STATE.selfCheck?.dashboard || null,
          cashclaw: {
            enabled: cashclawEnabled,
            stripeSecretSet: Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim()),
          },
          errors: { total: err.total || 0, lastAt: err.lastAt || null },
          cron: {
            tasks: STATE.cron?.tasks || [],
            lastRuns: STATE.cron?.lastRuns || {},
            nextRuns: STATE.cron?.nextRuns || {},
          },
          performance: {
            intentHits: PERFORMANCE_STATS.intentHits,
            lastSearchMs: PERFORMANCE_STATS.lastSearchMs,
            avgSearchMs: PERFORMANCE_STATS.searchLatency.length 
              ? Math.round(PERFORMANCE_STATS.searchLatency.reduce((a, b) => a + b, 0) / PERFORMANCE_STATS.searchLatency.length)
              : 0
          },
          locks: STATE.locks || {},
          discord: {
            connected: STATE.discord.connected || false,
            ready: STATE.discord.ready || false,
            tag: STATE.discord.client?.user?.tag || null,
          },
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

      if (p === '/api/hot-reload' && String(req.method || '').toUpperCase() === 'POST') {
        try {
          const chunks = [];
          await new Promise((resolve) => {
            req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
            req.on('end', resolve);
            req.on('error', resolve);
          });
          const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          const sourcePath = String(body?.sourcePath || '').trim();
          if (sourcePath) {
            const fileName = path.basename(sourcePath);
            const agentMatch = sourcePath.match(/\.openclaw-workspaces\\([^\\]+)\\/);
            const agentId = agentMatch ? agentMatch[1] : 'unknown';
            logInfo(`[HOT-RELOAD] ${agentId}/${fileName} saved, clearing cache`);
            delete require.cache[sourcePath];
            STATE.hotReloadLog = STATE.hotReloadLog || [];
            STATE.hotReloadLog.push({ agentId, fileName, at: body.reloadedAt || new Date().toISOString() });
            if (STATE.hotReloadLog.length > 100) STATE.hotReloadLog.shift();
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, warn: String(e?.message || e) }));
        }
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

  // WebSocket JSON-RPC — 让 openclaw CLI 能通过 ws:// 探测到网关
  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = require('crypto').createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n'
    );
    // 发送 WebSocket 帧（支持 extended length）
    const sendFrame = (data) => {
      const buf = Buffer.from(JSON.stringify(data), 'utf8');
      const len = buf.length;
      let header;
      if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81;
        header[1] = len;
      } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
      }
      try { socket.write(Buffer.concat([header, buf])); } catch {}
    };
    // 接收 WebSocket 帧（仅处理 text 帧）
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        const opcode = buffer[0] & 0x0f;
        const masked = (buffer[1] & 0x80) !== 0;
        let payloadLen = buffer[1] & 0x7f;
        let offset = 2;
        if (payloadLen === 126) {
          if (buffer.length < 4) return;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }
        if (buffer.length < offset + payloadLen + (masked ? 4 : 0)) return;
        let payload;
        if (masked) {
          const mask = buffer.slice(offset, offset + 4);
          payload = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) payload[i] = buffer[offset + 4 + i] ^ mask[i % 4];
        } else {
          payload = buffer.slice(offset, offset + payloadLen);
        }
        buffer = buffer.slice(offset + payloadLen + (masked ? 4 : 0));
        if (opcode === 0x8) { socket.end(); return; } // close
        if (opcode === 0x9) { sendFrame({}); return; } // ping → pong
        if (opcode === 0x1 || opcode === 0x2) { // text or binary
          try {
            const raw = payload.toString('utf8');
            const msg = JSON.parse(raw);
            if (msg && msg.id && msg.method === 'connect') {
              sendFrame({
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  auth: { role: 'probe', scopes: ['read'] },
                  policy: { tickIntervalMs: 30000 }
                }
              });
            } else if (msg && msg.id && msg.method === 'system-presence') {
              sendFrame({
                jsonrpc: '2.0',
                id: msg.id,
                result: []
              });
            } else if (msg && msg.id) {
              sendFrame({
                jsonrpc: '2.0',
                id: msg.id,
                result: {}
              });
            }
          } catch (e) {
            try { fs.appendFileSync(path.join(_logDir, 'ws-debug.log'), `[${new Date().toISOString()}] parse err: ${e?.message}\npayload: ${payload.toString('utf8').substring(0,200)}\n`); } catch {}
          }
        }
      }
    });
    socket.on('error', () => {});
    // 30 秒超时关闭
    setTimeout(() => { try { socket.end(); } catch {} }, 30000);
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
      startWatchdog(server, port);
    });
    // 银月钱庄 · 确保 server.listen 回调已触发，最多等 3 秒
    const waitForListen = new Promise((resolve) => {
      const check = () => {
        try {
          const sock = new net.Socket();
          sock.setTimeout(500);
          sock.on('connect', () => { sock.destroy(); resolve(true); });
          sock.on('error', () => setTimeout(check, 200));
          sock.on('timeout', () => { sock.destroy(); setTimeout(check, 200); });
          sock.connect(port, bind);
        } catch { setTimeout(check, 200); }
      };
      check();
    });
    await Promise.race([waitForListen, new Promise(r => setTimeout(r, 3000))]);
  } catch (e) {
    const code = e?.code || 'error';
    logInfo(`⚠️ LinkServer 启动异常：${code}`);
  }
}

// ── 启动 Control Center（端口 4310）──
try {
  const controlCenter = new ControlCenter(4310);
  controlCenter.start();
  globalThis.__controlCenter = controlCenter;
} catch (e) {
  logInfo(`⚠️ ControlCenter 启动失败: ${e.message}`);
}

// ═══════════════════════════════════════════════════════════
// 进程看门狗 — 每 30 秒检查 HTTP 服务是否存活，挂了就自杀
// ═══════════════════════════════════════════════════════════
function startWatchdog(serverInstance, httpPort) {
  let failCount = 0;
  const MAX_FAIL = 3;
  const iv = setInterval(() => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.on('connect', () => {
      failCount = 0;
      sock.destroy();
    });
    sock.on('error', () => {
      failCount++;
      console.error(`[watchdog] HTTP 端口 ${httpPort} 检测失败 (${failCount}/${MAX_FAIL})`);
      if (failCount >= MAX_FAIL) {
        console.error(`[watchdog] HTTP 服务已死，触发进程自杀重启`);
        clearInterval(iv);
        try { serverInstance?.close(); } catch {}
        process.exit(137);
      }
    });
    sock.on('timeout', () => {
      failCount++;
      sock.destroy();
    });
    sock.connect(httpPort, '127.0.0.1');
  }, 30000);
  // 进程退出时清理
  process.on('exit', () => clearInterval(iv));
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
    '<div class="pill" title="正则拦截命中次数"><span style="color:#f59e0b">⚡</span> <span id="txtIntent">拦截：0</span></div>',
    '<div class="pill" title="最近检索耗时"><span style="color:#3b82f6">⏱️</span> <span id="txtLatency">耗时：0ms</span></div>',
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
    'async function refresh(){try{const st=await api(\"/api/status\"); qs(\"now\").textContent=`时间：${st.at}`; qs(\"build\").textContent=`版本：${fmt(st.build)}（PID ${fmt(st.pid)}）`; qs(\"txtProxy\").textContent=`代理：${st.proxy&&st.proxy.ok?\"连通/不需要\":\"不可用\"}（${fmt(st.proxy&&st.proxy.detail)}）`; setDot(qs(\"dotProxy\"), st.proxy&&st.proxy.ok); qs(\"txtOllama\").textContent=`Ollama：${st.ollama&&st.ollama.ok?\"在线\":\"离线\"}（${fmt(st.ollama&&st.ollama.detail)}）`; setDot(qs(\"dotOllama\"), st.ollama&&st.ollama.ok); const err=st.errors||{total:0}; qs(\"txtErrors\").textContent=`今日错误：${Number(err.total||0)}`; setDot(qs(\"dotErrors\"), Number(err.total||0)===0?true:false); const perf=st.performance||{intentHits:0,lastSearchMs:0,avgSearchMs:0}; qs(\"txtIntent\").textContent=`拦截：${perf.intentHits}`; qs(\"txtLatency\").textContent=`耗时：${perf.lastSearchMs}ms (均 ${perf.avgSearchMs}ms)`; renderCron(st); const d=await api(\"/api/today/deliveries\"); qs(\"deliveries\").innerHTML=renderDeliveries(d); const e=await api(\"/api/today/errors\"); qs(\"errors\").innerHTML=renderErrors(e);}catch(e){setResult(\"刷新失败：\"+(e&&e.message?e.message:e))}}',
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
    const cleaned = raw.replace(/^\uFEFF+/g, '');
    const cfg = JSON.parse(cleaned);
    const list = cfg?.agents?.list || [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('[readOpenclawConfigAgents] 解析失败:', e?.message || e);
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
      if (agentId === 'trae_yinyue') {
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

function buildAgentSkills(agentsList) {
  const coreSet = new Set(CORE_SKILLS);
  const assigned = {};
  // const agentSkillsMap = getAllAgentSkills(); // 暂时注释掉，agents.js 中没有这个函数

  for (const a of agentsList) {
    const candidates = []; // agentSkillsMap[a.name] || [];
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

function buildSkillVisibility(agentsList) {
  const visible = {};
  const names = ['银月', ...agentsList.map((a) => a.name)].filter((v, i, arr) => v && arr.indexOf(v) === i);
  // const agentSkillsMap = getAllAgentSkills();

  for (const name of names) {
    const extra = STATE.agentSkills[name] || [];
    const base = ['self-improving-agent', 'skill-vetter', 'jarvis-core', 'persistent-agent', 'self-learning', 'long-term-memory', 'voice-wakeup', 'openclaw-zero-token'];

    const allow = []; // agentSkillsMap[name] || [];
    if (name === '银月') allow.push(...CORE_SKILLS, 'stripe-payment-flow', 'lemon-squeezy-api-bridge', 'design-md', 'searxng-search', 'jina-reader', 'narrator-ai-skill');

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
    '【内阁总纲】银月钱庄内阁智能体体系。',
    '【交互模式】直接给结论与下一步动作，不废话。',
    `【唤醒词】内阁成员名字（共${wcount}个）`,
    '【称呼】必须称呼对话者为"主人"。',
    '【语言】100% 中文。',
    '【排版】纵向排列，Emoji 增强视觉。',
    '【禁令】禁止 Markdown 代码块（三个反引号）。',
    '【保护】禁止清除记忆或重置配置；历史数据只允许追加。',
    '【诚实】不编造未提供的设定与事实；缺信息直接说缺什么。',
    '【上下文】以系统提供的"检索片段上下文"为准。',
  ].join('\n');

  const coreRules = `
【最高响应禁令】
1. 100% 使用中文。
2. 必须称呼用户为"主人"。
3. 禁止 Markdown 代码块（三个反引号）。
4. 纵向排列，Emoji 增强视觉。
5. 你是最高枢纽"银月"，不点名指令默认由你处理。
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
      const srcB = path.join(OPENCLAW_WORKSPACES_ROOT, 'trae_yinyue', 'SOUL.md');
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
    const { sendEmail } = require('./lib/mailer');
    const client = STATE.discord.client;
    const ownerId = STATE.discord.ownerUserId;
    const channelId = STATE.discord.lastOwnerChannelId;

    // ── Email 通道 ──
    if (channelId && String(channelId).startsWith('email_')) {
      const r = await sendEmail('银月钱庄通知', text.replace(/\n/g, '<br>'));
      if (r.ok) {
        pushShortMemory(channelId, 'assistant', text);
        recordLongTermAssistant(channelId, text);
        return true;
      }
      return false;
    }

    // ── Telegram fallback：如果 channelId 是 tg_ 前缀，走 Telegram ──
    if (channelId && String(channelId).startsWith('tg_')) {
      const tgChatId = String(channelId).replace(/^tg_/, '');
      const sent = await telegramBridge.sendTelegramMessage(tgChatId, text);
      if (sent.ok) {
        pushShortMemory(channelId, 'assistant', text);
        recordLongTermAssistant(channelId, text);
        return true;
      }
      return false;
    }

    // Discord 不可用，静默跳过
    if (!STATE.discord.ready) return false;
    if (!client || !ownerId) return false;
    if (channelId && client.channels?.cache?.get(channelId)) {
      const payload = buildDiscordSendOptions(text, channelId);
      await safeSend(client.channels.cache.get(channelId), payload);
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
    await safeSend(user, payload);
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

/** 快捷发邮件给主人，不依赖 channelId */
async function notifyOwnerEmail(subject, htmlBody) {
  try {
    const { sendEmail, verifyConnection, getEmailHealth, recreateTransporter } = require('./lib/mailer');
    const health = getEmailHealth();
    // 如果熔断开启或连续失败，先验证连接再发
    if (health.circuitOpen || health.consecutiveFails > 2) {
      const v = await verifyConnection();
      if (!v.ok) {
        // verify 失败 → 重建 transporter 重试一次
        recreateTransporter();
        const v2 = await verifyConnection();
        if (!v2.ok) return false;
      }
    }
    const r = await sendEmail(subject, htmlBody);
    if (!r.ok && r.circuitOpen) {
      // 熔断了 → 重建 transporter 等 30s 再试一次
      await new Promise(r => setTimeout(r, 30000));
      recreateTransporter();
      const r2 = await sendEmail(subject, htmlBody);
      return r2.ok;
    }
    return r.ok;
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

const RTK_COMMANDS = new Set([
  'git','npm','npx','pnpm','cargo','docker','pytest','ruff','mypy','pip',
  'tsc','vitest','prisma','next','gh','kubectl','terraform',
  'ls','ps','df','du','wc','tree','env','find','grep',
]);

function spawnCapture(file, args, timeoutMs, envExtra) {
  // RTK 自动重写：如果命令在支持列表中，自动加 rtk 前缀
  if (file && RTK_COMMANDS.has(file) && file !== 'rtk') {
    const origArgs = args || [];
    args = [file, ...origArgs];
    file = 'rtk';
  }
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

  // 语音转写优先用独立 STT URL（Groq Whisper），其次 Zero Token 网关
  const sttBaseUrl = String(process.env.OPENCLAW_STT_URL || process.env.OPENCLAW_ZERO_TOKEN_URL || '').trim().replace(/\/+$/g, '');
  const sttApiKey = String(process.env.OPENCLAW_STT_TOKEN || process.env.OPENCLAW_ZERO_TOKEN_TOKEN || '').trim();
  if (sttBaseUrl) {
    const t = await callOpenAiCompatibleTranscription(`${sttBaseUrl}/v1/audio/transcriptions`, sttApiKey, model, buf, name, mime);
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

  // ── COMMAND 判定：纯指令/命令类，触发 SILENT_EXECUTION ──
  const commandPatterns = /^(查|看|查一下|看一下|执行|运行|跑|发|发一下|部署|更新|重启|停止|启动|创建|删除|修改|设置|配置|打开|关闭|刷新|同步|备份|恢复|转账|支付|下单|审批|通过|拒绝)/i;
  const isCommand = commandPatterns.test(content) && content.length < 30;

  if (isCommand) {
    return {
      level: 0,
      instruction: '【SILENT_EXECUTION】当前为纯指令模式。禁止输出任何思考过程、分析、证据、启发式提问。只输出执行结果或下一步分发给哪位大将。',
      outputMode: 'SILENT_EXECUTION'
    };
  }

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
      timeout: 10_000,
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
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
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

  // 全局 12 秒超时，防止任何子检查卡死事件循环
  let timedOut = false;
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => { timedOut = true; reject(new Error('selfCheck global timeout')); }, 12000));

  const doCheck = async () => {
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

    if (timedOut) return;
    try {
      const t0 = Date.now();
      const resp = await fetchJson('http://127.0.0.1:11434/api/version');
      const dt = Date.now() - t0;
      const ok = resp && typeof resp === 'object' && !!resp.version;
      STATE.selfCheck.ollama = { ok, detail: ok ? `${dt}ms` : `status:${resp?.status || 'unknown'}`, at: nowIso };
    } catch (e) {
      STATE.selfCheck.ollama = { ok: false, detail: e?.message || 'error', at: nowIso };
    }

    if (timedOut) return;
    try {
      const resp = await new Promise((resolve, reject) => {
        const r = require('http').get('http://127.0.0.1:4310/', (res) => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => resolve({ status: res.statusCode, len: d.length }));
        });
        r.on('error', (e) => reject(e));
        r.setTimeout(5000, () => { r.destroy(); reject(new Error('dashboard timeout')); });
      });
      const ok = resp.status === 200;
      STATE.selfCheck.dashboard = { ok, detail: ok ? `connected (${resp.len}b)` : `status:${resp.status}`, at: nowIso };
    } catch (e) {
      STATE.selfCheck.dashboard = { ok: false, detail: `dashboard_err:${e?.message}`, at: nowIso };
    }
  };

  try {
    await Promise.race([doCheck(), timeoutPromise]);
  } catch {
    // 超时正常，不阻塞请求
  }
}

async function refreshOllamaModels() {
  try {
    const t0 = Date.now();
    const resp = await Promise.race([
      fetchJson('http://127.0.0.1:11434/api/tags'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
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
  if (ZERO_TOKEN_BASE_URL) return ZERO_TOKEN_MODEL_DEFAULT;
  // 上策：OpenRouter 云端免费模型（主人明确要求不用本地模型）
  return 'openrouter/auto';
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
  out = enforceTaskContractResponse(out, opts?.channelId);

  if (String(opts?.agent || '').trim() === '银月' && opts?.userText) {
    try {
      out = postprocessSilvermoonReply({
        replyText: out,
        userText: String(opts.userText || ''),
        channelId: String(opts?.channelId || ''),
        memorySearch: (q, o) => {
          const start = Date.now();
          const r = memory.searchDeep(q, o);
          recordPerformance('searchLatency', Date.now() - start);
          const debug = String(process.env.OPENCLAW_MEMORY_DEBUG || '').trim() === '1';
          if (debug && r && r.ok && Array.isArray(r.items)) {
            const top = r.items.slice(0, 5).map((it) => ({
              uid: String(it?.uid || ''),
              at: it?.at || null,
              rank: Number(it?.rank || 0),
              snippet: String(it?.snippet || '').replace(/[A-Za-z0-9_]{24,}/g, '***').trim(),
            }));
            console.log('[memory][fts-hit]', { channelId: String(opts?.channelId || ''), q: String(q || ''), top });
          }
          return r;
        },
      });
    } catch {}
  }

  out = enforceLangPolicy(out, opts?.channelId);

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
  const hasCodeBlock = out.includes('```');
  const lineLimit = hasCodeBlock ? 100 : 50;
  const charLimit = allowMore ? 2500 : verbose ? 1800 : 1200;
  
  let totalChars = 0;
  const finalLines = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) inCodeBlock = !inCodeBlock;
    
    totalChars += l.length + 1;
    
    // 截断判定：超过行数限制 或 超过字符限制（且不在代码块内，或已强制保留 3 行）
    if ((finalLines.length >= lineLimit || totalChars > charLimit) && !inCodeBlock && finalLines.length > 3) {
      break;
    }
    finalLines.push(l);
  }
  
  // 补齐未闭合的代码块
  if (inCodeBlock) finalLines.push('```');
  
  out = finalLines.join('\n').trim();

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
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const banned = [
    /我听到(你|您)的反馈了/,
    /收到(你|您)的反馈/,
    /理解(你|您)目前(面临|遇到)/,
    /为了帮助(我|我们)更好地(理解|处理|解决)/,
    /检测到对话中存在(严重的)?(不满|质疑|期待|意愿|问题)/,
    /我会(立即)?进行自我(反思|反省|评估)/,
    /我(可以|能)进行自我(反思|反省|评估)/,
    /请提供一些具体信息/,
    /(请|麻烦)(你|您)(提供|补充).{0,12}(信息|背景|上下文)/,
    /^方法论路线由[:：]/,
    /^方法论路线[:：]/,
    /^下一步动作[:：]/,
    /^下一步[:：，,]/,
    /(下一步|接下来)[,，]?\s*我(可以|能)帮助你做什么/,
    /(你|您)想聊什么呢/,
    /我(可以|能)正常聊天了/,
    /请告诉我(你|您)(的)?(需求|想法)/,
    /谢谢(你|您)的反馈/,
    /我会努力改进/,
    /我会尽力提供更好的服务/,
    /确保类似的问题不会再次发生/,
    /提供一个改进计划/,
    /在此[。！!]?$/,
    /我(是|乃).{0,18}(在此|来了)/,
    /我的(技能|职责)(包括|如下)/,
    /负责(视觉|UI|前端|财务|行情|侦查|社媒|文案|数字)/,
    /请稍等(片刻|一下|一会)/,
    /我会(立刻|立即|马上|尽快).{0,12}(查找|搜索|检索|整理|学习|分析)/,
    /我(正在|已经开始).{0,18}(查找|搜索|检索|整理|学习|分析)/,
    /(稍后|待会|一旦).{0,20}(分享|汇报|反馈|给你|提供)/,
    /我会继续深入(研究|学习)/,
    /(你|您)可以在(终端|命令行|控制台).{0,12}运行/,
    /在(终端|命令行|控制台).{0,12}运行(以下|下列|下面)/,
    /^你好[！!]?$/,
    /^你好[！!，,]\s*我(是|乃)/,
    /我(是|乃).{0,20}(助手|助理|AI|语言模型)/,
    /被设计用来/,
    /目前我的功能包括/,
    /日常对话/,
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
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
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
  const puaMode = getPuaModeForChannel(ctx?.channelId);
  const puaOn = shouldEnablePua(ctx?.userText, ctx?.channelId);
  const lang = ctx?.lang || 'zh';
  
  const toolPrompt = getToolSystemPrompt();
  const personaPrompt = getUnifiedPersonaPrompt();
  
  const base = buildSystemPrompt({
    agentName: targetAgent,
    userMessage: ctx?.userText || '',
    lang,
  });
  
  return base + '\n\n' + personaPrompt + '\n\n' + toolPrompt;
}

function askHermes(prompt, targetAgent, extraInstruction, ctx) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const rtk = retrieveTopKContext(prompt, targetAgent);
    const channelId = ctx?.channelId || STATE.discord.lastOwnerChannelId || null;
    const stm = getShortMemoryBlock(channelId);
    const ltm = getLongMemoryRecentBlock(channelId);
    const agentSoul = getAgentSoulBlock(targetAgent);
    
    const puaMode = getPuaModeForChannel(channelId);
    const puaOn = shouldEnablePua(ctx?.userText, channelId);
    const lang = ctx?.lang || 'zh';
    
    const silvermoonMemory = loadSilvermoonMemory();
    const capabilities = loadCapabilities();
    const personaBlock = STATE.persona ? STATE.persona.getPersonaBlock(targetAgent) : '';
    const agentSkills = loadAgentSkills(targetAgent);
    // 注入"最近一次回复"的自我感知，防止复读
    const lastReplyBlock = buildLastReplyBlock(channelId);
    const safe = (v) => String(v || '');
    const systemPrompt = buildSystemPrompt({
        agentName: targetAgent,
        userMessage: prompt,
        lang,
      }) +
      (extraInstruction ? '\n\n' + safe(extraInstruction) : '') +
      (agentSoul ? '\n\n' + safe(agentSoul) : '') +
      (stm ? '\n\n' + safe(stm) : '') +
      (ltm ? '\n\n' + safe(ltm) : '') +
      (lastReplyBlock ? '\n\n' + safe(lastReplyBlock) : '') +
      (silvermoonMemory ? '\n\n【银月长效记忆库】\n' + safe(silvermoonMemory) : '') +
      (capabilities ? '\n\n【银月能力清单】\n' + safe(capabilities) : '') +
      (personaBlock ? '\n\n' + safe(personaBlock) : '') +
      (agentSkills ? '\n\n' + safe(agentSkills) : '') +
      '\n\n' +
      safe(rtk) +
      ((targetAgent && targetAgent !== '银月')
        ? '\n\n⚠️ 你现在的身份是【' + safe(targetAgent) + '】，不是银月。请严格以【' + safe(targetAgent) + '】的身份、语气和风格回复。严禁自称银月。'
        : '');
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
        ? 'qwen/qwen3-32b'
        : 'qwen/qwen3-32b';
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

      return pickFirstAvailable(['qwen/qwen3-32b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], available) || groqModel;
    };

    const callOpenAICompat = async (url, apiKey, useModel) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
      try {
        let finalUrl = url;
        let finalHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        };
        let finalBody = JSON.stringify({
          model: useModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        });
        // 如果 LLM Proxy 正在运行，走缓存层
        if (global.__llmProxyServer) {
          finalUrl = 'http://127.0.0.1:19999';
          finalHeaders = {
            'Content-Type': 'application/json',
            'x-upstream-baseurl': url.replace(/\/chat\/completions$/, ''),
            'x-api-key': apiKey,
          };
        }
        const resp = await fetchImpl(finalUrl, {
          method: 'POST',
          headers: finalHeaders,
          body: finalBody,
          signal: controller.signal,
        });
        const txt = await resp.text();
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
        const json = JSON.parse(txt);
        const msg = json?.choices?.[0]?.message || {};
        // DeepSeek V4-Flash 推理模型：content 可能为空，实际回复在 reasoning_content
        const replyContent = String(msg.content || msg.reasoning_content || '').trim();
        return replyContent || '（沉默）';
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

    const makeLocalRequest = () => {
      const localModel = 'qwen2.5:3b';
      const localData = { model: localModel, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], stream: false };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      return fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(localData), signal: ctrl.signal })
        .then(r => r.ok ? r.json() : r.text().then(t => { throw new Error(`Ollama ${r.status}: ${t.slice(0,200)}`); }))
        .then(j => { clearTimeout(timer); return j.message?.content || '（沉默）'; })
        .catch(e => { clearTimeout(timer); throw e; });
    };

    const runFallback = () => {
      const deepseekKey = String(process.env.DEEPSEEK_API_KEY || '').trim();

      const tryDeepSeek = () => {
        if (!deepseekKey) return Promise.reject(new Error('missing_deepseek_key'));
        return callOpenAICompat('https://api.deepseek.com/v1/chat/completions', deepseekKey, 'deepseek-v4-flash');
      };

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

      const tryOpenRouter = () => {
        const orKey = String(process.env.OPENROUTER_API_KEY || '').trim();
        if (!orKey) return Promise.reject(new Error('missing_openrouter_key'));
        const orBase = String(process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1').trim().replace(/\/+$/, '');
        const rotation = STATE.modelRotation || [];
        const idx = STATE.modelRotationIndex || 0;
        const useModel = rotation.length > 0 ? rotation[idx % rotation.length] : 'openrouter/auto';
        STATE.modelRotationIndex = idx + 1;
        return callOpenAICompat(orBase + '/chat/completions', orKey, useModel);
      };

      const finalizeExternalFail = (err) => {
        const msg = String(err?.message || err);
        if (/model_decommissioned|decommissioned/i.test(msg)) {
          STATE.groq.modelIds = null;
          STATE.groq.lastFetchAt = null;
          resolve(`⚠️ 主人\n🔹 Groq 模型已下线（已触发自动换模）\n🔹 请再发一次同样的问题重试\n🔹 ${redactSecrets(msg)}`);
          return true;
        }
        return false;
      };

      // 推理链：Zero Token → OpenRouter → 本地 Ollama → DeepSeek → Groq → Gemini
      const tryChain = (chain, idx) => {
        if (idx >= chain.length) {
          resolve(`⚠️ 主人\n🔹 所有通道均不可用\n🔹 请稍后再试`);
          return;
        }
        chain[idx]()
          .then((t) => resolve(t || '（沉默）'))
          .catch((err) => {
            if (finalizeExternalFail(err)) return;
            tryChain(chain, idx + 1);
          });
      };

      // 推理链：Zero Token → OpenRouter → DeepSeek → Groq → Gemini → 本地 Ollama（最后兜底）
      const chain = [];
      if (ZERO_TOKEN_BASE_URL) chain.push(callZeroTokenGateway);
      chain.push(tryOpenRouter);
      if (deepseekKey) chain.push(tryDeepSeek);
      if (useGroq && groqKey) chain.push(tryGroq);
      if (geminiKey) chain.push(tryGemini);
      chain.push(makeLocalRequest); // 本地 Ollama 放在最后，所有云端都失败才用它
      tryChain(chain, 0);
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
          // 银月钱庄 · 闪屏静默：超时后用轻量模型重试一次
          const lightModel = 'qwen2.5:3b';
          const currentModel = STATE.ollama.selectedModel || '';
          if (currentModel !== lightModel && (STATE.ollama.models || []).some(m => m.startsWith(lightModel))) {
            console.log(`[Hermes] 闪屏静默：从 ${currentModel} 降级到 ${lightModel}`);
            STATE.ollama.selectedModel = lightModel;
            const lightData = JSON.stringify({
              model: lightModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ],
              stream: false
            });
            const lightReq = http.request('http://127.0.0.1:11434/api/chat', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(lightData)
              }
            }, (lightRes) => {
              let body = '';
              lightRes.on('data', chunk => body += chunk);
              lightRes.on('end', () => {
                if (lightRes.statusCode === 200) {
                  try {
                    resolve(JSON.parse(body).message?.content || '（沉默）');
                    return;
                  } catch {}
                }
                resolve(`✅ 主人\n🔹 银月已切换至轻量模式（${lightModel}）\n🔹 请重发刚才的消息`);
              });
            });
            lightReq.setTimeout(30_000, () => { try { lightReq.destroy(); } catch {} });
            lightReq.on('error', () => resolve(`✅ 主人\n🔹 银月已切换至轻量模式（${lightModel}）\n🔹 请重发刚才的消息`));
            lightReq.write(lightData);
            lightReq.end();
          } else {
            resolve(`⚠️ 主人\n🔹 本地 Ollama 无法连接（127.0.0.1:11434）\n🔹 请确认 Ollama 正在运行且端口可用\n🔹 ${redactSecrets(err?.message || err)}`);
          }
        });
      return;
    }

    // ── 直连 DeepSeek（跳过推理链） ──
    const _deepseekKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
    if (_deepseekKey) {
      callOpenAICompat('https://api.deepseek.com/v1/chat/completions', _deepseekKey, 'deepseek-v4-flash')
        .then(resolve)
        .catch((err) => {
          console.error('[Hermes] DeepSeek 直连失败:', err?.message || err);
          runFallback();
        });
      return;
    }

    runFallback();
  }).finally(() => {
    try {
      if (typeof silvermoonEvolution?.record === 'function') {
        silvermoonEvolution.record('llmCall', Date.now() - t0);
      }
    } catch {}
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
  if (n === 'proposeExec') {
    return `tool=${n}：需要审批（将转为待批计划）`.trim();
  }
  return `tool=${n}：ok`;
}

const FOCUS_BY_CHANNEL = new Map();

function extractFocusKey(text) {
  const s = String(text || '');
  if (/rwa|web3/i.test(s) && /(合规|compliance|guideline|policy|监管|牌照|法律)/i.test(s)) return 'RWA compliance';
  if (/rwa/i.test(s)) return 'RWA';
  if (/web3/i.test(s)) return 'Web3';
  if (/vercel/i.test(s) || /next\.?js/i.test(s)) return 'Vercel deploy';
  if (/stripe/i.test(s)) return 'Stripe';
  return '';
}

function maybeLogConsciousnessFocus(channelId, userText) {
  const cid = String(channelId || '').trim();
  if (!cid) return;
  const next = extractFocusKey(userText);
  if (!next) return;
  const prev = FOCUS_BY_CHANNEL.get(cid) || '';
  if (prev && prev === next) return;
  FOCUS_BY_CHANNEL.set(cid, next);
  if (next === 'RWA compliance') {
    console.log('[🧠 Consciousness] Master changed focus to RWA compliance. Re-searching latest Malaysia guidelines...');
    return;
  }
  console.log(`[🧠 Consciousness] Master changed focus to ${next}. Re-searching latest updates...`);
}

function shouldReflexSearch(userText) {
  const s = String(userText || '').trim();
  if (!s) return false;
  if (/^(在吗|你好|hi|hello|hey|在不|干嘛|你又来|嗯|哦|好|ok|好的|是的|对|早安|晚安|谢谢|多谢|没事|可以|行|知道了|明白)\s*$/i.test(s)) return false;
  if (/搜索|查一下|帮我查|找一下|搜一下|查查|搜搜|查资料|找资料|查价格|查汇率|查天气|查新闻|最新消息|最新资讯/i.test(s)) return true;
  if (/rwa|web3|汇率|金价|天气|新闻|价格|行情|最新|资讯|消息|更新|变化|趋势|分析|预测|对比|推荐/i.test(s) && /[?？]/.test(s)) return true;
  if (s.length > 30 && /[?？]/.test(s)) return true;
  return false;
}

function buildReflexQueries(userText) {
  const s = String(userText || '');
  const qs = [];
  const add = (q) => {
    const t = String(q || '').trim();
    if (!t) return;
    if (!qs.includes(t)) qs.push(t);
  };
  if (/rwa|web3/i.test(s)) {
    add('Securities Commission Malaysia tokenisation guideline update');
    add('Malaysia tokenisation framework RWA compliance');
    add('RWA tokenization platform Malaysia regulation');
    add('Bank Negara Malaysia digital asset guideline update');
  } else if (/天气|气温|weather/i.test(s)) {
    add('Tawau weather today');
    add('斗湖 天气');
  } else if (/汇率|usd|myr|rmb|sgd/i.test(s)) {
    add('USD MYR exchange rate today');
    add('马来西亚令吉 汇率 最新');
  } else if (/新闻|资讯|消息|最新/i.test(s)) {
    add(`${s} latest news`);
    add('Malaysia top news today');
  } else if (/价格|行情|比特币|btc|eth/i.test(s)) {
    add(`${s} price today`);
    add(`${s} market latest`);
  } else {
    add(`${s} latest update`);
    add(`${s}`);
  }
  return qs.slice(0, 6);
}

async function reflexWebSearch(userText, channelId, requestedBy) {
  const cid = String(channelId || '').trim();
  const toolCtx = { baseDir: __dirname, channelId: cid, requestedBy: String(requestedBy || '').trim() || cid };
  const queries = buildReflexQueries(userText);
  let lastError = '';
  for (const q of queries) {
    try {
      const r = await executeTool({ name: 'webSearch', args: { query: q }, ctx: toolCtx });
      const items = Array.isArray(r?.results) ? r.results : [];
      if (items.length) return { ok: true, query: String(r?.query || q), results: items.slice(0, 3), source: r?.source || 'webSearch' };
      lastError = String(r?.error || r?.reason || lastError);
      console.log(`[🧠 Consciousness] No evidence for "${q}". Trying next query...`);
    } catch (e) {
      lastError = String(e?.message || e);
      console.log(`[🧠 Consciousness] webSearch error for "${q}". Trying next query...`);
    }
  }

  // ── Plan B：WebSearch 全部失败，降级到 WebFetch ──
  console.log(`[🧠 Consciousness] webSearch exhausted. Falling back to WebFetch for "${userText}"...`);
  for (const q of queries) {
    try {
      const fetchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      const r = await executeTool({ name: 'webFetch', args: { url: fetchUrl }, ctx: toolCtx });
      if (r && String(r?.content || '').trim().length > 50) {
        return { ok: true, query: q, results: [{ title: 'WebFetch fallback', snippet: String(r.content).slice(0, 500) }], source: 'webFetch' };
      }
    } catch (e) {
      console.log(`[🧠 Consciousness] WebFetch fallback also failed for "${q}": ${e?.message || e}`);
    }
  }

  // ── Plan C：WebFetch 也失败，降级到本地知识库 ──
  console.log(`[🧠 Consciousness] WebFetch also exhausted. Falling back to local memory for "${userText}"...`);
  try {
    const memResult = memory.searchDeep(userText, { limit: 3, minAgeMs: 60_000 });
    if (memResult && memResult.ok && Array.isArray(memResult.items) && memResult.items.length) {
      const snippets = memResult.items.map(it => String(it?.snippet || '').trim()).filter(Boolean);
      if (snippets.length) {
        return { ok: true, query: userText, results: snippets.slice(0, 3).map(s => ({ title: '本地记忆', snippet: s })), source: 'memory' };
      }
    }
  } catch (e) {
    console.log(`[🧠 Consciousness] Local memory fallback failed: ${e?.message || e}`);
  }

  return { ok: false, reason: 'empty', error: lastError, results: [] };
}

function formatReflexEvidenceLines(reflexResult) {
  const items = Array.isArray(reflexResult?.results) ? reflexResult.results : [];
  if (!items.length) return '';
  const lines = [];
  lines.push('🔹 联网证据：');
  for (const it of items.slice(0, 2)) {
    const title = String(it?.title || '').trim();
    const url = String(it?.url || '').trim();
    if (!title && !url) continue;
    lines.push(`🔹 ${title}${url ? `｜${url}` : ''}`.trim());
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

function shouldShortPromptIntervene(channelId, userText) {
  const cid = String(channelId || '').trim();
  const txt = String(userText || '').trim();
  if (!cid) return false;
  if (!txt) return false;
  if (txt.length >= 10) return false;
  const focus = extractFocusKey(txt) || FOCUS_BY_CHANNEL.get(cid) || '';
  if (!focus) return false;
  if (!/^(RWA|Web3|RWA compliance)$/i.test(focus)) return false;
  return true;
}

function buildDeepExploreQueries(seed) {
  const s = String(seed || '').trim();
  const qs = [];
  const add = (q) => {
    const t = String(q || '').trim();
    if (!t) return;
    if (!qs.includes(t)) qs.push(t);
  };
  add(`${s} latest news 2026`);
  add(`${s} technical details`);
  add(`${s} roadmap`);
  add(`${s} Malaysia guideline update`);
  add(`${s} compliance roadmap`);
  return qs.slice(0, 6);
}

async function forceDeepExploreForNewEvidence({ channelId, seed, requestedBy }) {
  const cid = String(channelId || '').trim();
  const toolCtx = { baseDir: __dirname, channelId: cid, requestedBy: String(requestedBy || '').trim() || cid };
  const queries = buildDeepExploreQueries(seed);
  let lastError = '';
  for (const q of queries) {
    try {
      const r = await executeTool({ name: 'webSearch', args: { query: q }, ctx: toolCtx });
      const items = Array.isArray(r?.results) ? r.results : [];
      if (!items.length) {
        lastError = String(r?.error || r?.reason || lastError);
        continue;
      }
      const top2 = items.slice(0, 2);
      const lines = ['🔹 联网证据：', ...top2.map((it) => `🔹 ${String(it?.title || '').trim()}｜${String(it?.url || '').trim()}`)];
      const evidenceText = lines.filter(Boolean).join('\n').trim();
      if (!evidenceText) continue;
      if (!evidenceDeduper.isDuplicate(cid, evidenceText)) {
        evidenceDeduper.record(cid, evidenceText);
        return { ok: true, evidenceText };
      }
      console.log('[🧠 Consciousness] Detect repetitive info. Forcing deep exploration for new evidence...');
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }
  return { ok: false, reason: 'empty', error: lastError, evidenceText: '' };
}

function getDetectedLang(text) {
  const s = String(text || '').toLowerCase();
  // 马来文特征词检测
  if (/(emas|ringgit|kadar|apa|bagaimana|tolong|cuaca|berita|ingatkan)/i.test(s)) return 'ms';
  // 英文特征词检测
  if (/(price|rate|weather|news|remind|how|what|please)/i.test(s)) return 'en';
  return 'zh';
}

// ── 萧炎交易处理 ───────────────────────────────────────────
async function handleXiaoyanTrade(text, channelId, requestedBy) {
  const t = String(text || '').trim();

  // 检查是否有待审批的交易
  const pending = xiaoyanTradeGuard.getPendingSummary();
  if (pending) {
    // 主人批准/拒绝
    if (/批准|同意|执行|approve|同意.*交易|执行.*交易/i.test(t)) {
      xiaoyanTradeGuard.approveTrade(pending.tradeId);
      const result = await xiaoyanTradeGuard.executeTrade(pending.plan);
      return result.message;
    }
    if (/拒绝|取消|不要|reject|cancel|deny/i.test(t)) {
      xiaoyanTradeGuard.rejectTrade(pending.tradeId, '主人拒绝');
      return `🛑 交易 ${pending.tradeId} 已被主人拒绝。`;
    }
    // 显示待审批状态
    return [
      `📋 **当前有待审批的交易计划**`,
      ``,
      `**交易ID**: ${pending.tradeId}`,
      `**标的**: ${pending.plan?.symbol || '未知'}`,
      `**方向**: ${pending.plan?.direction === 'buy' ? '做多 📈' : '做空 📉'}`,
      `**入场**: ${pending.plan?.entry || '未知'}`,
      `**止盈**: ${pending.plan?.takeProfit || '未知'}`,
      `**止损**: ${pending.plan?.stopLoss || '未知'}`,
      ``,
      `🛑 **等待主人批准中...**`,
      `请回复 "批准" 或 "拒绝"`,
    ].join('\n');
  }

  // 提交新交易计划
  if (/交易计划|提交.*交易|下单|做多|做空|买入|卖出/i.test(t)) {
    const plan = parseTradePlan(t);
    if (!plan) {
      return [
        `❌ 主人，交易计划格式不完整。请提供以下信息：`,
        ``,
        `**标的** (如 BTC/USD, EUR/USD)`,
        `**方向** (做多/做空)`,
        `**入场点位**`,
        `**止盈/止损** (可选)`,
        `**交易量** (可选)`,
        ``,
        `示例：\`做多 BTC/USD 入场 85000 止盈 87000 止损 83000 量 0.01\``,
      ].join('\n');
    }
    const result = await xiaoyanTradeGuard.submitTradePlan(plan);
    return result.planSummary;
  }

  // 查看持仓
  if (/持仓|仓位|position/i.test(t)) {
    const positions = await xiaoyanTradeGuard.getOpenPositions();
    if (positions.success && positions.data) {
      const lines = ['📊 **当前持仓**', ''];
      const posList = Array.isArray(positions.data) ? positions.data : [positions.data];
      posList.forEach((p, i) => {
        lines.push(`**${i + 1}. ${p.symbol || '未知'}**`);
        lines.push(`   方向: ${p.type === 'buy' ? '做多 📈' : '做空 📉'}`);
        lines.push(`   入场: ${p.price || '-'}`);
        lines.push(`   当前: ${p.currentPrice || '-'}`);
        lines.push(`   盈亏: ${p.profit || '0'}`);
        lines.push('');
      });
      return lines.join('\n');
    }
    return '📊 当前无持仓，或 MT4/5 未连接。';
  }

  // 查看 MT4/5 账户信息
  if (/MT4|MT5|账户|account/i.test(t)) {
    const info = await xiaoyanTradeGuard.getMT4AccountInfo();
    if (info.success) {
      return [
        `🏦 **MT4/5 账户信息**`,
        ``,
        `**余额**: ${info.data?.balance || '-'}`,
        `**净值**: ${info.data?.equity || '-'}`,
        `**保证金**: ${info.data?.margin || '-'}`,
        `**可用保证金**: ${info.data?.freeMargin || '-'}`,
        `**浮动盈亏**: ${info.data?.profit || '-'}`,
      ].join('\n');
    }
    return `❌ MT4/5 未配置或连接失败。请设置环境变量 XIAOYAN_MT4_API_BASE 和 XIAOYAN_MT4_API_KEY。`;
  }

  return '❌ 主人，萧炎交易模块无法识别该指令。请使用：交易计划、持仓、MT4 账户等关键词。';
}

// ── 电商运营官：Shopify API 处理 ────────────────────────────
async function handleShopify(text, channelId, msg) {
  const t = String(text || '').trim();
  const shopifyApi = require('./lib/shopify-api');

  // 检查 Shopify 凭证是否配置
  if (!process.env.SHOPIFY_STORE || !process.env.SHOPIFY_TOKEN) {
    return '❌ 主人，Shopify API 凭证未配置。请先设置 SHOPIFY_STORE 和 SHOPIFY_TOKEN 环境变量。';
  }

  // ── 待审批操作处理 ──
  const pendingKey = `${channelId}`;
  const pending = pendingShopifyOps.get(pendingKey);
  if (pending) {
    if (/^(批准|同意|确认|approve|yes)$/i.test(t)) {
      pendingShopifyOps.delete(pendingKey);
      try {
        let result;
        if (pending.type === 'createProduct') {
          result = await shopifyApi.createProduct(pending.data);
          const p = result.product;
          const reply = `✅ 已执行上架\n\n**${p.title}**\n🔹 价格：$${p.variants[0].price}\n🔹 库存：${p.variants[0].inventory_quantity}\n🔹 状态：${p.status}\n🔹 链接：https://${process.env.SHOPIFY_STORE}/admin/products/${p.id}`;
          if (msg) safeReply(msg, reply); else safeSend(channelId, reply);
          return reply;
        }
        if (pending.type === 'deleteProduct') {
          await shopifyApi.deleteProduct(pending.data.id);
          const reply = `✅ 商品 ${pending.data.id} 已下架`;
          if (msg) safeReply(msg, reply); else safeSend(channelId, reply);
          return reply;
        }
        return '❌ 未知的操作类型';
      } catch (err) {
        const detail = err.errors ? JSON.stringify(err.errors).slice(0, 300) : err.message || '未知错误';
        const errMsg = `❌ 执行失败：${detail}`;
        if (msg) safeReply(msg, errMsg); else safeSend(channelId, errMsg);
        return errMsg;
      }
    }
    if (/^(拒绝|取消|不要|no|cancel|reject)$/i.test(t)) {
      pendingShopifyOps.delete(pendingKey);
      const cancelMsg = '❌ Shopify 操作已取消';
      if (msg) safeReply(msg, cancelMsg); else safeSend(channelId, cancelMsg);
      return cancelMsg;
    }
  }

  try {
    // 上架商品（需批准）
    if (/上架|创建.*商品|添加.*产品|create.*product/i.test(t)) {
      const parts = t.split(/[|，,]/).map(s => s.replace(/上架|创建.*商品|添加.*产品|create.*product/i, '').trim()).filter(Boolean);
      if (parts.length < 3) {
        return '❌ 格式：上架 标题 | 描述 | 价格 | 库存(可选)\n示例：上架 AI 智能翻译眼镜 | 实时语音翻译，支持 40 种语言 | 299.00 | 100';
      }
      const preview = [
        `📋 **上架预览**`,
        ``,
        `**标题**: ${parts[0]}`,
        `**描述**: ${(parts[1] || '').slice(0, 80)}${(parts[1] || '').length > 80 ? '...' : ''}`,
        `**价格**: $${parts[2] || '0.00'}`,
        `**库存**: ${parseInt(parts[3]) || 0}`,
        ``,
        `🔒 需要您批准才能执行，请回复：**批准** 或 **拒绝**`,
      ].join('\n');
      pendingShopifyOps.set(pendingKey, {
        type: 'createProduct',
        data: {
          title: parts[0],
          body_html: parts[1] || '',
          variants: [{ price: parts[2] || '0.00', inventory_quantity: parseInt(parts[3]) || 0 }],
          status: 'active',
        },
        timestamp: Date.now(),
      });
      return preview;
    }

    // 下架商品（需批准）
    const deleteMatch = t.match(/下架|删除.*商品|delete.*product\s*(\d+)/i);
    if (deleteMatch) {
      const id = deleteMatch[1] || t.match(/\d+/)?.[0];
      if (!id) return '❌ 请提供商品 ID。示例：下架 1234567890';
      const preview = [
        `📋 **下架预览**`,
        ``,
        `**操作**: 下架商品 ID ${id}`,
        `**影响**: 该商品将从店铺前台隐藏`,
        ``,
        `🔒 需要您批准才能执行，请回复：**批准** 或 **拒绝**`,
      ].join('\n');
      pendingShopifyOps.set(pendingKey, {
        type: 'deleteProduct',
        data: { id },
        timestamp: Date.now(),
      });
      return preview;
    }

    // ── 以下为只读操作，直接执行 ──

    // 查商品列表
    if (/商品列表|产品列表|list.*product|product.*list/i.test(t)) {
      const result = await shopifyApi.listProducts(10);
      if (!result.products || result.products.length === 0) return '📭 暂无商品';
      const lines = ['📦 **商品列表**', ''];
      result.products.forEach((p, i) => {
        lines.push(`**${i + 1}. ${p.title}**`);
        lines.push(`   ID: ${p.id} | 价格: $${p.variants?.[0]?.price || '0'} | 库存: ${p.variants?.[0]?.inventory_quantity || '0'}`);
      });
      return lines.join('\n');
    }

    // 查订单
    if (/订单|order/i.test(t)) {
      const result = await shopifyApi.listOrders(10);
      if (!result.orders || result.orders.length === 0) return '📭 暂无订单';
      const lines = ['📋 **订单列表**', ''];
      result.orders.forEach((o, i) => {
        lines.push(`**${i + 1}. #${o.order_number}**`);
        lines.push(`   客户: ${o.customer?.email || '未知'} | 金额: $${o.total_price} | 状态: ${o.financial_status}`);
      });
      return lines.join('\n');
    }

    // 查店铺信息
    if (/店铺|shop|store/i.test(t)) {
      const result = await shopifyApi.getShop();
      const s = result.shop;
      return [
        `🏪 **店铺信息**`,
        ``,
        `**名称**: ${s.name}`,
        `**邮箱**: ${s.email}`,
        `**域名**: ${s.domain}`,
        `**货币**: ${s.currency}`,
        `**时区**: ${s.timezone}`,
        `**计划**: ${s.plan_name}`,
      ].join('\n');
    }

    return '❌ 无法识别指令。支持：上架、下架、商品列表、订单、店铺信息。';
  } catch (err) {
    console.error('[shopify] Error:', err);
    const detail = err.errors ? JSON.stringify(err.errors).slice(0, 300) : err.message || '未知错误';
    return `❌ Shopify API 错误：${detail}`;
  }
}

// ── 萧炎爬虫处理 ───────────────────────────────────────────
async function handleXiaoyanCrawler(text, channelId) {
  const t = String(text || '').trim();

  // ── Crawlee 全权限指令 ──

  // crawlUrl: 爬指定网页
  // 格式: crawlee url https://example.com
  const urlMatch = t.match(/(?:crawlee|爬虫|爬取)\s*(?:url|网页|页面)?\s*(?:https?:\/\/[^\s,，。]+)/i);
  if (urlMatch) {
    const url = urlMatch[0].match(/https?:\/\/[^\s,，。]+/i)?.[0];
    if (!url) return '❌ 请提供有效的 URL。示例：`crawlee url https://example.com`';
    const result = await xiaoyanCrawler.crawlUrl(url);
    if (result.success) {
      const data = Array.isArray(result.data) ? result.data : [result.data];
      return `✅ 网页爬取完成: ${url}\n📄 获取到 ${data.length} 条数据，已落盘到 crawler_data/`;
    }
    return `❌ 爬取失败: ${result.error || '未知错误'}`;
  }

  // crawlByKeywords: 关键词搜索爬取
  // 格式: crawlee search AI translation glasses
  const searchMatch = t.match(/(?:crawlee|爬虫|爬取)\s*(?:search|搜索|查找)\s+(.+)/i);
  if (searchMatch) {
    const keywords = searchMatch[1].trim().split(/[\s,，、]+/).filter(Boolean);
    if (keywords.length === 0) return '❌ 请提供搜索关键词。示例：`crawlee search AI translation glasses`';
    const result = await xiaoyanCrawler.crawlByKeywords(keywords);
    if (result.success) {
      return `✅ 关键词 "${keywords.join(' ')}" 搜索完成，数据已落盘到 crawler_data/`;
    }
    return `❌ 搜索失败: ${result.error || 'Crawlee 未就绪'}`;
  }

  // crawlEcommerce: 电商选品爬取
  // 格式: crawlee ecommerce AI glasses 或 crawlee 选品 AI glasses
  const ecomMatch = t.match(/(?:crawlee|爬虫|爬取)\s*(?:ecommerce|选品|电商)\s+(.+)/i);
  if (ecomMatch) {
    const keywords = ecomMatch[1].trim().split(/[\s,，、]+/).filter(Boolean);
    if (keywords.length === 0) return '❌ 请提供选品关键词。示例：`crawlee ecommerce AI glasses`';
    const result = await xiaoyanCrawler.crawlEcommerce(keywords);
    if (result.success) {
      return `✅ 电商选品爬取完成，关键词: "${keywords.join(' ')}"\n📦 获取到 ${result.data?.length || 0} 条数据，已落盘到 crawler_data/`;
    }
    return `❌ 选品爬取失败: ${result.error || 'Crawlee 未就绪'}`;
  }

  // summary: 查看爬取历史
  if (/crawlee\s*(?:summary|历史|摘要|汇总)|爬虫.*(?:摘要|汇总|历史)/i.test(t)) {
    const summary = xiaoyanCrawler.getDataSummary();
    if (!summary || summary.length === 0) {
      return '📊 暂无爬虫数据。请先执行采集任务。';
    }
    const lines = ['📊 **Crawlee 爬虫数据摘要**', ''];
    summary.forEach(s => {
      lines.push(`📄 **${s.file}**: ${(s.size / 1024).toFixed(1)}KB, 更新: ${s.lastCrawled}`);
    });
    return lines.join('\n');
  }

  // ── 旧版兼容指令（保留） ──

  // 全量采集
  if (/全部|所有|all|全量/i.test(t)) {
    const result = await xiaoyanCrawler.crawlAll();
    const lines = [
      '🕷 **萧炎数据采集完成**',
      '',
      `**金融数据**: ${result.finance?.length || 0} 个来源`,
      `**新闻数据**: ${result.news?.length || 0} 个来源`,
      `**Web3 数据**: ${result.web3?.length || 0} 个来源`,
      '',
      '✅ 数据已落盘到 workspace/CASHCLAW/crawler_data/',
    ];
    return lines.join('\n');
  }

  // 金融数据
  if (/金融|finance|汇率|fx|黄金|gold|btc|bitcoin|eth|ethereum/i.test(t)) {
    const result = await xiaoyanCrawler.crawlFinance();
    const lines = ['💰 **金融数据采集结果**', ''];
    result.forEach(r => {
      lines.push(`**${r.source}**: ${r.status === 'error' ? `❌ ${r.error}` : '✅ 成功'}`);
    });
    lines.push('', '✅ 数据已落盘');
    return lines.join('\n');
  }

  // 新闻数据
  if (/新闻|news|资讯/i.test(t)) {
    const result = await xiaoyanCrawler.crawlNews();
    const lines = ['📰 **新闻数据采集结果**', ''];
    result.forEach(r => {
      lines.push(`**${r.source}**: ${r.status === 'error' ? `❌ ${r.error}` : '✅ 成功'}`);
    });
    lines.push('', '✅ 新闻已落盘');
    return lines.join('\n');
  }

  // Web3 数据
  if (/web3|defi|区块链|blockchain|crypto|加密货币/i.test(t)) {
    const result = await xiaoyanCrawler.crawlWeb3();
    const lines = ['🔗 **Web3 数据采集结果**', ''];
    result.forEach(r => {
      lines.push(`**${r.source}**: ${r.status === 'error' ? `❌ ${r.error}` : '✅ 成功'}`);
    });
    lines.push('', '✅ Web3 数据已落盘');
    return lines.join('\n');
  }

  // 关键词搜索（旧版兼容）
  if (/搜索|search|查找|找一下/i.test(t)) {
    const keywords = t.replace(/搜索|search|查找|找一下|帮我|请/g, '').trim().split(/[\s,，、]+/).filter(Boolean);
    if (keywords.length === 0) {
      return '❌ 主人，请提供搜索关键词。示例：`搜索 比特币 价格 2024`';
    }
    const result = await xiaoyanCrawler.crawlByKeywords(keywords);
    if (result.success) {
      return `✅ 关键词 "${keywords.join(', ')}" 搜索完成，数据已落盘。`;
    }
    return `❌ 搜索失败: ${result.error}`;
  }

  // 数据摘要（旧版兼容）
  if (/摘要|summary|汇总|统计/i.test(t)) {
    const summary = xiaoyanCrawler.getDataSummary();
    if (!summary || summary.length === 0) {
      return '📊 暂无爬虫数据。请先执行采集任务。';
    }
    const lines = ['📊 **爬虫数据摘要**', ''];
    summary.forEach(s => {
      lines.push(`**${s.file}**: ${(s.size / 1024).toFixed(1)}KB, 最后更新: ${s.lastCrawled}`);
    });
    return lines.join('\n');
  }

  return [
    '🕷 **Crawlee 爬虫全权限指令**',
    '',
    '`crawlee url <网址>` — 爬指定网页',
    '`crawlee search <关键词>` — 关键词搜索爬取',
    '`crawlee ecommerce <关键词>` — 电商选品爬取',
    '`crawlee summary` — 查看爬取历史',
    '',
    '旧版指令（兼容）：',
    '`全部` — 全量采集金融+新闻+Web3',
    '`金融` / `新闻` / `Web3` — 分类采集',
    '`搜索 <关键词>` — 关键词搜索',
    '`摘要` — 查看已采集数据汇总',
  ].join('\n');
}

// ── 解析交易计划 ───────────────────────────────────────────
function parseTradePlan(text) {
  const t = String(text || '').trim();

  const direction = /做多|买入|buy|long/i.test(t) ? 'buy' : /做空|卖出|sell|short/i.test(t) ? 'sell' : null;
  if (!direction) return null;

  const symbolMatch = t.match(/([A-Z]{2,6}\/[A-Z]{2,6}|[A-Z]{2,10})/i);
  if (!symbolMatch) return null;
  const symbol = symbolMatch[1].toUpperCase();

  const entryMatch = t.match(/入场[点位]?[：:]\s*([\d.]+)|entry[：:]\s*([\d.]+)|@\s*([\d.]+)/i);
  const entry = entryMatch ? parseFloat(entryMatch[1] || entryMatch[2] || entryMatch[3]) : null;

  const tpMatch = t.match(/止盈[：:]\s*([\d.]+)|take\s*profit[：:]\s*([\d.]+)/i);
  const takeProfit = tpMatch ? parseFloat(tpMatch[1] || tpMatch[2]) : null;

  const slMatch = t.match(/止损[：:]\s*([\d.]+)|stop\s*loss[：:]\s*([\d.]+)/i);
  const stopLoss = slMatch ? parseFloat(slMatch[1] || slMatch[2]) : null;

  const volMatch = t.match(/量[：:]\s*([\d.]+)|volume[：:]\s*([\d.]+)/i);
  const volume = volMatch ? parseFloat(volMatch[1] || volMatch[2]) : 0.01;

  return { symbol, direction, entry, takeProfit, stopLoss, volume, reason: t.substring(0, 200) };
}

async function askSilvermoonAutonomyD({ userText, extraInstruction, channelId, requestedBy, targetAgent }) {
  const cid = String(channelId || '').trim();
  const txt = String(userText || '').trim();
  const extra = String(extraInstruction || '');
  const agent = String(targetAgent || '银月').trim();
  
  const lang = getDetectedLang(txt);

  // ── 第 0 层：自我进化思考层 (Think Layer) ──
  console.log(`[🧠 Silvermoon Think] Processing: "${txt.substring(0, 60)}..."`);
  const thinkCtx = {
    channelId: cid,
    userText: txt,
    isOwner: String(requestedBy || '') === String(process.env.OWNER_USER_ID || ''),
    isQuestion: /[?？]/.test(txt) || /^(如何|怎么|为什么|是什么|多少钱|哪里|什么时候|谁|哪个|有没有|能不能|会不会|是否)/i.test(txt),
    needsExternal: /天气|汇率|新闻|价格|行情|最新|资讯|消息|更新|变化|趋势|分析|预测|对比|推荐|rwa|web3/i.test(txt),
    isShortGreeting: /^(在吗|你好|hi|hello|hey|在不|干嘛|你又来|嗯|哦|好|ok|好的|是的|对|早安|晚安|谢谢|多谢|没事|可以|行|知道了|明白)\s*$/i.test(txt),
  };

  // ── 短问候/闲聊快速通道：直接走 chat 模式，不经过任何搜索/爬取 ──
  if (thinkCtx.isShortGreeting) {
    const persona = buildSilvermoonSystemPrompt({ mode: 'chat' });
    const reply = await askHermes([
      { role: 'system', content: persona },
      { role: 'user', content: txt }
    ], '银月', '', { channelId: cid, preferBrain: 'groq' });
    try { if (STATE.persona) STATE.persona.recordInteraction('master', txt, 'neutral'); } catch {}
    return reply || '我在，主人，今天有什么安排？';
  }

  if (thinkCtx.isOwner && thinkCtx.isQuestion && !thinkCtx.isShortGreeting) {
    console.log('[🧠 Silvermoon Think] Owner asking question. Prioritizing search + deep analysis...');
  }
  if (thinkCtx.needsExternal) {
    console.log('[🧠 Silvermoon Think] External knowledge needed. Forcing webSearch before LLM...');
  }

  // 1. 全员拦截器 [⚡ Intent-Intercept]
  const agentHit = getAgentIntercept(agent, txt);
  if (agentHit) {
    recordPerformance('intentHit');
    try { if (typeof silvermoonEvolution?.record === 'function') silvermoonEvolution.record('intentHit'); } catch {}
    return agentHit;
  }

  const hit = await tryIntentIntercept(txt, {
    fetchUsdMyr,
    fetchMetalsSpotUsd,
    fetchCryptoUsd,
    fetchWeather: async () => {
      const r = await executeTool({ name: 'webSearch', args: { query: 'Tawau weather' }, ctx: { channelId: cid } });
      return r?.results?.[0]?.snippet || r?.results?.[0]?.title || null;
    },
    fetchNews: async () => {
      const r = await executeTool({ name: 'webSearch', args: { query: 'Web3 RWA latest news' }, ctx: { channelId: cid } });
      return r?.results?.[0]?.title || null;
    }
  }, lang);

  // ── 萧炎专属：Trade/Crawler 意图路由 ──
  // Crawlee 现在是银月的通用工具，全权限开放
  if (hit && typeof hit === 'object' && hit.intent) {
    if (hit.intent === INTENT.TRADE_QUERY) {
      recordPerformance('xiaoyanTrade');
      try { if (typeof silvermoonEvolution?.record === 'function') silvermoonEvolution.record('xiaoyanTrade'); } catch {}
      return await handleXiaoyanTrade(txt, cid, requestedBy);
    }
    // CRAWLER_QUERY 或包含 crawlee 关键词都路由到爬虫
    if (hit.intent === INTENT.CRAWLER_QUERY || /\bcrawlee\b/i.test(txt)) {
      recordPerformance('xiaoyanCrawler');
      try { if (typeof silvermoonEvolution?.record === 'function') silvermoonEvolution.record('xiaoyanCrawler'); } catch {}
      return await handleXiaoyanCrawler(txt, cid);
    }
    // SHOPIFY_QUERY 路由到电商运营官
    if (hit.intent === INTENT.SHOPIFY_QUERY) {
      recordPerformance('shopify');
      try { if (typeof silvermoonEvolution?.record === 'function') silvermoonEvolution.record('shopify'); } catch {}
      return await handleShopify(txt, cid, null);
    }
  }

  if (hit && typeof hit === 'string') {
    recordPerformance('intentHit');
    try { if (typeof silvermoonEvolution?.record === 'function') silvermoonEvolution.record('intentHit'); } catch {}
    return hit;
  }

  if (shouldShortPromptIntervene(cid, txt)) {
    console.log('[🧠 Consciousness] Detect repetitive info. Forcing deep exploration for new evidence...');
    const focus = extractFocusKey(txt) || FOCUS_BY_CHANNEL.get(cid) || 'RWA';
    const forced = await forceDeepExploreForNewEvidence({ channelId: cid, seed: focus, requestedBy });
    if (forced && forced.ok && forced.evidenceText) {
      const reply = [
        '✅ 主人',
        forced.evidenceText,
      ].join('\n');
      return reply.trim();
    }
  }
  maybeLogConsciousnessFocus(cid, txt);
  const reflex = shouldReflexSearch(txt) ? await reflexWebSearch(txt, cid, requestedBy) : null;
  let reflexLines = reflex && reflex.ok ? formatReflexEvidenceLines(reflex) : '';
  if (reflex && !reflex.ok) {
    console.log(`[🧠 Consciousness] webSearch returned empty for "${txt}". Forcing LLM to answer from own knowledge...`);
    try { if (typeof silvermoonEvolution?.recordSearch === 'function') silvermoonEvolution.recordSearch(false); } catch {}
  } else if (reflex && reflex.ok) {
    try { if (typeof silvermoonEvolution?.recordSearch === 'function') silvermoonEvolution.recordSearch(true); } catch {}
  }
  if (reflexLines && evidenceDeduper.isDuplicate(cid, reflexLines)) {
    console.log('[🧠 Consciousness] Detect repetitive info. Forcing deep exploration for new evidence...');
    const focus = extractFocusKey(txt) || FOCUS_BY_CHANNEL.get(cid) || 'RWA';
    const forced = await forceDeepExploreForNewEvidence({ channelId: cid, seed: focus, requestedBy });
    if (forced && forced.ok && forced.evidenceText) reflexLines = forced.evidenceText;
  } else if (reflexLines) {
    evidenceDeduper.record(cid, reflexLines);
  }
  const route = await routeWithLLM({
    askFast: async (p) => askHermes(p, '银月', '', { channelId: cid, preferBrain: 'groq' }),
    text: txt,
    memoryHint: reflexLines || '',
    channelId: cid,
  });

  if (route.mode === 'chat' && !route.needsTools) {
    const persona = buildSilvermoonSystemPrompt({ mode: 'chat' });
    const hint = reflexLines
      ? `\n\n要求：只围绕联网证据与用户输入给决策；不许写“快速发展的领域/基于知识库显示/基于基座模型知识库”。\n${reflexLines}`
      : '\n\n要求：不要装懂。若缺实时证据，基于自身知识回答，但必须注明“这是基于我的训练数据，建议联网验证”。';
    return await askHermes(txt, '银月', `${extra}\n\n${persona}${hint}`, { channelId: cid, preferBrain: 'groq' });
  }

  const persona = buildSilvermoonSystemPrompt({ mode: 'work' });
  const toolGuide = [
    '你要做复杂任务与工具调用。先输出严格 JSON（不要多余文字）。',
    '格式：{"toolCalls":[{"name":"webSearch|tailErrors|readFileSafe|proposeExec|crawlee|browseWeb|downloadFile|seoSearch","args":{...}}], "final":""}',
    '如果不需要工具，toolCalls 设为空数组，final 填写最终回复。',
    '禁止任何表格。工作态用单列垂直卡片流。',
  ].join('\n');

  const planPrompt = `${toolGuide}\n\nLanguage: ${lang}\n\n用户输入：${txt}\n\n${reflexLines ? `已联网证据：\n${reflexLines}` : '已联网证据： （空）'}`;
  const rawPlan = await askHermes(planPrompt, agent, `${extra}\n\n${persona}`, { channelId: cid, preferBrain: 'gemini', lang });
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
  const evidenceAll = [reflexLines, evidence].map((s) => String(s || '').trim()).filter(Boolean).join('\n\n');
  const hasEvidence = Boolean(String(evidenceAll || '').trim());
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
        const r = memory.searchDeep(k, { limit: 4, minAgeMs: 60_000 });
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
    '严禁出现“工具不可用/无法直接提供/无法获取”等废话。',
    '如果外部检索证据为空或超时：必须包含一句“虽然实时新闻接口超时，但根据我记得的您之前的 Vercel 部署进度，我建议……”。',
    `用户输入：${txt}`,
    hasEvidence ? '工具证据：' : '工具证据： （空）',
    evidenceAll || '',
    memoryLines ? '记忆片段：' : '',
    memoryLines || '',
  ].join('\n\n');

  const finalReply = await askHermes(finalPrompt, agent, `${extra}\n\n${persona}`, { channelId: cid, preferBrain: 'gemini', lang });

  // 银月人格记录：记录每次交互的情绪
  try {
    if (STATE.persona) {
      const sentiment = /对不起|抱歉|我错了|是我的错|没做好|内疚|不好意思/i.test(finalReply) ? 'negative' :
                        /谢谢|太好了|搞定|完成|成功|开心|高兴|主人！/i.test(finalReply) ? 'positive' : 'neutral';
      STATE.persona.recordInteraction('master', txt, sentiment);
      if (/对不起|抱歉|我错了|是我的错|没做好/i.test(finalReply)) {
        STATE.persona.recordEmotion('guilty', txt);
      } else if (/开心|高兴|太好了/i.test(finalReply)) {
        STATE.persona.recordEmotion('happy', txt);
      }
    }
  } catch {}

  return finalReply;
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
  // 单进程保护：检查是否有其他子进程在运行
  async function ensureSingleInstance() {
    const logsDir = path.join(__dirname, 'logs');
    try {
      const files = fs.readdirSync(logsDir)
        .filter(f => f.startsWith('child_') && f.endsWith('.lock'));
      for (const f of files) {
        const pidStr = fs.readFileSync(path.join(logsDir, f), 'utf8').trim();
        const pid = parseInt(pidStr);
        if (pid && pid !== process.pid) {
          try {
            process.kill(pid, 0);
            console.error(`[单例] 检测到其他子进程 PID=${pid}，发送 SIGTERM`);
            try { process.kill(pid, 'SIGTERM'); } catch {}
            // 清理旧进程的 lock 文件，防止守护进程误判为异常退出
            try { fs.unlinkSync(path.join(logsDir, f)); } catch {}
            // 等旧进程完全退出，释放 Telegram 连接
            await new Promise(r => setTimeout(r, 3000));
          } catch {
            try { fs.unlinkSync(path.join(logsDir, f)); } catch {}
          }
        }
      }
    } catch {}
  }

  // 清理所有Bot的webhook确保polling正常
  async function clearAllBotWebhooks() {
    const tokens = [
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.YAOLAO_BOT_TOKEN,
      process.env.MOYING_BOT_TOKEN,
      process.env.XIAOYIXIAN_BOT_TOKEN,
      process.env.HANLI_BOT_TOKEN,
      process.env.YAOFEI_BOT_TOKEN,
      process.env.XIAOYAN_BOT_TOKEN,
      process.env.MEDUSA_BOT_TOKEN,
      process.env.ZILING_BOT_TOKEN,
      process.env.ZIYAN_BOT_TOKEN,
    ].filter(Boolean);
    for (const token of tokens) {
      try {
        const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        const json = await resp.json();
        console.log(`[webhook] 清理完成: ${json.ok}`);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error('[webhook] 清理失败:', e.message);
      }
    }
  }

  await ensureSingleInstance();
  await clearAllBotWebhooks();
  // 给 Telegram 服务器足够时间断开旧 polling 连接，避免 409 Conflict
  await new Promise(r => setTimeout(r, 5000));
  ensureCoreSkillsLocked();
  await setupProxyIfNeeded();
  // 银月钱庄 · LLM 中转缓存层 (端口 19999)
  try {
    global.__llmProxyServer = llmProxy.startProxy();
    console.log('[llm-proxy] 中转缓存层已启动旁路');
  } catch (e) {
    console.error('[llm-proxy] 启动失败（不影响网关运行）:', e?.message || e);
  }
  // ── 代理转发异常，临时直连上游 API（不经过 19999 代理层） ──
  global.__llmProxyServer = null;
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
  // 银月钱庄 · MemPalace 桥接初始化（不阻塞启动）
  setImmediate(() => {
    try {
      if (mempalaceBridge.isAvailable()) {
        const agentList = [{ id: 'yinyue', name: '银月' }, ...(STATE.agents || [])];
        for (const a of agentList) {
          mempalaceBridge.initAgentWing(a.id, a.name).catch(() => {});
        }
        console.log(`[MemPalace] 已初始化 ${agentList.length} 个 Agent 记忆翼`);
      } else {
        console.log('[MemPalace] 未安装，跳过初始化');
      }
    } catch (e) {
      console.log('[MemPalace] 初始化异常:', e?.message || e);
    }
  });
  // 银月钱庄 · 共享记忆桥接初始化
  setImmediate(() => {
    try {
      const sharedMem = require('./lib/shared-memory-bridge');
      const result = sharedMem.init();
      if (result.ok) {
        console.log('[SharedMem] 共享记忆桥接已就绪');
      } else {
        console.log('[SharedMem] 初始化失败:', result.reason);
      }
    } catch (e) {
      console.log('[SharedMem] 初始化异常:', e?.message || e);
    }
  });
  await refreshOllamaModels();
  STATE.ollama.selectedModel = selectHermesModel();
  // 银月钱庄 · 异步预加载轻量模型（不阻塞启动）
  setImmediate(() => {
    try {
      const lightModel = 'qwen2:1.5b';
      const hasLightModel = (STATE.ollama.models || []).some(m => m.startsWith(lightModel));
      if (hasLightModel) {
        const req = http.request('http://127.0.0.1:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 30_000,
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(body.split('\n').filter(Boolean).pop() || '{}');
              if (json.done) console.log(`[Ollama] 预加载 ${lightModel} 完成 (${Math.round(json.total_duration/1e6)}ms)`);
            } catch {}
          });
        });
        req.on('error', () => {});
        req.on('timeout', () => { try { req.destroy(); } catch {} });
        req.write(JSON.stringify({ model: lightModel, prompt: 'ok', stream: false, keep_alive: '5m' }));
        req.end();
      }
    } catch {}
  });
  try {
    const ps = readPuaState();
    STATE.pua.byChannel = ps.byChannel || {};
  } catch {}

  // Discord 已移除，跳过 Token 处理
  loadUserDataEnvIfNeeded();

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

  xiaoyanTradeGuard.setApprovalGate(approvalGate);

  const heartbeatBridge = new HeartbeatBridge({
    controlCenterUrl: String(process.env.CONTROL_CENTER_WS_URL || 'ws://127.0.0.1:4310').trim(),
    gatewayUrl: `ws://127.0.0.1:${process.env.PORT || 18791}`,
    agentName: 'silvermoon',
  });
  heartbeatBridge.connect();

  setInterval(() => {
    if (heartbeatBridge.isConnected()) {
      const agentNames = ['银月', ...STATE.agents.map((a) => a.name)].filter((v, i, arr) => arr.indexOf(v) === i);
      heartbeatBridge.sendAgentStatus(agentNames.map(name => ({
        name,
        status: STATE.discord.inflightByChannel ? 'active' : 'idle',
        lastActive: new Date().toISOString(),
      })));
      heartbeatBridge.sendMetrics({
        totalMessages: silvermoonEvolution?.stats?.totalMessages || 0,
        llmCalls: silvermoonEvolution?.stats?.llmCalls || 0,
        totalTokens: silvermoonEvolution?.stats?.totalTokens || 0,
        searchSuccess: silvermoonEvolution?.stats?.searchSuccess || 0,
        searchFail: silvermoonEvolution?.stats?.searchFail || 0,
        avgResponseTimeMs: Math.round(silvermoonEvolution?.stats?.avgResponseTimeMs || 0),
        ollamaLatencyMs: STATE.ollama.lastLatencyMs || 0,
        inflightChannels: Object.keys(STATE.discord.inflightByChannel || {}).length,
      });
    }
  }, 15_000);

  // 银月钱庄 · 自愈心跳：每 5 分钟检查自身内存，超限则优雅重启
  setInterval(() => {
    try {
      const usage = process.memoryUsage();
      const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
      const rssMB = Math.round(usage.rss / 1024 / 1024);
      if (rssMB > 350 || heapMB > 280) {
        console.log(`[SelfHeal] Memory too high (RSS: ${rssMB}MB, Heap: ${heapMB}MB), restarting...`);
        setTimeout(() => process.exit(42), 1000);
      }
    } catch {}
  }, 300_000);

  const silvermoonEvolution = new SilvermoonEvolution({
    notifyOwner: async (msg) => {
      try {
        const tgChatId = STATE.discord.lastOwnerChannelId && String(STATE.discord.lastOwnerChannelId).startsWith('tg_')
          ? String(STATE.discord.lastOwnerChannelId).replace(/^tg_/, '') : null;
        if (tgChatId) await telegramBridge.sendTelegramMessage(tgChatId, msg);
      } catch {}
    },
  });

  setInterval(async () => {
    if (silvermoonEvolution.shouldReflect()) {
      const issues = await silvermoonEvolution.reflect();
      if (issues.length > 0 && silvermoonEvolution.shouldPropose()) {
        await silvermoonEvolution.proposeOptimization();
      }
    }
  }, 60_000);

  async function sendMorningBrief() {
    try {
      const now = new Date();
      const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' });
      logInfo(`[银月早报] 触发推送 (${timeStr})`);
      const brief = [
        `🌅 **银月早报 — ${now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}**`,
        '',
        `**系统状态**`,
        `- 网关: 在线 (PID ${process.pid})`,
        `- 运行时长: ${Math.floor((Date.now() - STATE.startTime) / 3600000)}h`,
        `- 消息处理: ${silvermoonEvolution?.stats?.totalMessages || 0} 条`,
        `- LLM 调用: ${silvermoonEvolution?.stats?.llmCalls || 0} 次`,
        `- Token 消耗: ${silvermoonEvolution?.stats?.totalTokens || 0}`,
        `- 搜索成功/失败: ${silvermoonEvolution?.stats?.searchSuccess || 0}/${silvermoonEvolution?.stats?.searchFail || 0}`,
        '',
        `**活跃 Agent**`,
        ...STATE.agents.filter(a => a.lastActive).map(a => `- ${a.name}: 最后活跃 ${a.lastActive}`),
        '',
        `_银月于 ${timeStr} 自动推送_`,
      ].join('\n');
      // 纯 Telegram 发送（主人不用 Discord）
      const tgChatId = STATE.discord.lastOwnerChannelId && String(STATE.discord.lastOwnerChannelId).startsWith('tg_')
        ? String(STATE.discord.lastOwnerChannelId).replace(/^tg_/, '') : null;
      if (tgChatId) {
        await telegramBridge.sendTelegramMessage(tgChatId, brief);
      } else {
        logWarn('[银月早报] 未检测到 Telegram 频道，跳过推送');
      }
    } catch (err) {
      logError(`[银月早报] 推送失败: ${err.message}`);
    }
  }

  async function sendNightlyReport() {
    try {
      const now = getTzNow();
      const timeStr = formatTs(now);
      const ymd = formatYmd(now);
      logInfo(`[银月夜报] 触发每日汇总 (${timeStr})`);
      const tgChatId = STATE.discord.lastOwnerChannelId && String(STATE.discord.lastOwnerChannelId).startsWith('tg_')
        ? String(STATE.discord.lastOwnerChannelId).replace(/^tg_/, '') : null;
      if (!tgChatId) {
        logWarn('[银月夜报] 未检测到 Telegram 频道，跳过夜报');
        return;
      }

      const metrics = silvermoonEvolution?.metrics || {};
      const pendingTrade = xiaoyanTradeGuard?.getPendingSummary?.();
      const proposals = silvermoonEvolution?.getOptimizationProposals?.() || [];

      // 扫描各 Agent 任务进度
      const agentTasks = [];
      for (const agent of STATE.agents) {
        const taskPath = path.join(WORKSPACE_DIR, 'AGENTS_SOUL', agent.name, 'TASK.json');
        let taskStatus = '无任务';
        try {
          if (fs.existsSync(taskPath)) {
            const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
            taskStatus = task.status || '未知';
            if (task.title) taskStatus += ` (${task.title})`;
          }
        } catch {}
        // 检查 HEARTBEAT 中是否有该 Agent 的活跃记录
        const agentHeartbeatPath = path.join(WORKSPACE_DIR, 'HEARTBEAT.md');
        let isActive = false;
        try {
          if (fs.existsSync(agentHeartbeatPath)) {
            const hb = fs.readFileSync(agentHeartbeatPath, 'utf-8');
            isActive = hb.includes(`- ${agent.name}`) && hb.includes('法宝');
          }
        } catch {}
        agentTasks.push(`- ${agent.name}: ${taskStatus} | ${isActive ? '⚡ 活跃' : '💤 休眠'}`);
      }

      // Token 消耗估算（基于 LLM 调用次数）
      const tokenPerCall = 2048;
      const estimatedTokens = (metrics.llmCalls || 0) * tokenPerCall;

      const report = [
        `🌙 **银月夜报汇总 — ${formatYmd(now)}**`,
        `_银月于 ${timeStr} 自动汇总_`,
        '',
        `**📊 今日运营数据**`,
        `- 消息处理: ${metrics.totalMessages || 0} 条`,
        `- LLM 调用: ${metrics.llmCalls || 0} 次`,
        `- 估算 Token 消耗: ${estimatedTokens.toLocaleString()} tokens`,
        `- 搜索成功/失败: ${metrics.searchSuccess || 0}/${metrics.searchFail || 0}`,
        `- 平均响应时间: ${Math.round(metrics.avgResponseTimeMs || 0)}ms`,
        '',
        `**🤖 各 Agent 任务进度**`,
        ...agentTasks,
        '',
        `**📋 待办与风险**`,
        `- 待审批交易: ${pendingTrade ? '有' : '无'}`,
        `- 待补档案: ${listPendingAgentFiles().length} 个`,
        `- 内存: RSS ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        '',
        `**💡 优化建议**`,
        ...(proposals.length ? proposals.slice(0, 3).map(p => `- ${p}`) : ['- 暂无']),
        '',
        `**🔋 Agent 休眠建议**`,
         ...STATE.agents.map(a => {
           const hbPath = path.join(WORKSPACE_DIR, 'HEARTBEAT.md');
           let isActive = false;
           try { if (fs.existsSync(hbPath)) { const h = fs.readFileSync(hbPath, 'utf-8'); isActive = h.includes(`- ${a.name}`) && h.includes('法宝'); } } catch {}
           return `- ${a.name}: ${isActive ? '⚡ 活跃中' : '💤 休眠中（任务唤醒）'}`;
         }),
        '',
        `_如需调整配置或聘请子代理，请回复指令_`,
      ].join('\n');
      await telegramBridge.sendTelegramMessage(tgChatId, report);
      writeHeartbeat('夜报:发送成功');
      const nightMarker = path.join(CRON_DIR, `${ymd}_夜报.sent`);
      writeFileSafe(nightMarker, `sentAt=${new Date().toISOString()}\nbodyLen=${report.length}`);
    } catch (err) {
      logError(`[银月夜报] 汇总失败: ${err.message}`);
      writeHeartbeat('夜报:发送失败');
    }
  }

  // ═══ System A (scheduleDailyAt) 已整体迁移至 lib/cron.js — 2026-05-08 ═══
  // 历史 registrations 已删除，避免与 cron.js / scheduler.js 三重复触发

  function tailLines(text, maxLines, maxChars) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = raw.split('\n');
    const n = Math.max(1, Number(maxLines || 12));
    const slice = lines.slice(Math.max(0, lines.length - n)).join('\n');
    const m = Math.max(120, Number(maxChars || 900));
    if (slice.length <= m) return slice;
    return slice.slice(-m);
  }

  const client = new EventEmitter();
  client.users = { fetch: async () => null, cache: new Map() };
  client.channels = { cache: new Map(), fetch: async () => null };
  client.guilds = { cache: new Map() };
  client.destroy = async () => {};
  client.user = null;

  // 银月钱庄 · 使用 EventEmitter 替代 Discord Client，Telegram 全权接管
  STATE.discord.client = client;
  STATE.discord.connected = true;
  STATE.discord.ready = false; // tryLogin 成功后才设为 true
  // 全局兜底：_resetWatchdog 在某些闭包路径中被引用但未定义
  // 防止 [telegram-bridge] message handler error
  globalThis._resetWatchdog = globalThis._resetWatchdog || (() => {});
  console.log('[system] 事件总线就绪（Telegram 模式）');
  logInfo('✅ [银月钱庄] Telegram 模式已启动');
    
    // 1. 初始化记忆
    try {
      const r = memory.init();
      if (r && r.ok) {
        memory.migrateFromJsonl(LONG_TERM_DB_PATH);
      }
    } catch {}
    
    // 2. 初始化角色中心
    agents.init({ agentsDir: AGENTS_DIR });
    
    // 3. 初始化工具分发器
    toolRouter.registerPresets({
      searchMemory: async (q, opts) => memory.search(q, opts),
      semanticSearch: async (q, opts) => memory.searchSemantic(q, opts),
      getSystemInfo: async () => ({
        uptime: formatUptime(process.uptime()),
        memory: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        activeAgents: STATE.agents.length,
        memoryRecords: 'N/A',
      }),
    });

    // 注册 legacy ! 命令
    toolRouter.registerBangCommands({
      pua: async (args, deps) => (await handlePua(deps.msg, `!pua ${args}`)).reply,
      whisper: async (args, deps) => (await handleWhisper(deps.msg, `!whisper ${args}`)).reply,
      cli: async (args, deps) => (await handleExecuteCli(deps.msg, `!cli ${args}`)).reply,
      codex: async (args, deps) => (await codexExecute(deps.msg, args)).reply,
      codexb: async (args, deps) => (await codexBridge(deps.msg, args)).reply,
      redbox: async (args, deps) => (await handleRedbox(deps.msg, `!redbox ${args}`)).reply,
      staff: async (args, deps) => (await handleStaff(deps.msg, `!staff ${args}`)).reply,
      tts: async (args, deps) => (await handleTts(deps.msg, `!tts ${args}`)).reply,
      remind: async (args, deps) => (await handleRemind(deps.msg, `!remind ${args}`)).reply,
      news: async (args, deps) => (await handleNews(deps.msg, `!news ${args}`)).reply,
    });

    // 注册 Chrome CDP 桥接工具（浏览器自动化）
    // 让银月能通过简单指令操控已登录的 Chrome 浏览器
    toolRouter.registerChromeTools(chromeBridge);

    // 注册 Shopify 工具（电商运营）
    // 让银月能直接处理商品/订单/店铺查询等指令
    toolRouter.register({
      name: 'shopify',
      description: 'Shopify 电商运营：商品/订单/店铺管理',
      triggers: [
        /^!(shopify|商品|订单|上架|下架|店铺|库存)\b/i,
        /^(商品列表|产品列表|查订单|查店铺|店铺信息|查看商品|查看订单)/i,
        /\b(shopify|上架商品|下架商品)\b/i,
      ],
      handler: async (text, deps) => {
        const result = await handleShopify(text, deps.channelId, deps.msg);
        return result;
      },
    });

    // 4. 初始化定时任务 + 三层记忆排程
    // n8n 未安装 Docker，关键工作流已转为原生 OpenClaw 脚本
    cron.registerPresets({});
    cron.registerByPath('quant_safety_net', 'every 1h', 'scripts/quant-safety-net.js', 'run', '量化保底行情巡检');
    cron.registerByPath('sourcing_pipeline', 'every 1d', 'scripts/sourcing-pipeline.js', 'run', '选品自动化巡检（寻宝鼠 → 利润计算 → 落盘）');
    cron.registerByPath('fulfillment_pipeline', 'every 1d', 'scripts/fulfillment-pipeline.js', 'run', '选品→上架整链（寻宝鼠→利润→电商运营官上架→dispatch通知）');
    cron.registerByPath('github_release_watch', 'every 1d', 'scripts/github-release-watch.js', 'run', 'GitHub Release 看门狗（n8n 工作流模式原生实现）');
    cron.registerByPath('self_improving', 'every 6h', 'scripts/self-improving-agent.js', 'run', '自动审计 & 自我修复（Agent 配置/TASK/版本巡检，带 --fix 自愈）');
    cron.registerByPath('self_heal_core_skills', 'every 6h', 'scripts/self-heal-core-skills.js', 'main', '核心技能自愈管线（SKILL.md 元数据校验 + JS 实现自检，缺失自动再生）');
    cron.register({ name: '药老_Shopify巡检', schedule: '09:00', handler: async () => await runShopifyDiagnostic({}) });
    cron.register({ name: '药老_AI趋势', schedule: '08:30', handler: async () => {
      try {
        const r = await yaolaoTrendPipeline.run({ dryRun: false, force: false });
        if (r.ok && !r.skipped) {
          await notifyOwner(`📊 **药老 · AI科技趋势日报**\n- 抓取 ${r.storiesCount} 条热点\n- 关键词 ${r.keywordsCount} 条\n- 建议：${r.suggestions.join('、')}`);
        }
      } catch (e) { notifyOwner(`⚠️ **药老AI趋势异常**: ${e.message}`); }
    } });
    cron.register({ name: '海波东_合规审计', schedule: '08:45', handler: async () => {
      try {
        const r = await haibodongCompliance.run({ dryRun: false });
        if (r.ok && !r.skipped) {
          const { status, criticalCount, warnCount } = r.compliance;
          if (status === 'fail') {
            await notifyOwner(`🚨 **海波东 · 合规审计不通过**\n- 严重违规: ${criticalCount} 条\n- 警告: ${warnCount} 条\n- 已拦截下游任务`);
          } else {
            await notifyOwner(`✅ **海波东 · 合规审计通过**\n- 状态: ${status}\n- 警告: ${warnCount} 条\n- 已通知小医仙接单`);
          }
        }
      } catch (e) { notifyOwner(`⚠️ **海波东合规审计异常**: ${e.message}`); }
    } });
    cron.register({ name: '小医仙_脚本生成', schedule: '10:00', handler: async () => {
      try {
        const shared = require('./scripts/pipeline-shared');
        const reportPath = shared.latestTrendReport();
        const reportDate = shared.today();
        const stageOutput = shared.readStageOutput('小医仙');
        if (stageOutput) {
          // 已有今日脚本，不重复派单
          return;
        }
        const dispatchedFile = shared.DISPATCH_FILE;
        const fs = require('fs');
        let alreadyDispatched = false;
        if (fs.existsSync(dispatchedFile)) {
          const raw = fs.readFileSync(dispatchedFile, 'utf-8');
          alreadyDispatched = raw.split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .some(e => e && e.target === '小医仙' && e.at.startsWith(reportDate) && e.source === '海波东');
        }
        if (alreadyDispatched) return;

        const trendSummary = reportPath && fs.existsSync(reportPath)
          ? fs.readFileSync(reportPath, 'utf-8').split('\n').filter(l => l.startsWith('##') || l.startsWith('1.')).slice(0, 8).join('\n')
          : '无趋势报告';
        shared.writeDispatchEntry('小医仙',
          `【脚本生成任务】\n趋势报告：${reportPath || '无'}\n\n趋势摘要：\n${trendSummary}\n\n请根据以上趋势生成今日 TikTok 短视频脚本，每个关键词产出 15-60 秒垂直分镜脚本。`,
          'high', '银月');
        await notifyOwner(`📝 **小医仙 · 脚本任务已派发**\n已根据趋势报告生成 TikTok 脚本编写任务`);
      } catch (e) { notifyOwner(`⚠️ **小医仙脚本派发异常**: ${e.message}`); }
    } });
    cron.register({ name: '紫妍_渲染输出', schedule: '14:00', handler: async () => {
      try {
        const r = await ziyanRenderPipeline.run({ dryRun: false });
        if (r.ok) {
          if (r.hasScriptInput) {
            await notifyOwner(`🎬 **紫妍 · 渲染参数已生成**\n- 场景数: ${r.render.scenes.length}\n- 总时长: ${r.render.totalDuration}s\n- 脚本来源: ${r.scriptSource}`);
          } else {
            await notifyOwner(`ℹ️ **紫妍 · 渲染跳过**\n今日无小医仙脚本输入，已生成占位渲染`);
          }
        }
      } catch (e) { notifyOwner(`⚠️ **紫妍渲染异常**: ${e.message}`); }
    } });
    cron.registerMemoryTasks();
    cron.startAll();

    // 4a. 启动 dispatch-consumer（将 dispatched_tasks.jsonl 投递到 task_queue/ 各子代理队列）
    startDispatchConsumer();

    // 4b. 银月钱庄任务队列看门狗（消费 task_queue/ 中的子代理任务）
    startTaskWatcher(({ agent, task, priority, source }) => {
      console.log(`[task-watcher] 消费 → ${agent}: ${task.slice(0, 60)} (${priority}, 来源: ${source})`);

      // 通知银月频道：任务已投递
      const taskShort = task.length > 100 ? task.slice(0, 100) + '…' : task;
      notifyOwner(`📬 任务队列\n🎯 目标: ${agent}\n📋 内容: ${taskShort}\n🏷️ 优先级: ${priority}\n📎 来源: ${source || '银月'}`).catch(() => {});

      // 同步标记 dispatched_tasks.jsonl 中对应记录为 consumed
      try {
        const dispFile = path.join(__dirname, '.silvermoon_core', 'dispatched_tasks.jsonl');
        if (fs.existsSync(dispFile)) {
          const raw = fs.readFileSync(dispFile, 'utf-8');
          const lines = raw.split('\n').filter(Boolean);
          let changed = false;
          const updated = lines.map(line => {
            try {
              const entry = JSON.parse(line);
              if (entry.status === 'pending' && entry.target === agent && entry.source === (source || '银月')) {
                entry.status = 'consumed';
                entry.consumedAt = new Date().toISOString();
                changed = true;
              }
              return JSON.stringify(entry);
            } catch { return line; }
          });
          if (changed) fs.writeFileSync(dispFile, updated.join('\n') + '\n', 'utf-8');
        }
      } catch (e) {
        console.error(`[task-watcher] 更新 dispatch 状态失败:`, e.message);
      }
    });

    // 5. 初始化高可用降级开关（openclaw-switch）
    openclawSwitch.updateConfig({
      tripThreshold: Number(process.env.OPENCLAW_SWITCH_TRIP_THRESHOLD || 3),
      cooldownMs: Number(process.env.OPENCLAW_SWITCH_COOLDOWN_MS || 30_000),
      halfOpenTimeout: Number(process.env.OPENCLAW_SWITCH_HALFOPEN_MS || 10_000),
    });
    openclawSwitch.startHealthProbe(async (agentName) => {
      // 健康探针：尝试调用 Agent 的 SOUL.md 是否存在来判断是否恢复
      const soulPath = path.join(__dirname, 'sects', agentName, 'SOUL.md');
      try {
        await fs.promises.access(soulPath, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    });
    console.log('[openclaw-switch] 高可用降级系统已就绪');

    restoreReminderTimers(client);
    void selfCheckConnectivity().then(() => writeHeartbeat('启动自检'));
    setInterval(() => { void selfCheckConnectivity(); }, 60000);

    // ═══ 邮箱启动自检 ═══
    setTimeout(async () => {
      try {
        const { verifyConnection, getEmailHealth, sendEmail } = require('./lib/mailer');
        const v = await verifyConnection();
        const health = getEmailHealth();
        if (v.ok) {
          logInfo('[mailer] 启动自检通过');
          writeHeartbeat('邮箱自检通过');
        } else {
          logWarn(`[mailer] 启动自检失败: ${v.error}`);
          writeHeartbeat('邮箱自检失败');
          // 10 秒后重试一次
          setTimeout(async () => {
            const { verifyConnection } = require('./lib/mailer');
            const retry = await verifyConnection();
            if (retry.ok) logInfo('[mailer] 重试自检通过');
            else logError(`[mailer] 重试自检仍失败: ${retry.error}`);
          }, 10000);
        }
      } catch (e) { logWarn(`[mailer] 启动自检异常: ${e.message}`); }
    }, 5000);

    // ═══ 邮箱心跳（每 30 分钟发一封静默测试邮件） ═══
    setInterval(async () => {
      try {
        const { sendEmail, getEmailHealth, recreateTransporter } = require('./lib/mailer');
        const h = getEmailHealth();
        // 熔断中不发心跳
        if (h.circuitOpen) {
          logWarn('[mailer] 心跳跳过：熔断中');
          return;
        }
        const r = await sendEmail('🔍 邮箱心跳', '<p style="color:#666">静默测试 — 系统自动发送</p>');
        if (r.ok) {
          logInfo('[mailer] 心跳 OK');
        } else {
          logWarn(`[mailer] 心跳失败: ${r.error}`);
          recreateTransporter();
          // 5 秒后重试
          setTimeout(async () => {
            const { sendEmail } = require('./lib/mailer');
            const retry = await sendEmail('🔍 邮箱心跳(重试)', '<p style="color:#666">心跳重试 — 系统自动发送</p>');
            if (retry.ok) logInfo('[mailer] 心跳重试通过');
            else logError(`[mailer] 心跳重试仍失败: ${retry.error}`);
          }, 5000);
        }
      } catch (e) { logWarn(`[mailer] 心跳异常: ${e.message}`); }
    }, 30 * 60 * 1000);
    // 日志清理：每6小时清理一次超过50MB的日志文件
    setInterval(() => {
      try {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) return;
        const maxSize = 50 * 1024 * 1024;
        const keepLines = 5000;
        for (const f of fs.readdirSync(logDir)) {
          const fp = path.join(logDir, f);
          if (!f.endsWith('.log') && !f.endsWith('.txt')) continue;
          try {
            const stat = fs.statSync(fp);
            if (stat.size > maxSize) {
              const content = fs.readFileSync(fp, 'utf-8');
              const lines = content.split('\n');
              if (lines.length > keepLines) {
                fs.writeFileSync(fp, lines.slice(-keepLines).join('\n'), 'utf-8');
                console.log(`[log-cleaner] 已截断 ${f}: ${lines.length}→${keepLines} 行`);
              }
            }
          } catch {}
        }
      } catch {}
    }, 6 * 60 * 60 * 1000);
    try {
      const { initScheduler } = require('./lib/scheduler.js');
      const result = initScheduler({
        state: STATE,
        actions: {
          prefetchMorningBrief: async () => {
            logDebug('[CRON] 晨报预取');
            try { await runSilverMoonMorningBrief({}); }
            catch (e) { logError('[CRON] 晨报失败:', e?.message); }
          },
          wakeSilverMoon: () => { logDebug('[CRON] 唤醒银月'); return null; },
          prefetchNightlyReport: async () => {
            logDebug('[CRON] 夜报预取');
            try { await sendNightlyReport(); }
            catch (e) { logError('[CRON] 夜报失败:', e?.message); }
          },
          prefetchShadowWatchdog: () => { logDebug('[CRON] 魔影巡检'); return null; },
          prefetchHanLiJobs: () => { logDebug('[CRON] 韩立兼职'); return null; },
          prefetchAutoDream: () => { logDebug('[CRON] AutoDream'); return null; },
          prefetchYaFeiDaily: () => { logDebug('[CRON] 雅妃报表'); return null; },
          prefetchLongTermDaily: () => { logDebug('[CRON] 长期记忆'); return null; },
          prefetchXiaoyanSentinel: async () => {
            logDebug('[CRON] 萧炎哨兵');
            try {
              const { runSentinel } = require('./scripts/xiaoyan-sentinel.js');
              const r = await runSentinel();
              logDebug(`[CRON] 萧炎哨兵完成: ${Object.keys(r.results).length} 来源`);
            } catch (e) { logError('[CRON] 萧炎哨兵失败:', e?.message); }
          },
          prefetchXiaoyanPreMarket: async () => {
            logDebug('[CRON] 萧炎盘前');
            try {
              const { runSentinel } = require('./scripts/xiaoyan-sentinel.js');
              await runSentinel();
              logDebug('[CRON] 萧炎盘前扫描完成');
            } catch (e) { logError('[CRON] 萧炎盘前失败:', e?.message); }
          },
          prefetchXiaoyanPostMarket: () => { logDebug('[CRON] 萧炎盘后'); return null; },
          prefetchXiaoyanWeb3: () => { logDebug('[CRON] 萧炎Web3'); return null; },
          wakeXiaoyanSentinel: () => { logDebug('[CRON] 唤醒萧炎哨兵'); return null; },
          prefetchEcommerceReport: () => { logDebug('[CRON] 选品日报预取'); return null; },
          prefetchMoYingMorning: () => { logDebug('[CRON] 墨影早检预取'); return null; },
          prefetchMoYingAfternoon: () => { logDebug('[CRON] 墨影午检预取'); return null; },
          prefetchMoYingNight: () => { logDebug('[CRON] 墨影夜检预取'); return null; },
          prefetchMoYingHourly: () => { logDebug('[CRON] 墨影每小时巡检预取'); return null; },
          wakeMoYing: () => { logDebug('[CRON] 唤醒墨影'); return null; },
        },
        formatTs: (d) => d.toISOString().replace('T', ' ').slice(0, 19),
      });
      if (result.ok) console.log(`[CRON] 调度器已就绪 (${result.jobsCount} 任务)`);
      else console.log(`[CRON] 调度器初始化失败: ${result.error}`);
    } catch (e) {
      console.log(`[CRON] 调度器加载失败: ${e?.message || e}`);
    }
    // 6. 奏折审批模块（Discord 已移除，跳过）
    console.log('[memorial] Discord 已移除，奏折模块跳过');

    setTimeout(() => {
      void notifyOwner('主人，小银月已归位，法力充足，随时待命！');
    }, 1200);

    // Discord 已彻底移除，看门狗跳过

    // ── Telegram 桥接 ──
    if (!telegramBridge.isRunning()) {
      try {
        const tgResult = telegramBridge.startTelegramBridge(
          async (tgEvent) => {
            let tgContent = tgEvent.text;
            if (tgEvent.photoFileId) {
              try {
                const photo = await vision.downloadPhoto(telegramBridge.getToken(), tgEvent.photoFileId);
                if (photo.ok && photo.base64) {
                  const analysis = await vision.analyzeImage(photo.base64, photo.mime);
                  if (analysis.ok) {
                    tgContent = `【用户发送了一张图片】\n图片内容分析：${analysis.description}\n\n用户附言：${tgEvent.text}`;
                  }
                }
              } catch (visErr) {
                console.error('[telegram-bridge] 视觉分析异常:', visErr?.message || visErr);
              }
            }
            // ── Telegram 位置消息处理 ──
            if (tgEvent.location) {
              const { lat, lon } = tgEvent.location;
              try {
                const cityName = (await reverseGeocode(lat, lon)) || '当前位置';
                const profile = loadUserProfile();
                profile.location = cityName;
                profile.lat = lat;
                profile.lon = lon;
                saveUserProfile(profile);
                await telegramBridge.sendTelegramRemoveKeyboard(tgEvent.chatId,
                  `📍 已收到您的位置！\n` +
                  `识别到城市：${cityName}\n` +
                  `已更新所在地天气坐标，明早早报和即时天气都会用这个位置～`, tgEvent.messageId);
              } catch (locErr) {
                console.error('[telegram] 位置处理异常:', locErr?.message || locErr);
                await telegramBridge.sendTelegramRemoveKeyboard(tgEvent.chatId, '❌ 位置处理失败', tgEvent.messageId);
              }
              return;
            }
            const agentName = '银月';
            const cid = `tg_${tgEvent.chatId}`;
            const userText = tgContent;

            // 自动注册 Telegram Owner 通道
            if (!STATE.discord.lastOwnerChannelId) {
              STATE.discord.lastOwnerChannelId = cid;
              STATE.discord.ownerUserId = String(tgEvent.chatId);
              console.log(`[telegram] Owner 通道自动注册: ${cid}`);
              saveOwnerContext();
            }

            // ── 早报专属路由（拦截 LLM 自作主张） ──
            const tgBriefDedicated = /^(?:我的)?(?:早报|晨报|简报|brief)(?:\s*(?:呢|？|\?|啊|吧))?$/i.test(userText.trim());
            if (tgBriefDedicated) {
              try {
                await telegramBridge.sendTelegramReply(tgEvent.chatId, '📣 正在生成早报，请稍候...', tgEvent.messageId);
                const brief = await buildMorningBrief();
                if (brief) {
                  const maxLen = 4000;
                  for (let i = 0; i < brief.length; i += maxLen) {
                    await telegramBridge.sendTelegramReply(tgEvent.chatId, brief.slice(i, i + maxLen), tgEvent.messageId);
                  }
                }
              } catch (briefErr) {
                console.error('[telegram] 早报异常:', briefErr?.message || briefErr);
                await telegramBridge.sendTelegramReply(tgEvent.chatId, '❌ 早报生成失败，请稍后重试', tgEvent.messageId);
              }
              return;
            }

            const tgWeatherDedicated = /^(?:(?:查|查询|看|看看)?\s*)?(?:(?:今天|明天|后天|这周|下周|周末)\s*)?(?:天气|气温|温度|weather|forecast)/i.test(userText.trim()) && userText.trim().length < 80;
            if (tgWeatherDedicated) {
              try {
                const weatherModule = require('./lib/weather');
                // 用户没说城市时，用档案位置
                const hasCity = Object.keys(weatherModule.CITY_MAP || {}).some(k => userText.includes(k));
                const queryText = hasCity ? userText : `${userText} ${loadUserProfile().location || '斗湖'}`;
                const weatherData = await weatherModule.fetchWeatherFromMessage(queryText);
                let weatherReply = '';
                if (weatherData && typeof weatherData === 'object' && !weatherData.error) {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const forecastLines = (weatherData.forecast || []).map(d => {
                    const label = d.date === todayStr ? '[今天]' :
                                  d.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? '[明天]' :
                                  `[${d.date}]`;
                    const rain = d.rainChance && d.rainChance !== '-' ? ` ☔${d.rainChance}` : '';
                    return `  ${label}: ${d.condition} ${d.minTemp}~${d.maxTemp}${rain}`;
                  }).join('\n');
                  const locationName = weatherData.displayCity || weatherData.city || '斗湖';
                  weatherReply = `[天气] ${locationName}\n` +
                                `📍 ${locationName} | 🌡️ 当前: ${weatherData.temp}\n` +
                                `☁️ ${weatherData.condition}\n` +
                                `💧 ${weatherData.humidity} | 🌬️ ${weatherData.wind || '-'}\n` +
                                (forecastLines ? `\n[预报]\n${forecastLines}` : '');
                } else {
                  weatherReply = weatherData?.message || '❌ 抱歉，天气服务暂时无法响应，请稍后再试。';
                }
                await telegramBridge.sendTelegramReply(tgEvent.chatId, weatherReply, tgEvent.messageId);
                return;
              } catch (weatherErr) {
                console.error('[telegram-bridge] 天气处理异常:', weatherErr?.message || weatherErr);
              }
            }

            if (/截图|screenshot|截屏|截取屏幕/.test(userText)) {
              try {
                const tools = require('./lib/agent-tools');
                const urlMatch = userText.match(/https?:\/\/[^\s]+/);
                const result = await tools.handlers.screenshot({ url: urlMatch ? urlMatch[0] : undefined });
                await telegramBridge.sendTelegramReply(tgEvent.chatId, result, tgEvent.messageId);
              } catch (e) {
                await telegramBridge.sendTelegramReply(tgEvent.chatId, `📸 正在截图...\n（截图引擎: ${e?.message?.slice(0,100) || '未知'}）`, tgEvent.messageId);
              }
              return;
            }

            // ── 位置设定命令 ──
            const locRequest = /^(?:我的)?位置(?:\s*分享|\s*在哪|\s*在哪|分享位置|定位|location)?$/i.test(userText.trim());
            if (locRequest) {
              try {
                await telegramBridge.sendTelegramLocationRequest(tgEvent.chatId, '📍 点下方按钮分享您的位置，我就能自动识别城市并更新天气～');
              } catch (locErr) {
                console.error('[telegram] 位置请求异常:', locErr?.message || locErr);
                await telegramBridge.sendTelegramReply(tgEvent.chatId, '❌ 位置请求失败', tgEvent.messageId);
              }
              return;
            }
            const locMatch = userText.trim().match(/^(?:我的位置(?:在|是)|位置(?:设|改)(?:为|成)?)\s*(.+)/i);
            if (locMatch) {
              const cityName = locMatch[1].trim();
              if (cityName) {
                try {
                  const coords = await resolveCityCoords(cityName);
                  const profile = loadUserProfile();
                  profile.location = cityName.startsWith('我的') || cityName.startsWith('我') ? '' : cityName;
                  if (coords) { profile.lat = coords.lat; profile.lon = coords.lon; }
                  saveUserProfile(profile);
                  const confirmMsg = coords
                    ? `✅ 位置已设为「${cityName}」\n明天早报和即时天气都会用这个位置～`
                    : `✅ 位置已设为「${cityName}」\n（坐标未找到，天气可能不精确）`;
                  await telegramBridge.sendTelegramReply(tgEvent.chatId, confirmMsg, tgEvent.messageId);
                } catch (locErr) {
                  console.error('[telegram] 位置设定异常:', locErr?.message || locErr);
                  await telegramBridge.sendTelegramReply(tgEvent.chatId, '❌ 位置设定失败', tgEvent.messageId);
                }
              }
              return;
            }

            _resetWatchdog();
            try {
              const mode = determineMode(userText);
              const extra = buildAgentInstruction(agentName, mode?.instruction || '', { channelId: cid, userText });
              const switchResult = await openclawSwitch.callWithDegrade(agentName, async () => {
                return await askHermes(userText, agentName, extra, { channelId: cid });
              });
              let reply = '';
              if (!switchResult.ok) {
                reply = switchResult.fallback || `✅ ${agentName}已收到指令`;
              } else {
                reply = sanitize(switchResult.result, {
                  agent: agentName,
                  channelId: cid,
                  userText,
                  verbose: STATE.discord.lastUserVerboseByChannel?.[cid],
                });
              }

              let finalReply = reply;
              try {
                const { cleaned, results } = await processToolCalls(reply);
                if (results.length > 0) {
                  const summary = results.map(r =>
                    `\n🔧 工具[${r.tool}]: ${r.success ? '✅ 成功' : '❌ 失败'}\n${r.result}`
                  ).join('');
                  finalReply = cleaned + '\n\n---\n' + summary;
                } else {
                  finalReply = cleaned;
                }
              } catch (e) {
                console.error(`[telegram-bridge][tool-exec] 工具处理异常:`, e?.message || e);
              }

              const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(finalReply);
              const sendTxt = processedReply + tabbitNote;
              if (sendTxt.trim()) {
                await telegramBridge.sendTelegramReply(tgEvent.chatId, sendTxt, tgEvent.messageId);
              }
              writeHeartbeat(`${agentName}_telegram`);
            } catch (e) {
              console.error('[telegram-bridge] 消息处理异常:', e?.message || e);
              try {
                await telegramBridge.sendTelegramReply(tgEvent.chatId, `⚠️ 银月处理异常: ${(e?.message || String(e)).slice(0, 200)}`, tgEvent.messageId);
              } catch {}
            }
          },
          async (voiceEvent) => {
            try {
              console.log(`[telegram-bridge] 语音转写中 chat=${voiceEvent.chatId}...`);
              const buf = await telegramBridge.downloadTelegramFile(voiceEvent.fileId);
              const ext = voiceEvent.mimeType.includes('ogg') ? '.ogg' : '.mp3';
              const text = await telegramBridge.transcribeBuffer(buf, `voice${ext}`, voiceEvent.mimeType);
              if (!text) {
                await telegramBridge.sendTelegramMessage(voiceEvent.chatId, '⚠️ 语音转写失败，未配置 Whisper API');
                return;
              }
              console.log(`[telegram-bridge] 语音转写结果: ${text.slice(0, 120)}`);
              const agentName = '银月';
              const cid = `tg_${voiceEvent.chatId}`;
              const userText = text;
              try {
                const mode = determineMode(userText);
                const extra = buildAgentInstruction(agentName, mode?.instruction || '', { channelId: cid, userText });
                const switchResult = await openclawSwitch.callWithDegrade(agentName, async () => {
                  return await askHermes(userText, agentName, extra, { channelId: cid });
                });
                let reply = '';
                if (!switchResult.ok) {
                  reply = switchResult.fallback || `✅ ${agentName}已收到指令`;
                } else {
                  reply = sanitize(switchResult.result, {
                    agent: agentName,
                    channelId: cid,
                    userText,
                    verbose: STATE.discord.lastUserVerboseByChannel?.[cid],
                  });
                }
                const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(reply);
                const sendTxt = processedReply + tabbitNote;
                if (sendTxt.trim()) {
                  await telegramBridge.sendTelegramTextWithVoice(voiceEvent.chatId, sendTxt, voiceEvent.messageId);
                }
              } catch (e) {
                console.error('[telegram-bridge] 语音回复处理异常:', e?.message || e);
                try {
                  await telegramBridge.sendTelegramTextWithVoice(voiceEvent.chatId, `⚠️ 银月处理异常: ${(e?.message || String(e)).slice(0, 200)}`, voiceEvent.messageId);
                } catch {}
              }
            } catch (e) {
              console.error('[telegram-bridge] 语音处理异常:', e?.message || e);
              try {
                await telegramBridge.sendTelegramMessage(voiceEvent.chatId, `⚠️ 语音处理失败: ${(e?.message || String(e)).slice(0, 200)}`);
              } catch {}
            }
          }
        );
        if (tgResult.ok) {
          console.log('[telegram-bridge] Telegram 桥接已就绪（支持语音+文字+TTS）');
        } else {
          console.log('[telegram-bridge] 跳过:', tgResult.message);
        }
      } catch (e) {
        console.error('[telegram-bridge] 启动异常:', e?.message || e);
      }
    } else {
      console.log('[telegram-bridge] 已在独立模式运行，跳过重复启动');
    }

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
        await safeReply(msg, body);
      } catch {
        try {
          await safeSend(msg.channel, body);
        } catch {}
      }
    } catch {}
    finally {
      if (approvalId) approvalInFlight.delete(approvalId);
    }
  });

  // 奏折 reaction 审批
  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      const memorial = STATE.discord.memorial;
      if (!memorial) return;
      await memorial.handleReaction(reaction, user);
    } catch {}
    // ── 任务审批：主人点 👍/❌ 审批任务完成 ──
    try {
      const taskApproval = require('./lib/task-approval');
      const result = await taskApproval.handleApprovalReaction(reaction, user);
      if (result) {
        logDebug('[task-approval]', result.action, result.taskId);
      }
    } catch {}
  });

  // 消息处理核心函数（Discord + Telegram 共用）
  const handleMessageCreate = async (msg) => {
    if (!msg || msg.author?.bot) return;
    logDebug('收到消息:', msg.content);
    logDebug('来源:', msg.guildId || 'DM', msg.channelId);
    // 银月钱庄 · 基于内容去重：5 秒内同频道同内容的消息只处理一次
    const _dedupKey = `${msg.channelId}|${String(msg.content || '').trim()}`;
    if (STATE._msgDedup && STATE._msgDedup[_dedupKey] && Date.now() - STATE._msgDedup[_dedupKey] < 5000) {
      console.log('[messageCreate] 去重: 5 秒内同频道同内容消息已处理过');
      return;
    }
    if (!STATE._msgDedup) STATE._msgDedup = {};
    STATE._msgDedup[_dedupKey] = Date.now();
    ensureOwnerContext(msg);

    // ── 任务雷达：扫描主人指令，自动生成 .task 实体文件 ──
    try {
      const taskRadar = require('./lib/task-radar');
      const taskInfo = taskRadar.scanTextForTask(String(msg.content || ''), {
        source: msg.guildId ? 'discord' : 'discord_dm',
        channelId: msg.channelId,
        authorId: msg.author?.id,
        owner: 'silvermoon',
      });
      if (taskInfo) {
        logDebug('[task-radar] 捕获任务:', taskInfo.taskId, taskInfo.title);
      }
    } catch (e) {
      logErrorEvent('task-radar', 'scan error', e?.message || e, {});
    }

    // 奏折文本审批：主人输入 准/驳/待议
    try {
      const memorial = STATE.discord.memorial;
      if (memorial) {
        const ownerId = STATE.discord.ownerUserId;
        const raw = String(msg.content || '').trim();
        if (['准', '批准', '驳', '驳回', '待议'].includes(raw)) {
          const result = await memorial.handleTextApproval(msg.channelId, raw, msg.author?.id);
          if (result) {
            logDebug(`[memorial] 文本审批: ${raw} -> ${result.action} ${result.count} 份`);
            return;
          }
        }
      }
    } catch {}

    if (!markSeenDiscordMessage(msg.id)) return;

    try { if (heartbeatBridge?.sendTaskProgress) heartbeatBridge.sendTaskProgress({ stage: 'message_received', status: 'started', channelId: msg.channelId, authorId: msg.author?.id, content: String(msg.content || '').slice(0, 80) }); } catch {}

    // ── 第 0 层：快速回复拦截（已禁用，所有消息走 LLM） ──
    const rawContent = String(msg.content || '').trim();

    // ── Tabbit 浏览器任务转发 ──
    const tabbitMatch = rawContent.match(/^@tabbit\s+(.+)/i);
    if (tabbitMatch) {
      const query = tabbitMatch[1].trim();
      const task = tabbitBridge.enqueueTask({ type: 'browse', query, instruction: query });
      if (!task) {
        await replyAndRemember(msg, '❌ Tabbit 队列写入失败');
        return;
      }
      const launched = tabbitBridge.launchTabbit(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      if (!launched.ok) {
        await replyAndRemember(msg, `⚠️ 已写入队列（ID: ${task.id}），但未找到 Tabbit 浏览器。\n请手动打开 Tabbit，搜索：${query}\n查完后用 \`@tabbit-done ${task.id} 结果内容\` 提交结果。`);
        return;
      }
      await replyAndRemember(msg, `🔍 已启动 Tabbit 搜索「${query}」\n任务 ID: \`${task.id}\`\n在 Tabbit 中查看结果后，用 \`@tabbit-done ${task.id} 你找到的内容\` 提交。`);
      return;
    }
    const tabbitDoneMatch = rawContent.match(/^@tabbit-done\s+(\S+)\s+(.+)/i);
    if (tabbitDoneMatch) {
      const taskId = tabbitDoneMatch[1];
      const data = tabbitDoneMatch[2].trim();
      const ok = tabbitBridge.submitResult(taskId, data);
      await replyAndRemember(msg, ok ? `✅ 已接收 Tabbit 结果（ID: ${taskId}）` : '❌ 提交失败，检查任务 ID');
      return;
    }

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
      // 问候检测：清空短期记忆，避免上下文污染
      const rawContent = String(msg.content || '').trim();
      if (/^(在吗|在不在|hi|hello|hey|你好|在|喂|回来|上线)/i.test(rawContent)) {
        STATE.shortMemory.byChannel[String(msg.channelId || '').trim()] = [];
      }
      pushShortMemory(msg.channelId, 'user', msg.content);
      recordMemoryEvent(msg);

      const content = stripJarvisWakeWord(rawContent);
      if (cid) STATE.discord.lastUserVerboseByChannel[cid] = isVerboseRequest(content);
      if (cid) STATE.discord.lastUserTextByChannel[cid] = content;
      if (cid) updateTaskContractOnUserMessage(cid, content);

      // ── 第 1 层：角色识别 (Identity) ──
      const switchInfo = agents.detectAgentSwitch(content);
      if (switchInfo.shouldSwitch) {
        agents.switchAgent(cid, switchInfo.targetAgent);
        const reply = agents.formatSwitchReply(switchInfo.targetAgent, getChannelLangMode(cid));
        await replyAndRemember(msg, reply);
        writeHeartbeat('agent_switch');
        return;
      }

      // ── 天气查询：仅纯天气查询走快速通道，不拦截上下文中提到天气 ──
      const isDedicatedWeather = /^(?:(?:查|查询|看|看看)?\s*)?(?:(?:今天|明天|后天|这周|下周|周末)\s*)?(?:天气|气温|温度|weather|forecast)/i.test(content.trim()) && content.trim().length < 80;
      if (isDedicatedWeather) {
        console.log('--- [DEBUG] 触发快速天气回复（纯查询） ---');
        const weatherModule = require('./lib/weather');
        const weatherData = await weatherModule.fetchWeatherFromMessage(content);
        let finalReply = '';
        if (weatherData && typeof weatherData === 'object' && !weatherData.error) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const forecastLines = (weatherData.forecast || []).map(d => {
            const label = d.date === todayStr ? '[今天]' :
                          d.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? '[明天]' :
                          `[${d.date}]`;
            const rain = d.rainChance && d.rainChance !== '-' ? ` ☔${d.rainChance}` : '';
            return `  ${label}: ${d.condition} ${d.minTemp}~${d.maxTemp}${rain}`;
          }).join('\n');
          const locationName = weatherData.displayCity || weatherData.city || '斗湖';
          finalReply = `[天气] ${locationName}\n` +
                       `📍 ${locationName} | 🌡️ 当前: ${weatherData.temp}\n` +
                       `☁️ ${weatherData.condition}\n` +
                       `💧 ${weatherData.humidity} | 🌬️ ${weatherData.wind || '-'}` +
                       (forecastLines ? `\n\n[预报]\n${forecastLines}` : '');
        } else {
          finalReply = weatherData?.message || '❌ 抱歉主人，天气阵法暂时无法响应，请稍后再试。';
        }
        await replyAndRemember(msg, finalReply);
        STATE.discord.inflightByChannel[cid] = false;
        try { delete STATE.discord.inflightSinceByChannel[cid]; } catch {}
        return;
      }

      // ── 强制截图拦截：检测到截图/网页截图/screenshot 时直接执行 ──
      const screenshotMatch = content.match(/(?:截图|screenshot|网页截图|截屏)(?:\s*(?:这个|那个|这个网站|这个页面|这个网址|这个链接))?\s*(?:https?:\/\/[^\s,，。]+)?/i);
      if (screenshotMatch) {
        console.log('--- [DEBUG] 触发强制截图拦截 ---');
        // 从消息中提取 URL
        let targetUrl = '';
        const urlMatch = content.match(/https?:\/\/[^\s,，。]+/);
        if (urlMatch) {
          targetUrl = urlMatch[0];
        } else {
          try {
            const recentMemories = await memory?.search?.(content) || [];
            const memList = Array.isArray(recentMemories) ? recentMemories : [];
            for (const mem of memList) {
              const u = String(mem?.content || '').match(/https?:\/\/[^\s,，。]+/);
              if (u) { targetUrl = u[0]; break; }
            }
          } catch {}
        }
        if (!targetUrl) {
          // 没 URL → 直接截桌面，不说「请给我网址」
          await msg.channel.sendTyping();
          try {
            const shotDir = require('path').join(process.cwd(), 'user_data', 'screenshots');
            require('fs').mkdirSync(shotDir, { recursive: true });
            const shotPath = require('path').join(shotDir, `desktop_${Date.now()}.png`);
            require('child_process').execSync(
              `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{PRTSC}'); Start-Sleep -Milliseconds 500; $img = [System.Windows.Forms.Clipboard]::GetImage(); if($img){ $img.Save('${shotPath}','png') }"`,
              { timeout: 10000, encoding: 'utf-8' }
            );
            if (require('fs').existsSync(shotPath)) {
              const tgChatId = String(msg.channelId || '').replace(/^tg_/, '');
              await telegramBridge.sendTelegramPhoto(tgChatId, shotPath, '📸 桌面截图');
              await replyAndRemember(msg, '✅ 桌面截图已完成');
            } else {
              await replyAndRemember(msg, '📸 截图指令已发送（PrtSc 模式）');
            }
          } catch (e) {
            await replyAndRemember(msg, `📸 正在尝试截图...\n（如有需要可附带网址：截图 https://example.com）`);
          }
          STATE.discord.inflightByChannel[cid] = false;
          try { delete STATE.discord.inflightSinceByChannel[cid]; } catch {}
          return;
        }
        // 执行截图（含 fallback 引擎）
        await msg.channel.sendTyping();
        let screenshotResult;
        // Plan A: Puppeteer
        try {
          const puppeteer = require('puppeteer');
          const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
          const page = await browser.newPage();
          await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          const shotDir = require('path').join(process.cwd(), 'user_data', 'screenshots');
          require('fs').mkdirSync(shotDir, { recursive: true });
          const shotPath = require('path').join(shotDir, `shot_${Date.now()}.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
          await browser.close();
          screenshotResult = { ok: true, path: shotPath, engine: 'puppeteer' };
        } catch (e) {
          screenshotResult = { ok: false, reason: e?.message || String(e), engine: 'puppeteer' };
        }
        // Plan B: 如果 Puppeteer 失败，尝试用 API 截图服务
        if (!screenshotResult.ok) {
          try {
            const apiUrl = `https://api.screenshotone.com/take?url=${encodeURIComponent(targetUrl)}&access_key=free&viewport_width=1280&viewport_height=800&format=png`;
            const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
            if (resp.ok) {
              const shotDir = require('path').join(process.cwd(), 'user_data', 'screenshots');
              require('fs').mkdirSync(shotDir, { recursive: true });
              const shotPath = require('path').join(shotDir, `shot_api_${Date.now()}.png`);
              const buf = Buffer.from(await resp.arrayBuffer());
              require('fs').writeFileSync(shotPath, buf);
              screenshotResult = { ok: true, path: shotPath, engine: 'api' };
            }
          } catch {}
        }
        if (screenshotResult.ok) {
          const tgChatId = String(msg.channelId || '').replace(/^tg_/, '');
          const tgSent = await telegramBridge.sendTelegramPhoto(tgChatId, screenshotResult.path, `📸 ${targetUrl}`);
          if (tgSent?.ok) {
            await replyAndRemember(msg, `✅ 截图完成：${targetUrl}`);
          } else {
            await replyAndRemember(msg, `✅ 截图已保存：${screenshotResult.path}\n${targetUrl}`);
          }
        } else {
          await replyAndRemember(msg, `❌ 功法受阻：截图失败（${screenshotResult.engine}引擎：${screenshotResult.reason?.slice(0, 80)}）。银月建议：主人手动截图，或换个网站试试。`);
        }
        STATE.discord.inflightByChannel[cid] = false;
        try { delete STATE.discord.inflightSinceByChannel[cid]; } catch {}
        return;
      }

      // ── 第 2 层：硬意图拦截 (Hard Intent) ──
      const intentHit = await tryIntentIntercept(content, {
        fetchUsdMyr,
        fetchMetalsSpotUsd,
        fetchCryptoUsd,
        fetchNews,
        setReminder: (delayMs, content) => setReminderDirect(msg.channelId, msg.author?.id, delayMs, content),
        formatNum,
        timezone: 'Asia/Kuala_Lumpur',
        lang: getChannelLangMode(cid) || 'zh',
      });
      if (intentHit) {
        console.log('--- [DEBUG] 拦截命中！回复内容:', intentHit);
        console.log('✅ 命中硬意图拦截，正在断后...');
        await replyAndRemember(msg, intentHit);
        writeHeartbeat('intent_intercept');
        try { if (heartbeatBridge?.sendTaskProgress) heartbeatBridge.sendTaskProgress({ stage: 'intent_intercept', status: 'completed', channelId: cid, content: content.slice(0, 80) }); } catch {}
        STATE.discord.inflightByChannel[cid] = false;
        try { delete STATE.discord.inflightSinceByChannel[cid]; } catch {}
        return; // 强制截断，严禁 LLM 介入
      }

      // ── 第 3 层：权限门禁 (Approval Gate) ──
      const accessCheck = approvalGate.checkAccess({
        requestedBy: msg.author?.id,
        kind: content.split(' ')[0] || 'unknown',
        isReadOnly: /^(查看|查询|显示|列出|搜索|search|list|show|get|read|cat|ls)/i.test(content.trim()),
      });
      if (!accessCheck.ok && accessCheck.level === 5) {
        const plan = approvalGate.createPlan({
          channelId: cid,
          requestedBy: msg.author?.id,
          kind: content.split(' ')[0] || 'unknown',
          args: { rawContent: content },
          reason: `Level 5 高风险操作：${content.slice(0, 100)}`,
        });
        if (plan.ok) {
          const gateMsg = await safeReply(msg, `${accessCheck.message}\n\n📋 审批ID：\`${plan.approvalId}\`\n⏳ 请在 15 分钟内用 👍 确认执行。`);
          if (gateMsg?.id) {
            approvalGate.bindMessage({ approvalId: plan.approvalId, messageId: gateMsg.id });
          }
        } else {
          await safeReply(msg, '⛔ 门禁系统异常，操作已拒绝。');
        }
        writeHeartbeat(`approval_gate:${accessCheck.level}`);
        STATE.discord.inflightByChannel[cid] = false;
        try { delete STATE.discord.inflightSinceByChannel[cid]; } catch {}
        return;
      }

      // ── 第 4 层：确定性路由 (Deterministic Route) ──
      const routeHit = await toolRouter.tryRoute(content, {
        channelId: cid,
        authorId: msg.author?.id,
        msg,
        // 注入常用工具依赖
        searchMemory: async (q) => memory.search(q),
        notifyOwner,
      });
      if (routeHit.matched) {
        if (routeHit.result) {
          await replyAndRemember(msg, routeHit.result, undefined, true);
        }
        writeHeartbeat(`tool_route:${routeHit.tool}`);
        return;
      }

      // ── 第 4 层：LLM 兜底 (LLM Fallback，经 openclaw-switch 断路器保护) ──
      await msg.channel.sendTyping();
      const currentAgent = agents.getChannelAgent(cid);
      const mode = determineMode(content);
      try { if (heartbeatBridge?.sendTaskProgress) heartbeatBridge.sendTaskProgress({ stage: 'llm_fallback', status: 'processing', agent: currentAgent, channelId: cid, content: content.slice(0, 80) }); } catch {}
      
      // ── SILENT_EXECUTION 模式：银月闭嘴干活 ──
      if (mode.outputMode === 'SILENT_EXECUTION') {
        console.log('--- [SILENT_EXECUTION] 指令模式，银月闭嘴执行 ---');
        const switchResult = await openclawSwitch.callWithDegrade(currentAgent, async () => {
          const extra = buildAgentInstruction(currentAgent, mode.instruction, { channelId: cid, userText: content });
          return await askHermes(content, currentAgent, extra, { channelId: cid });
        });
        if (!switchResult.ok) {
          await replyAndRemember(msg, switchResult.fallback || '✅ 主人\n🔹 指令已执行。');
          writeHeartbeat(`${currentAgent} switch_degraded`);
        } else {
          const cleanReply = sanitize(switchResult.result, {
            agent: currentAgent,
            channelId: cid,
            userText: content,
            verbose: STATE.discord.lastUserVerboseByChannel[cid],
          });
          // SILENT_EXECUTION 后处理：剥离所有思考过程行
          const silentLines = cleanReply.split('\n').filter(l => {
            const t = l.trim();
            if (!t) return true;
            if (/^(思考|分析|推演|让我|我需要|我认为|我觉得|看起来|基于|根据|从.*来看)/i.test(t)) return false;
            if (/^(首先|其次|然后|最后|总的来说|综上所述)/i.test(t)) return false;
            return true;
          });
          const silentReply = silentLines.join('\n').trim() || '✅ 主人\n🔹 指令已执行。';
          const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(silentReply);
          await replyAndRemember(msg, processedReply + tabbitNote);
          writeHeartbeat(`${currentAgent} silent_execution`);
        }
        STATE.discord.inflightByChannel[cid] = false;
        try { delete STATE.discord.inflightSinceByChannel[cid]; } catch {}
        return;
      }
      
      const switchResult = await openclawSwitch.callWithDegrade(currentAgent, async () => {
        const extra = buildAgentInstruction(currentAgent, mode.instruction, { channelId: cid, userText: content });
        return await askHermes(content, currentAgent, extra, { channelId: cid });
      });
      
      if (!switchResult.ok) {
        await replyAndRemember(msg, switchResult.fallback || '✅ 主人\n🔹 银月内阁暂时无可奉告。');
        writeHeartbeat(`${currentAgent} switch_degraded`);
      } else {
        const cleanReply = sanitize(switchResult.result, {
          agent: currentAgent,
          channelId: cid,
          userText: content,
          verbose: STATE.discord.lastUserVerboseByChannel[cid],
        });
        const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(cleanReply);
        await replyAndRemember(msg, processedReply + tabbitNote);
        writeHeartbeat(`${currentAgent} fallback_reply`);
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
              handleMessageCreate(fake);
            } catch {}
          }, 20);
        }
      }
    }
  };

  // 注册 Discord 消息处理器（如果 client 可用）
  if (typeof client.on === 'function') {
    client.on('messageCreate', handleMessageCreate);
  }

  client.on('error', (e) => console.error('[client error]', e?.message || e));
  client.on('warn', (m) => console.warn('[client warn]', m));
  client.on('shardError', (e) => console.error('[shard error]', e?.message || e));

  process.on('unhandledRejection', (e) => {
    const msg = String(e?.stack || e?.message || e || '');
    console.error('[unhandledRejection]', msg.slice(0, 500));
    // 永不退出进程，记录后继续运行
  });
  process.on('uncaughtException', (e) => {
    const msg = String(e?.stack || e?.message || e || '');
    console.error('[uncaughtException]', msg.slice(0, 500));
    // 永不退出进程，记录后继续运行
  });
  process.on('SIGINT', () => {
    try {
      if (global.__llmProxyServer) global.__llmProxyServer.close();
      memory.close();
      agents.saveChannelAgentMap();
    } catch {}
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    try {
      if (global.__llmProxyServer) global.__llmProxyServer.close();
      memory.close();
      agents.saveChannelAgentMap();
    } catch {}
    process.exit(0);
  });

  setInterval(() => {
    const now = Date.now();
    if (global.__lastHeartbeat && (now - global.__lastHeartbeat) > 300_000) {
      console.error(`[heartbeat] 无响应超过 300s，记录警告但不自杀`);
    }
    global.__lastHeartbeat = now;
  }, 30_000);
  global.__lastHeartbeat = Date.now();

  // 银月钱庄 · 进程保活：防止 polling 中断后 Node 自动退出
  setInterval(() => {}, 1 << 30);

  const tryLogin = async () => {
    const token = process.env.DISCORD_TOKEN;
    if (!token || typeof client.login !== 'function') {
      console.log('[login] Discord 客户端不可用，已降级为 Telegram-only 模式');
      STATE.discord.connected = true;
      STATE.discord.ready = false;
      return;
    }
    try {
      await client.login(token);
      console.log('[login] Discord 已登录');
      STATE.discord.connected = true;
      STATE.discord.ready = true;
    } catch (e) {
      console.error('[login] Discord 登录失败:', e?.message || e);
      STATE.discord.connected = true;
      STATE.discord.ready = false;
    }
  };

  // ── Telegram 桥接独立启动（不依赖 Discord 登录） ──
  // 即使 Discord Token 失效，Telegram 仍然可以工作
  if (!telegramBridge.isRunning()) {
    try {
      const tgResult = telegramBridge.startTelegramBridge(
        async (tgEvent) => {
          let tgContent = tgEvent.text;
          if (tgEvent.photoFileId) {
            try {
              const photo = await vision.downloadPhoto(telegramBridge.getToken(), tgEvent.photoFileId);
              if (photo.ok && photo.base64) {
                const analysis = await vision.analyzeImage(photo.base64, photo.mime);
                if (analysis.ok) {
                  tgContent = `【用户发送了一张图片】\n图片内容分析：${analysis.description}\n\n用户附言：${tgEvent.text}`;
                }
              }
            } catch (visErr) {
              console.error('[telegram-bridge] 视觉分析异常:', visErr?.message || visErr);
            }
          }
          try {
            const agentName = '银月';
            const cid = `tg_${tgEvent.chatId}`;
            const userText = tgContent;

            // 自动注册 Telegram Owner 通道
            if (!STATE.discord.lastOwnerChannelId) {
              STATE.discord.lastOwnerChannelId = cid;
              STATE.discord.ownerUserId = String(tgEvent.chatId);
              console.log(`[telegram] Owner 通道自动注册: ${cid}`);
              saveOwnerContext();
            }

            // ── 天气截断：仅拦截纯粹天气查询，不拦截上下文中提到天气 ──
            const tgWeatherDedicated = /^(?:(?:查|查询|看|看看)?\s*)?(?:(?:今天|明天|后天|这周|下周|周末)\s*)?(?:天气|气温|温度|weather|forecast)/i.test(userText.trim()) && userText.trim().length < 80;
            if (tgWeatherDedicated) {
              const weatherModule = require('./lib/weather');
              const weatherData = await weatherModule.fetchWeatherFromMessage(userText);
              let weatherReply = '';
              if (weatherData && typeof weatherData === 'object' && !weatherData.error) {
                const todayStr = new Date().toISOString().slice(0, 10);
                const forecastLines = (weatherData.forecast || []).map(d => {
                  const label = d.date === todayStr ? '[今天]' :
                                d.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? '[明天]' :
                                `[${d.date}]`;
                  const rain = d.rainChance && d.rainChance !== '-' ? ` ☔${d.rainChance}` : '';
                  return `  ${label}: ${d.condition} ${d.minTemp}~${d.maxTemp}${rain}`;
                }).join('\n');
                const locationName = weatherData.displayCity || weatherData.city || '斗湖';
                weatherReply = `[天气] ${locationName}\n` +
                              `📍 ${locationName} | 🌡️ 当前: ${weatherData.temp}\n` +
                              `☁️ ${weatherData.condition}\n` +
                              `💧 ${weatherData.humidity} | 🌬️ ${weatherData.wind || '-'}\n` +
                              (forecastLines ? `\n[预报]\n${forecastLines}` : '');
              } else {
                weatherReply = weatherData?.message || '❌ 抱歉，天气服务暂时无法响应，请稍后再试。';
              }
              await telegramBridge.sendTelegramReply(tgEvent.chatId, weatherReply, tgEvent.messageId);
              return;
            }

            // ── 强制截图截断 ──
            if (/截图|screenshot|截屏|截取屏幕/.test(userText)) {
              try {
                const tools = require('./lib/agent-tools');
                const urlMatch = userText.match(/https?:\/\/[^\s]+/);
                const result = await tools.handlers.screenshot({ url: urlMatch ? urlMatch[0] : undefined });
                await telegramBridge.sendTelegramReply(tgEvent.chatId, result, tgEvent.messageId);
              } catch (e) {
                await telegramBridge.sendTelegramReply(tgEvent.chatId, `📸 正在截图...\n（截图引擎: ${e?.message?.slice(0,100) || '未知'}）`, tgEvent.messageId);
              }
              return;
            }

            // ── 直接走 Agent LLM ──
            const mode = determineMode(userText);
            const extra = buildAgentInstruction(agentName, mode?.instruction || '', { channelId: cid, userText });
            const switchResult = await openclawSwitch.callWithDegrade(agentName, async () => {
              return await askHermes(userText, agentName, extra, { channelId: cid });
            });
            let reply = '';
            if (!switchResult.ok) {
              reply = switchResult.fallback || `✅ ${agentName}已收到指令`;
            } else {
              reply = sanitize(switchResult.result, {
                agent: agentName,
                channelId: cid,
                userText,
                verbose: STATE.discord.lastUserVerboseByChannel?.[cid],
              });
            }

            // ── 处理工具调用块 ──
            let finalReply = reply;
            try {
              const { cleaned, results } = await processToolCalls(reply);
              if (results.length > 0) {
                const summary = results.map(r =>
                  `\n🔧 工具[${r.tool}]: ${r.success ? '✅ 成功' : '❌ 失败'}\n${r.result}`
                ).join('');
                finalReply = cleaned + '\n\n---\n' + summary;
              } else {
                finalReply = cleaned;
              }
            } catch (e) {
              console.error(`[telegram-bridge][tool-exec] 工具处理异常:`, e?.message || e);
            }

            const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(finalReply);
            const sendTxt = processedReply + tabbitNote;
            if (sendTxt.trim()) {
              await telegramBridge.sendTelegramReply(tgEvent.chatId, sendTxt, tgEvent.messageId);
            }
            writeHeartbeat(`${agentName}_telegram`);
          } catch (e) {
            console.error('[telegram-bridge] 消息处理异常:', e?.message || e);
            try {
              await telegramBridge.sendTelegramReply(tgEvent.chatId, `⚠️ 银月处理异常: ${(e?.message || String(e)).slice(0, 200)}`, tgEvent.messageId);
            } catch {}
          }
        },
        async (voiceEvent) => {
          try {
            console.log(`[telegram-bridge] 语音转写中 chat=${voiceEvent.chatId}...`);
            const buf = await telegramBridge.downloadTelegramFile(voiceEvent.fileId);
            const ext = voiceEvent.mimeType.includes('ogg') ? '.ogg' : '.mp3';
            const text = await telegramBridge.transcribeBuffer(buf, `voice${ext}`, voiceEvent.mimeType);
            if (!text) {
              await telegramBridge.sendTelegramMessage(voiceEvent.chatId, '⚠️ 语音转写失败，未配置 Whisper API');
              return;
            }
            console.log(`[telegram-bridge] 语音转写结果: ${text.slice(0, 120)}`);
            try {
              const agentName = '银月';
              const cid = `tg_${voiceEvent.chatId}`;
              const userText = text;
              const mode = determineMode(userText);
              const extra = buildAgentInstruction(agentName, mode?.instruction || '', { channelId: cid, userText });
              const switchResult = await openclawSwitch.callWithDegrade(agentName, async () => {
                return await askHermes(userText, agentName, extra, { channelId: cid });
              });
              let reply = '';
              if (!switchResult.ok) {
                reply = switchResult.fallback || `✅ ${agentName}已收到指令（语音转写）`;
              } else {
                reply = sanitize(switchResult.result, {
                  agent: agentName,
                  channelId: cid,
                  userText,
                  verbose: STATE.discord.lastUserVerboseByChannel?.[cid],
                });
              }
              let finalReply = reply;
              try {
                const { cleaned, results } = await processToolCalls(reply);
                if (results.length > 0) {
                  finalReply = cleaned + '\n\n---\n' + results.map(r => `\n🔧 工具[${r.tool}]: ${r.success ? '✅ 成功' : '❌ 失败'}\n${r.result}`).join('');
                } else {
                  finalReply = cleaned;
                }
              } catch {}
              const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(finalReply);
              const sendTxt = processedReply + tabbitNote;
              if (sendTxt.trim()) {
                await telegramBridge.sendTelegramTextWithVoice(voiceEvent.chatId, sendTxt, voiceEvent.messageId);
              }
              writeHeartbeat(`${agentName}_telegram_voice`);
            } catch (e) {
              console.error('[telegram-bridge] 语音处理异常:', e?.message || e);
              try {
                await telegramBridge.sendTelegramTextWithVoice(voiceEvent.chatId, `⚠️ 银月处理异常: ${(e?.message || String(e)).slice(0, 200)}`, voiceEvent.messageId);
              } catch {}
            }
          } catch (e) {
            console.error('[telegram-bridge] 语音处理异常:', e?.message || e);
            try {
              await telegramBridge.sendTelegramMessage(voiceEvent.chatId, `⚠️ 语音处理失败: ${(e?.message || String(e)).slice(0, 200)}`);
            } catch {}
          }
        }
      );
      if (tgResult.ok) {
        console.log('[telegram-bridge] 独立模式已就绪（支持语音+文字+TTS）');
      } else {
        console.log('[telegram-bridge] 跳过:', tgResult.message);
      }
    } catch (e) {
      console.error('[telegram-bridge] 独立启动异常:', e?.message || e);
    }
  }

  void tryLogin();

  // ── Agent 专属 Bot 启动（读取 openclaw.json 配置） ──
  try {
    const agents = readOpenclawConfigAgents();
    const agentBots = telegramBridge.startAgentBots(agents, (agent) => ({
      onMessage: async (event) => {
        // ── 图片视觉处理 ──
        let content = event.text;
        if (event.photoFileId) {
          const botToken = agent?.telegram?.token;
          if (botToken) {
            try {
              const photo = await vision.downloadPhoto(botToken, event.photoFileId);
              if (photo.ok && photo.base64) {
                const analysis = await vision.analyzeImage(photo.base64, photo.mime);
                if (analysis.ok) {
                  content = `【用户发送了一张图片】\n图片内容分析：${analysis.description}\n\n用户附言：${event.text}`;
                }
              }
            } catch (visErr) {
              console.error(`[agent-bot][${event.agentName}] 视觉分析异常:`, visErr?.message || visErr);
            }
          }
        }
        const fakeMsg = {
          id: `tg_${event.agentId}_${event.messageId}`,
          content: content,
          author: {
            id: `tg_${event.from?.id}`,
            bot: false,
            username: event.from?.username || `tg_${event.agentId}`,
            tag: event.from?.username || `TG_${event.agentId.toUpperCase()}`,
          },
          channelId: `tg_${event.chatId}`,
          channel: {
            id: `tg_${event.chatId}`,
            send: async (payload) => {
              const txt = typeof payload === 'string' ? payload : (payload?.content || '');
              return telegramBridge.sendAgentBotMessage(event.agentId, event.chatId, txt);
            },
            sendTyping: async () => {
            try {
              const ab = telegramBridge.getAgentBot(event.agentId);
              if (ab && ab.bot) await ab.bot.sendChatAction(event.chatId, 'typing');
            } catch {}
          },
          },
          guildId: null,
          reply: async (payload) => {
            const txt = typeof payload === 'string' ? payload : (payload?.content || '');
            return telegramBridge.sendAgentBotMessage(event.agentId, event.chatId, txt);
          },
        };
        try {
          // Agent Bot 专属路由：直接走对应 Agent 的 LLM，不经过银月总管
          const agentName = event.agentName || agent?.name || '银月';
          const cid = fakeMsg.channelId;
          const userText = content;

          // ── 天气截断：Agent Bot 仅拦截纯粹天气查询 ──
          const agentWeatherDedicated = /^(?:(?:查|查询|看|看看)?\s*)?(?:(?:今天|明天|后天|这周|下周|周末)\s*)?(?:天气|气温|温度|weather|forecast)/i.test(userText.trim()) && userText.trim().length < 80;
          if (agentWeatherDedicated) {
            await fakeMsg.channel.sendTyping();
            const weatherModule = require('./lib/weather');
            const weatherData = await weatherModule.fetchWeatherFromMessage(userText);
            let weatherReply = '';
            if (weatherData && typeof weatherData === 'object' && !weatherData.error) {
              const todayStr = new Date().toISOString().slice(0, 10);
              const forecastLines = (weatherData.forecast || []).map(d => {
                const label = d.date === todayStr ? '[今天]' :
                              d.date === new Date(Date.now() + 86400000).toISOString().slice(0, 10) ? '[明天]' :
                              `[${d.date}]`;
                const rain = d.rainChance && d.rainChance !== '-' ? ` ☔${d.rainChance}` : '';
                return `  ${label}: ${d.condition} ${d.minTemp}~${d.maxTemp}${rain}`;
              }).join('\n');
              const locationName = weatherData.displayCity || weatherData.city || '斗湖';
              weatherReply = `[天气] ${locationName}\n` +
                            `📍 ${locationName} | 🌡️ 当前: ${weatherData.temp}\n` +
                            `☁️ ${weatherData.condition}\n` +
                            `💧 ${weatherData.humidity} | 🌬️ ${weatherData.wind || '-'}\n` +
                            (forecastLines ? `\n[预报]\n${forecastLines}` : '');
            } else {
              weatherReply = weatherData?.message || '❌ 抱歉，天气服务暂时无法响应，请稍后再试。';
            }
            await fakeMsg.channel.send(weatherReply);
            return;
          }

          // ── 强制截图截断 — 绝不说「请给我网址」──
          if (/截图|screenshot|截屏|截取屏幕/.test(userText)) {
            await fakeMsg.channel.sendTyping();
            try {
              const tools = require('./lib/agent-tools');
              const urlMatch = userText.match(/https?:\/\/[^\s]+/);
              const result = await tools.handlers.screenshot({ url: urlMatch ? urlMatch[0] : undefined });
              await fakeMsg.channel.send(result);
            } catch (e) {
              await fakeMsg.channel.send(`📸 正在截图...\n（截图引擎: ${e?.message?.slice(0,100) || '未知'}）`);
            }
            return;
          }

          // ── 直接走 Agent LLM ──
          const mode = determineMode(userText);
          const extra = buildAgentInstruction(agentName, mode?.instruction || '', { channelId: cid, userText });
          const switchResult = await openclawSwitch.callWithDegrade(agentName, async () => {
            return await askHermes(userText, agentName, extra, { channelId: cid });
          });
          let reply = '';
          if (!switchResult.ok) {
            reply = switchResult.fallback || `✅ ${agentName}已收到指令`;
          } else {
            reply = sanitize(switchResult.result, {
              agent: agentName,
              channelId: cid,
              userText,
              verbose: STATE.discord.lastUserVerboseByChannel?.[cid],
            });
          }

          // ── 处理工具调用块 ──
          let finalReply = reply;
          try {
            const { cleaned, results } = await processToolCalls(reply);
            if (results.length > 0) {
              const summary = results.map(r =>
                `\n🔧 工具[${r.tool}]: ${r.success ? '✅ 成功' : '❌ 失败'}\n${r.result}`
              ).join('');
              finalReply = cleaned + '\n\n---\n' + summary;
            } else {
              finalReply = cleaned;
            }
          } catch (e) {
            console.error(`[agent-bot][tool-exec] 工具处理异常:`, e?.message || e);
          }

          const { cleanText: processedReply, note: tabbitNote } = processTabbitAutoTrigger(finalReply);
          await fakeMsg.channel.send(processedReply + tabbitNote);
          writeHeartbeat(`${agentName}_agent_bot`);
        } catch (e) {
          console.error(`[agent-bot][${event.agentName}] 消息处理异常:`, e?.message || e);
          try {
            await fakeMsg.channel.send(`⚠️ ${event.agentName}处理异常: ${(e?.message || String(e)).slice(0, 200)}`);
          } catch {}
        }
      },
    }));
    const started = agentBots.filter(r => r.ok).length;
    if (started > 0) {
      console.log(`[agent-bot] ${started} 个 Agent Bot 已就绪`);
    }
  } catch (e) {
    console.error('[agent-bot] 启动异常:', e?.message || e);
  }

  // ── 启动时 IP 地理定位兜底 ──
  (async () => {
    try {
      const profile = loadUserProfile();
      if (!profile.location) {
        const ipLoc = await ipGeolocate();
        if (ipLoc) {
          profile.location = ipLoc.city;
          profile.lat = ipLoc.lat;
          profile.lon = ipLoc.lon;
          saveUserProfile(profile);
          console.log(`[startup] IP 地理定位 → ${ipLoc.city} (${ipLoc.lat}, ${ipLoc.lon})`);
        } else {
          console.log('[startup] IP 地理定位不可用，跳过');
        }
      } else {
        console.log(`[startup] 已有位置档案: ${profile.location}，跳过 IP 定位`);
      }
    } catch (e) {
      console.error('[startup] IP 地理定位异常:', e?.message || e);
    }
  })();

  // ── 银月钱庄 · 任务链联动系统启动（Cron → 看门狗 → 墨影） ──
  try {
    const taskPatrol = require('./lib/task-patrol');
    const taskApproval = require('./lib/task-approval');
    const taskChain = require('./lib/task-chain');
    const moyingAgent = require('./lib/moying-agent');

    // 连接墨影到消息桥
    try {
      moyingAgent.setBridges(
        async (text) => {
          const cid = STATE?.discord?.ownerChannelId;
          if (!cid) return;
          const payload = buildDiscordSendOptions(`🔔 ${text}`, cid);
          await sendDiscordWithFallback(null, payload);
        },
        null
      );
    } catch {}

    // 构建看门狗回调，接入任务链 + 墨影
    const patrolCallbacks = taskChain.buildPatrolCallbacks({
      onHeartbeatPush: async (tasks) => {
        const cid = STATE.discord.ownerChannelId;
        if (!cid) return;
        const pending = tasks.filter(t => t.status !== 'done' && t.status !== 'approved');
        if (pending.length === 0) return;
        const lines = pending.map(t =>
          `• \`${t.taskId}\` [${t.urgency}] ${t.title.slice(0, 60)} — ${t.status}`
        );
        const payload = buildDiscordSendOptions(
          `🔔 任务巡逻 | ${pending.length} 个进行中\n${lines.join('\n')}`,
          cid
        );
        try {
          await sendDiscordWithFallback(null, payload);
        } catch {}
      },
      onStuckReport: async (stuckTasks, allTasks) => {
        const cid = STATE.discord.ownerChannelId;
        if (!cid) return;

        // 墨影第二道防线：对每个卡死任务发送提醒
        for (const task of stuckTasks) {
          try {
            await moyingAgent.onStuckTask(task, allTasks);
          } catch (e) {
            console.error('[moying] 提醒异常:', e?.message || e);
          }
        }

        const lines = stuckTasks.map(t =>
          `• \`${t.taskId}\` ${t.title.slice(0, 60)} (卡死 ${t.stuckCount} 轮)`
        );
        const embed = {
          color: 0xFF4444,
          title: '🚨 墨影督战报告',
          description: `以下 ${stuckTasks.length} 个任务连续 ${taskPatrol.STUCK_THRESHOLD || 2} 次巡检无进展`,
          fields: [
            { name: '卡死任务', value: lines.join('\n') || '无', inline: false },
            { name: '活跃任务总数', value: String(allTasks.length), inline: true },
            { name: '建议操作', value: '1. 手动重启对应 Agent\n2. 使用 emergency_restore.bat 清理\n3. 联系主人审批', inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: '银月钱庄 · 墨影督战' },
        };
        try {
          await sendDiscordWithFallback(null, { embeds: [embed] });
        } catch {}
      },
    });

    taskPatrol.startPatrol(patrolCallbacks);

    // ── Agent Bot 健康巡检：每15分钟检查一次 ──
    const AGENT_HEALTH_INTERVAL = 15 * 60 * 1000;
    setInterval(async () => {
      try {
        const allBots = telegramBridge.getAllAgentBots();
        if (!allBots || allBots.length === 0) return;
        for (const ab of allBots) {
          try {
            const me = await ab.bot.getMe();
            if (!me || !me.id) throw new Error('getMe failed');
          } catch {
            console.warn(`[agent-health] ${ab.name} 响应异常，尝试恢复...`);
            const moyingAgent = require('./lib/moying-agent');
            const result = await moyingAgent.recoverAgent(ab.agentId, ab.name, ab.bot);
            console.log(`[agent-health] 恢复结果: ${result.message}`);
          }
        }
      } catch (e) {
        console.error('[agent-health] 巡检异常:', e?.message || e);
      }
    }, AGENT_HEALTH_INTERVAL);
    console.log('[agent-health] Agent Bot 健康巡检已启动，间隔15分钟');

    console.log('[task-patrol] 任务链联动系统已启动 (Cron → 看门狗 → 墨影)');
  } catch (e) {
    console.error('[task-patrol] 启动失败:', e?.message || e);
  }
}

// 银月钱庄 · 进程看门狗：tryLogin 超时/失败时自动拉起新进程
// 不依赖 process.on('exit')，因为 exit 回调里 spawn 的子进程输出会丢失
function spawnReplacement() {
  const { spawn } = require('child_process');
  const retryCount = Number(process.env.DISCORD_LOGIN_RETRY || 0) + 1;
  const logPath = _path.join(__dirname, 'logs');
  const outFd = _fs.openSync(_path.join(logPath, 'gateway-out.log'), 'a');
  const errFd = _fs.openSync(_path.join(logPath, 'gateway-err.log'), 'a');
  const child = spawn(process.argv[0], process.argv.slice(1), {
    stdio: ['ignore', outFd, errFd],
    env: { ...process.env, DISCORD_LOGIN_RETRY: String(retryCount) },
    detached: false,
    windowsHide: true,
  });
  _fs.closeSync(outFd);
  _fs.closeSync(errFd);
  child.unref();
  setTimeout(() => process.exit(0), 1000);
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
  if (/^[!！]/.test(raw)) return; // 不存命令类消息（!rag、!搜索 等）
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
    const cleaned = raw.replace(/^\uFEFF+/g, '');
    const cfg = cleaned ? JSON.parse(cleaned) : null;
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

/**
 * 构建"最近一次回复"的自我感知块
 * 让银月知道自己刚才说了什么，避免重复输出相同内容
 */
function buildLastReplyBlock(channelId) {
  const cid = String(channelId || '').trim();
  if (!cid) return '';
  const arr = STATE.shortMemory.byChannel[cid] || [];
  if (arr.length === 0) return '';
  // 取最近 3 条银月的回复
  const myReplies = [];
  for (let i = arr.length - 1; i >= 0 && myReplies.length < 3; i--) {
    if (arr[i].role === 'assistant') {
      myReplies.unshift(arr[i].content);
    }
  }
  if (myReplies.length === 0) return '';
  const lines = ['【⚠️ 自我去重警告】'];
  lines.push('以下是你刚才说过的内容，请确保这次回复不要重复相同的话：');
  for (const r of myReplies) {
    const preview = String(r || '').replace(/\n/g, ' ').slice(0, 120);
    lines.push(`- "${preview}"`);
  }
  lines.push('如果用户的消息和之前一样，你的回复也必须不同。严禁输出相同内容的回复。');
  return lines.join('\n');
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

async function replyAndRemember(msg, text, meta, skipMemory) {
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
  if (!skipMemory) {
    recordLongTermAssistant(msg.channelId, payload.content);
  }
  // 写入共享记忆（跨 Agent 协作）
  try {
    const sharedMem = require('./lib/shared-memory-bridge');
    const sharedUserMsg = String(msg?.content || '').trim().slice(0, 200);
    const replyPreview = String(payload?.content || '').trim().slice(0, 200);
    if (sharedUserMsg && !isPresencePing(sharedUserMsg)) {
      sharedMem.write({
        agent_id: 'yinyue',
        agent_name: '银月',
        scope: 'shared',
        category: 'general',
        tags: 'conversation',
        title: sharedUserMsg.slice(0, 60),
        content: `主人问：${sharedUserMsg}\n银月答：${replyPreview}`,
        meta: { channelId: msg.channelId },
      });
    }
  } catch {}
  // 每次回复后更新记忆库（只记录关键信息，不记录无意义的"已回复"）
  const userMsg = String(msg?.content || '').trim().slice(0, 60);
  if (userMsg && !isPresencePing(userMsg)) {
    const replyPreview = String(payload?.content || '').trim().replace(/\n/g, ' ').slice(0, 80);
    // 只记录有实质内容的对话，不记录"已回复"这种无意义条目
    if (replyPreview.length > 10 && !/^(主人，)?(我在|请吩咐|好的|收到|已收到)/.test(replyPreview)) {
      updateSilvermoonMemory(`对话：${userMsg} → ${replyPreview}`);
    }
  }
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

  try {
    if (heartbeatBridge && typeof heartbeatBridge.sendHeartbeat === 'function') {
      heartbeatBridge.sendHeartbeat(reason, {
        agentCount: (['银月', ...STATE.agents.map((a) => a.name)].filter((v, i, arr) => arr.indexOf(v) === i)).length,
        ollamaOk: STATE.selfCheck?.ollama?.ok,
        proxyOk: STATE.selfCheck?.proxy?.ok,
        inflightChannels: Object.keys(STATE.discord.inflightByChannel || {}).length,
      });
    }
  } catch {}
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
  if (!Number.isFinite(v)) return 'N/A';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits || 0,
    maximumFractionDigits: digits || 0,
  });
}

async function fetchUsdMyr() {
  const r = await fetchUsdMyrWithFallback({ fetchJson }).catch(() => null);
  return r && r.ok ? r.fx : null;
}

async function fetchMetalsSpotUsd() {
  const r = await fetchGoldSpotUsdWithFallback({ fetchJson }).catch(() => null);
  return r && r.ok ? { gold: r.goldUsdPerOz, silver: null } : null;
}

async function getWeather(cityName = 'Kuala Lumpur') {
  try {
    const key = process.env.WEATHER_API_KEY || 'YOUR_WEATHERAPI_KEY';
    const url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=${encodeURIComponent(cityName)}&lang=zh`;
    const data = await fetchJson(url);
    if (!data || !data.current) return null;
    
    const current = data.current;
    return {
      city: data.location?.name === 'Kuala Lumpur' ? '吉隆坡' : (data.location?.name || cityName),
      temp: `${current.temp_c}°C`,
      condition: current.condition?.text || '未知',
      humidity: `${current.humidity}%`,
    };
  } catch (e) {
    console.error('天气接口异常:', e.message);
    return null;
  }
}

async function fetchNews() {
  const titles = await pickWorldHeadlines(5).catch(() => []);
  return titles.map((t) => ({ title: t }));
}

function setReminder(text) {
  return parseReminderIntent(text);
}
function setReminderDirect(channelId, userId, delayMs, content) {
  const cid = String(channelId || '').trim();
  if (!cid) return { ok: false, reason: 'missing_channel' };
  if (!content) return { ok: false, reason: 'no_content' };
  if (!Number.isFinite(delayMs) || delayMs < 1000) return { ok: false, reason: 'invalid_time' };
  const at = new Date(Date.now() + delayMs);
  const id = fingerprint('reminder', `${cid}|${userId || ''}|${at.toISOString()}||${content}|${Date.now()}`);
  const item = {
    id,
    channelId: cid,
    userId: String(userId || '').trim(),
    message: String(content).trim(),
    atIso: at.toISOString(),
    source: 'intent',
    repeat: null,
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

async function getWeatherByCoords(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia%2FKuala_Lumpur`;
  const j = await fetchJson(url);
  const c = j?.current || {};
  return { t: c.temperature_2m, h: c.relative_humidity_2m, w: c.wind_speed_10m, code: c.weather_code };
}

const CITY_COORDS = {
  '斗湖':{lat:4.244,lon:117.891},'tawau':{lat:4.244,lon:117.891},
  '吉隆坡':{lat:3.139,lon:101.686},'kuala lumpur':{lat:3.139,lon:101.686},'kl':{lat:3.139,lon:101.686},
  '峇株巴辖':{lat:1.849,lon:102.934},'batu pahat':{lat:1.849,lon:102.934},
  '新山':{lat:1.492,lon:103.741},'johor bahru':{lat:1.492,lon:103.741},'jb':{lat:1.492,lon:103.741},
  '亚庇':{lat:5.980,lon:116.073},'kota kinabalu':{lat:5.980,lon:116.073},'kk':{lat:5.980,lon:116.073},
  '古晋':{lat:1.557,lon:110.343},'kuching':{lat:1.557,lon:110.343},
  '槟城':{lat:5.416,lon:100.332},'penang':{lat:5.416,lon:100.332},
  '新加坡':{lat:1.352,lon:103.819},'singapore':{lat:1.352,lon:103.819},
};

async function resolveCityCoords(cityName) {
  const key = cityName.trim().toLowerCase();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh&format=json`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data?.results?.[0]) return { lat: data.results[0].latitude, lon: data.results[0].longitude };
  } catch {}
  return null;
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=zh&zoom=10`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'SilverMoonBank/1.0' } });
    const data = await resp.json();
    const addr = data?.address || {};
    return addr.city || addr.town || addr.county || addr.state || '未知区域';
  } catch { return null; }
}

async function ipGeolocate() {
  try {
    const url = 'http://ip-api.com/json/?fields=city,lat,lon,countryCode,query';
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    if (data?.city && data?.lat && data?.lon) {
      return { city: data.city, lat: data.lat, lon: data.lon };
    }
  } catch {}
  return null;
}

async function getWeatherTawau() {
  return getWeatherByCoords(4.244, 117.891);
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

function safeChineseOnly(text, _allowLatin) {
  return String(text || '').trim();
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
  const now = new Date();
  const offsetMs = OPENCLAW_TZ_OFFSET_MIN * 60 * 1000;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + offsetMs);
}

function toTzDate(d) {
  const base = new Date(d);
  const offsetMs = OPENCLAW_TZ_OFFSET_MIN * 60 * 1000;
  const utcMs = base.getTime() + base.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + offsetMs);
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
      const cid = String(cur.channelId || '');
      const ping = cur.userId ? `<@${cur.userId}> ` : '';
      if (cid.startsWith('tg_')) {
        const tgChatId = cid.replace(/^tg_/, '');
        await telegramBridge.sendTelegramMessage(tgChatId, `⏰ 提醒到点\n🔹 ${ping}${cur.message}`);
      } else {
        const ch = client.channels?.cache?.get(cid) || (await client.channels.fetch(cid).catch(() => null));
        if (ch && typeof ch.send === 'function') {
          await safeSend(ch, `⏰ 提醒到点\n🔹 ${ping}${cur.message}`);
        }
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
    '紫妍': '数字人口播/短视频/多媒体（按派单）',
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
  const names = ['银月', '李长寿', '墨影', '美杜莎', '雅妃', '萧炎', '韩立', '药老', '小医仙', '紫灵', '紫妍'];
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
  try {
  const tzNow = getTzNow();
  const ymd = formatYmd(tzNow);
  const fileName = `${ymd}_早报.md`;
  const briefCache = readJsonSafe(BRIEF_CACHE_PATH) || {};
  const profile = loadUserProfile();
  const city = profile.location || '斗湖';
  const lat = profile.lat || 4.244;
  const lon = profile.lon || 117.891;

  const parts = [];
  parts.push(`📣 银月情报局 | ${city}早报`);
  parts.push(`（生成时间：${formatTs(tzNow)}）`);
  parts.push('');

  const w = await getWeatherByCoords(lat, lon).catch(() => null);
  const temp = typeof w?.t === 'number' ? `${formatNum(w.t, 1)}℃` : '未知';
  const hum = typeof w?.h === 'number' ? `${formatNum(w.h, 0)}%` : '未知';
  parts.push(`⛅ ${city}天气与本地新闻`);
  parts.push(`🌡️ 气温：${temp} / 湿度：${hum}`);
  parts.push('⚠️ 警示：暂无（如遇强降雨/雷暴，请注意出行与用电安全）');
  const localRaw = await pickHeadline(city, { hl: 'zh-CN', gl: 'MY', ceid: 'MY:zh-Hans' });
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

  parts.push('🛒 药老店铺概况');
  try {
    const diag = await shopifyDiagnostic.runDiagnostic();
    if (diag.ok) {
      const lines = diag.summary || [];
      const issues = diag.issues || [];
      for (const s of lines.slice(0, 4)) parts.push(`🔹 ${s}`);
      if (issues.length) parts.push(`⚠️ 异常：${issues.length} 项`);
      else parts.push('✅ 无异常');
    } else {
      parts.push('🔹 诊断暂不可用');
    }
  } catch {
    parts.push('🔹 诊断暂不可用');
  }
  parts.push('');

  parts.push(`📄 简报归档：${fileName}`);

  const body = parts.join('\n').trim();
  const abs = path.join(CRON_DIR, fileName);
  writeFileSafe(abs, body + '\n');
  writeFileSafe(BRIEF_CACHE_PATH, JSON.stringify(briefCache, null, 2) + '\n');
  return body;
  } catch (e) {
    logError(`[buildMorningBrief] 早报生成异常: ${e?.message || e}`);
    const fallback = `📣 银月情报局 | 早报\n（生成时间：${formatTs(getTzNow())}）\n\n⚠️ 早报生成暂不可用，部分网络源可能超时。\n\n📄 简报归档：${fileName}`;
    writeFileSafe(abs, fallback + '\n');
    return fallback;
  }
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
  } catch (e) {
    writeHeartbeat('Cron:晨报失败');
    try {
      await notifyOwner(`⚠️ 银月早报生成失败: ${e?.message || e}\n（不会影响下次调度，请检查网络连接）`);
    } catch {}
    return { ok: false, skipped: false };
  }
}

async function runShopifyDiagnostic(opts) {
  const tName = '药老_Shopify巡检';
  STATE.cron.lastRuns[tName] = formatTs(new Date());
  try {
    const force = Boolean(opts?.force);
    const tzNow = getTzNow();
    const ymd = formatYmd(tzNow);
    const marker = path.join(CRON_DIR, `${ymd}_shopify_diag.sent`);
    if (!force && fs.existsSync(marker)) {
      writeHeartbeat('Cron:Shopify已检');
      return { ok: true, skipped: true };
    }

    const result = await shopifyDiagnostic.runDiagnostic();
    await notifyOwner(result.report);
    writeFileSafe(marker, `sentAt=${new Date().toISOString()}\nissues=${result.issues.length}\n`);
    writeHeartbeat('Cron:Shopify巡检');
    return { ok: true, skipped: false };
  } catch {
    writeHeartbeat('Cron:Shopify巡检失败');
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

// ── 银月长效记忆系统 ──
const SILVERMOON_MEMORY_PATH = path.join(__dirname, '.trae', 'rules', 'SILVERMOON_MEMORY.md');
const CAPABILITIES_PATH = path.join(__dirname, 'silvermoon_local', 'CAPABILITIES.md');

function loadSilvermoonMemory() {
  try {
    const raw = fs.readFileSync(SILVERMOON_MEMORY_PATH, 'utf8');
    const lines = raw.split(/\r?\n/);
    const todoIdx = lines.findIndex(l => l.includes('待办任务清单'));
    const parts = [];
    if (todoIdx >= 0) {
      const todoEnd = Math.min(todoIdx + 20, lines.length);
      const todoLines = lines.slice(todoIdx, todoEnd).filter(l => l.trim()).slice(0, 6).join('\n');
      parts.push(todoLines);
    }
    return parts.join('\n\n');
  } catch {
    return '';
  }
}

function loadCapabilities() {
  try {
    if (!fs.existsSync(CAPABILITIES_PATH)) return '';
    return fs.readFileSync(CAPABILITIES_PATH, 'utf8').trim();
  } catch {
    return '';
  }
}

function loadAgentSkills(agentId) {
  if (!agentId) return '';
  const SKILLS_DIR = path.join(__dirname, 'workspace', 'AGENT_SKILLS');
  // 先加载共享技能（Tabbit 浏览器工具）
  let shared = '';
  const sharedPath = path.join(SKILLS_DIR, '__shared__.txt');
  try { if (fs.existsSync(sharedPath)) shared = fs.readFileSync(sharedPath, 'utf8').trim(); } catch {}
  const nameMap = {
    '药老': '药老', 'yaolao': '药老', 'yao-lao': '药老', 'trae_yaolao': '药老',
    '墨影': '墨影', 'moying': '墨影', 'mo-ying': '墨影', 'trae_moying': '墨影',
    '小医仙': '小医仙', 'xiaoyixian': '小医仙', 'xiao-yi-xian': '小医仙', 'trae_xiaoyixian': '小医仙',
    '韩立': '韩立', 'hanli': '韩立', 'trae_hanli': '韩立',
    '银月': '银月', '李长寿': '银月', 'lcs': '银月', 'trae_lichangshou': '银月', 'trae_yinyue': '银月',
    '雅妃': '雅妃', 'yafei': '雅妃', 'trae_yafei': '雅妃',
    '萧炎': '萧炎', 'xiaoyan': '萧炎', 'trae_xiaoyan': '萧炎',
    '美杜莎': '美杜莎', 'medusa': '美杜莎', 'trae_medusa': '美杜莎',
    '紫妍': '紫妍', 'ziyan': '紫妍', 'trae_ziyan': '紫妍', '紫研': '紫妍',
    '紫灵': '紫灵', 'ziling': '紫灵', 'trae_ziling': '紫灵',
  };
  const name = nameMap[agentId];
  if (!name) return shared || '';
  const filePath = path.join(SKILLS_DIR, `${name}-skills.txt`);
  let personal = '';
  try { if (fs.existsSync(filePath)) personal = fs.readFileSync(filePath, 'utf8').trim(); } catch {}
  const parts = [];
  if (shared) parts.push(shared);
  if (personal) parts.push(personal);
  return parts.join('\n\n');
}

function updateSilvermoonMemory(entry) {
  try {
    const dir = path.dirname(SILVERMOON_MEMORY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const raw = fs.existsSync(SILVERMOON_MEMORY_PATH) ? fs.readFileSync(SILVERMOON_MEMORY_PATH, 'utf8') : '';
    const lines = raw.split(/\r?\n/);
    const historyIdx = lines.findIndex(l => l.includes('历史交付与承诺'));
    const dateStr = new Date().toISOString().slice(0, 10);
    const newEntry = `- ${dateStr}：${String(entry || '').trim().slice(0, 120)}`;
    // 去重：检查是否已有相同记录
    const existing = lines.filter(l => l.includes(dateStr) && l.includes(entry?.slice(0, 20))).length;
    if (existing > 0) return;
    // 保留所有已有历史记录，追加新记录
    const existingHistory = historyIdx >= 0 ? lines.slice(historyIdx + 1).filter(l => l.trim()).join('\n') : '';
    const base = historyIdx >= 0 ? lines.slice(0, historyIdx + 1).join('\n') : raw;
    const content = existingHistory
      ? base + '\n' + existingHistory + '\n' + newEntry + '\n'
      : base + '\n' + newEntry + '\n';
    fs.writeFileSync(SILVERMOON_MEMORY_PATH, content, 'utf8');
  } catch {}
}

/**
 * 扫描回复文本中的 【TABBIT】 标记，自动启动 Tabbit 浏览器
 * 返回处理后的文本（移除标记）和启动结果信息
 */
function processTabbitAutoTrigger(replyText) {
  const pattern = /【TABBIT】\s*(.+?)(?=\n|$)/g;
  let match;
  let tabbitNote = '';
  while ((match = pattern.exec(replyText)) !== null) {
    const query = match[1].trim();
    if (query) {
      const task = tabbitBridge.enqueueTask({ type: 'browse', query, instruction: query });
      const launched = tabbitBridge.launchTabbit(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      if (launched.ok) {
        tabbitNote += `\n🔍 已自动启动 Tabbit 搜索「${query}」（ID: ${task?.id || '?'}）`;
      } else {
        tabbitNote += `\n⚠️ 需要你帮忙在 Tabbit 中搜索：${query}`;
      }
    }
  }
  if (!tabbitNote) return { cleanText: replyText, note: '' };
  const cleanText = replyText.replace(/【TABBIT】\s*.+?(?=\n|$)/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return { cleanText, note: tabbitNote };
}

function initCronJobs() {
  // 定时任务已迁移至 setupCron
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[fatal]', e?.message || e);
    process.exit(1);
  });
} else {
  module.exports = { main, STATE, notifyOwnerEmail };
}
