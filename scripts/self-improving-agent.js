const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SECTS_DIR = path.join(ROOT, 'sects');
const CONFIG_PATH = path.join(ROOT, 'openclaw.json');
const REPORT_DIR = path.join(ROOT, '.silvermoon_core', 'self_iteration');
const REPORT_PATH = path.join(REPORT_DIR, 'iteration_report.jsonl');
const MEM_DIR = path.join(ROOT, '.silvermoon_core');

// 银月钱庄已知 Agent 名录（sects/ 实际存在的）
const KNOWN_AGENTS = [
  { id: '银月', dir: '银月', regId: 'trae_yinyue' },
  { id: '李长寿', dir: '李长寿', regId: 'trae_lichangshou' },
  { id: '美杜莎', dir: '美杜莎', regId: 'trae_medusa' },
  { id: '萧炎', dir: '萧炎', regId: 'trae_xiaoyan' },
  { id: '寻宝鼠', dir: '寻宝鼠', regId: 'trae_xunbaoshu' },
  { id: '电商运营官', dir: '电商运营官', regId: 'trae_dianshang' },
  { id: '药老', dir: '药老', regId: 'trae_yaolao' },
  { id: '小医仙', dir: '小医仙', regId: 'trae_xiaoyixian' },
  { id: '韩立', dir: '韩立', regId: 'trae_hanli' },
  { id: '墨影', dir: '墨影', regId: 'trae_moying' },
  { id: '雅妃', dir: '雅妃', regId: 'trae_yafei' },
  { id: '紫研', dir: '紫研', regId: 'trae_ziyan' },
  { id: '紫灵', dir: '紫灵', regId: 'trae_ziling' },
];

// 推荐的统一模型
const RECOMMENDED_MODEL = 'nvidia/deepseek-ai/deepseek-v3.2';
const RECOMMENDED_PROVIDER = 'nvidia';

// ====== 工具函数 ======

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

function writeJSON(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function appendReport(entry) {
  ensureDir(REPORT_DIR);
  fs.appendFileSync(REPORT_PATH, JSON.stringify({
    ts: new Date().toISOString(),
    ...entry
  }) + '\n', 'utf8');
}

function fetchJSON(hostname, pathname, useSSL = true) {
  return new Promise((resolve, reject) => {
    const lib = useSSL ? https : http;
    const opts = {
      hostname,
      path: pathname,
      headers: { 'User-Agent': 'SilverMoon-SelfIteration/1.0', 'Accept': 'application/json' },
      timeout: 15000,
    };
    lib.get(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

// ====== 审计模块 ======

// 1. 审计 openclaw.json 配置
function auditOpenClawConfig() {
  const cfg = readJSON(CONFIG_PATH);
  if (!cfg) return { pass: false, issues: ['openclaw.json 读取失败'], fixes: [] };

  const issues = [];
  const fixes = [];

  // 检查 agents.defaults 配置
  const agentsBlock = cfg.agents;
  if (!agentsBlock || !agentsBlock.defaults) {
    issues.push('缺少 cfg.agents.defaults 节');
    return { pass: false, issues, fixes: [] };
  }
  if (agentsBlock.defaults.model !== RECOMMENDED_MODEL) {
    issues.push(`defaults 模型: ${agentsBlock.defaults.model} → 应统一为 ${RECOMMENDED_MODEL}`);
    fixes.push({ type: 'update_defaults_model', from: agentsBlock.defaults.model, to: RECOMMENDED_MODEL });
  }

  // 构造已注册的 id 集合 + name 集合（兼容中文名匹配）
  const agentList = agentsBlock.list || [];
  const registeredIds = new Set();
  const registeredNames = new Set();
  for (const a of agentList) {
    if (a.id) registeredIds.add(a.id);
    if (a.name) registeredNames.add(a.name);
  }

  // 检查缺失注册
  for (const agent of KNOWN_AGENTS) {
    if (!registeredIds.has(agent.id) && !registeredNames.has(agent.id)) {
      issues.push(`Agent [${agent.id}] 存在于 sects/ 但未注册到 openclaw.json`);
      fixes.push({ type: 'register_missing_agent', agent: agent.id });
    }
  }

  // 检查模型一致性
  for (const a of agentList) {
    const name = a.id || a.name || '';
    if (a.model && a.model !== RECOMMENDED_MODEL) {
      // 银月可以特殊处理（它是总管）
      if (name !== 'trae_yinyue' && name !== '银月') {
        issues.push(`Agent [${name}] 模型 ${a.model} 与推荐 ${RECOMMENDED_MODEL} 不一致`);
        fixes.push({ type: 'fix_agent_model', agent: name, from: a.model, to: RECOMMENDED_MODEL });
      }
    }
  }

  return { pass: issues.length === 0, issues, fixes };
}

// 2. 审计各 Agent TASK.json
function auditAgentTasks() {
  const issues = [];
  const fixes = [];

  for (const agent of KNOWN_AGENTS) {
    const taskPath = path.join(SECTS_DIR, agent.dir, 'TASK.json');
    const task = readJSON(taskPath);
    if (!task) {
      issues.push(`Agent [${agent.id}] TASK.json 不存在或不可读`);
      continue;
    }

    // 检查 skills 字段
    const skills = task.skills || task.skillsList || [];
    if (!Array.isArray(skills) || skills.length === 0) {
      issues.push(`Agent [${agent.id}] TASK.json skills 为空`);
      fixes.push({ type: 'agent_empty_skills', agent: agent.id });
    }

    // 检查优先级
    if (!task.priority && task.priority !== 0) {
      issues.push(`Agent [${agent.id}] TASK.json 缺少 priority`);
    }
  }

  return { pass: issues.length === 0, issues, fixes };
}

// 3. 检查银月钱庄自身版本（package.json + git tag）
async function checkOpenClawVersion() {
  let localVersion = 'unknown';
  let localTag = 'none';
  let needsUpdate = false;

  // 3a. 从 package.json 读版本号
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    localVersion = pkg.version || 'unknown';
  } catch (_) {}

  // 3b. 获取本地最新 git tag
  try {
    const execSync = require('child_process').execSync;
    localTag = execSync('git describe --tags --abbrev=0 2> nul', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (_) {}

  // 3c. 对比：package.json 版本是否已打 tag
  if (localVersion !== 'unknown' && localVersion !== '0.0.0') {
    const expectedTag = localVersion.startsWith('v') ? localVersion : `v${localVersion}`;
    if (localTag === 'none' || localTag !== expectedTag) {
      needsUpdate = true;
    }
  }

  // 3d. 可选：查我们自己的 GitHub 是否有新 release
  try {
    const gh = await fetchJSON('api.github.com', '/repos/youeshopent-debug/silvermoon-openclaw/releases/latest');
    const ghTag = gh?.tag_name || '';
    if (ghTag && ghTag !== localTag && ghTag !== 'none') {
      needsUpdate = true;
    }
  } catch (_) {}

  return {
    local: localVersion,
    latest: localTag === 'none' ? `v${localVersion}（未打 tag）` : localTag,
    needsUpdate,
    issue: needsUpdate
      ? `版本 ${localVersion} 待处理 — 当前 git tag: ${localTag}，需执行 git tag v${localVersion} && git push origin v${localVersion}`
      : null
  };
}

// 4. 自愈：应用自动修复
function applyFixes(fixes, cfg) {
  const applied = [];
  let configChanged = false;

  if (!cfg) return applied;

  for (const fix of fixes) {
    try {
      switch (fix.type) {
        case 'update_defaults_model': {
          if (!cfg.agents || !cfg.agents.defaults) break;
          cfg.agents.defaults.model = fix.to;
          if (fix.to === RECOMMENDED_MODEL) cfg.agents.defaults.provider = RECOMMENDED_PROVIDER;
          applied.push(`defaults 模型已更新: ${fix.from} → ${fix.to}`);
          configChanged = true;
          break;
        }
        case 'register_missing_agent': {
          const agentDir = KNOWN_AGENTS.find(a => a.id === fix.agent);
          if (!agentDir) break;
          const taskPath = path.join(SECTS_DIR, agentDir.dir, 'TASK.json');
          const task = readJSON(taskPath);
          // 确定配置名和 TG token
          // 清理之前留下的空 ID 条目
          cfg.agents.list = cfg.agents.list.filter(a => a.id !== 'trae_' && a.id !== '');
          const knownAgent = KNOWN_AGENTS.find(a => a.id === fix.agent);
          const agentId = knownAgent?.regId || `trae_${fix.agent.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          const defaultsSkills = cfg.agents?.defaults?.skills || [];
          cfg.agents.list.push({
            id: agentId,
            name: fix.agent,
            model: RECOMMENDED_MODEL,
            provider: RECOMMENDED_PROVIDER,
            priority: task?.priority || 5,
            telegram: { token: task?.tgToken || task?.telegramToken || '' },
            skills: [...defaultsSkills]
          });
          applied.push(`Agent [${fix.agent}] 已注册到 openclaw.json (id: ${agentId})`);
          configChanged = true;
          break;
        }
        case 'fix_agent_model': {
          const agent = cfg.agents.list.find(a => (a.id || a.name) === fix.agent);
          if (agent) {
            agent.model = fix.to;
            agent.provider = RECOMMENDED_PROVIDER;
            applied.push(`Agent [${fix.agent}] 模型已统一: ${fix.from} → ${fix.to}`);
            configChanged = true;
          }
          break;
        }
        case 'agent_empty_skills': {
          const entry = KNOWN_AGENTS.find(a => a.id === fix.agent);
          if (!entry) break;
          const skPath = path.join(SECTS_DIR, entry.dir, 'TASK.json');
          const skTask = readJSON(skPath);
          if (skTask && (!skTask.skills || skTask.skills.length === 0)) {
            skTask.skills = ['general', 'communication'];
            writeJSON(skPath, skTask);
            applied.push(`Agent [${fix.agent}] TASK.json skills 已补充为默认值`);
          }
          break;
        }
      }
    } catch (e) {
      applied.push(`修复失败 [${fix.type}]: ${e.message}`);
    }
  }

  if (configChanged) {
    // 备份旧配置
    const bakPath = CONFIG_PATH + '.bak.' + Date.now();
    fs.copyFileSync(CONFIG_PATH, bakPath);
    writeJSON(CONFIG_PATH, cfg);
    applied.push(`openclaw.json 已更新，备份: ${path.basename(bakPath)}`);
  }

  return applied;
}

// 5. 小迭代：让 Agent 能自我升级 TASK.json
function microIterateAgentTask(agentId) {
  const agentDir = KNOWN_AGENTS.find(a => a.id === agentId);
  if (!agentDir) return { updated: false, reason: 'unknown agent' };

  const taskPath = path.join(SECTS_DIR, agentDir.dir, 'TASK.json');
  const task = readJSON(taskPath);
  if (!task) return { updated: false, reason: 'no TASK.json' };

  const changes = [];

  // 检查是否缺少 skills 字段
  if (!task.skills && !task.skillsList) {
    task.skills = [];
    changes.push('added skills array');
  }

  // 检查是否缺少 priority
  if (task.priority === undefined) {
    task.priority = 5;
    changes.push('set default priority=5');
  }

  // 检查是否缺少 tgToken（如果有 TG 配置）
  if (!task.tgToken && !task.telegramToken) {
    // 从 AGENTS_SOUL 环境变量尝试提取
    const soul = process.env[`AGENTS_SOUL_${agentId.toUpperCase()}`] || process.env.AGENTS_SOUL;
    if (soul) {
      task.tgToken = soul;
      changes.push('injected TG token from env');
    }
  }

  if (changes.length > 0) {
    const bakPath = taskPath + '.bak';
    try { fs.copyFileSync(taskPath, bakPath); } catch {}
    writeJSON(taskPath, task);
    return { updated: true, changes };
  }

  return { updated: false, reason: 'no changes needed' };
}

// ====== 主入口 ======
async function run(options = {}) {
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    audit: {},
    versionCheck: null,
    autoFixes: [],
    microIterations: [],
    duration: 0,
  };

  // 1. 审计 openclaw.json
  const configAudit = auditOpenClawConfig();
  results.audit.config = configAudit;

  // 2. 审计 Agent TASK.json
  const taskAudit = auditAgentTasks();
  results.audit.tasks = taskAudit;

  // 3. 检查版本
  results.versionCheck = await checkOpenClawVersion();

  // 4. 应用自动修复（只在 autoFix=true 或 options.autoFix 时）
  if (options.autoFix !== false) {
    const cfg = readJSON(CONFIG_PATH);
    if (cfg) {
      const allFixes = [
        ...(configAudit.fixes || []),
        ...(taskAudit.fixes || [])
      ];
      if (allFixes.length > 0) {
        results.autoFixes = applyFixes(allFixes, cfg);
      }
      // 重新审计以确认修复效果
      results.audit.config = auditOpenClawConfig();
      results.audit.tasks = auditAgentTasks();
    }
  }

  // 5. 微迭代：检查所有 Agent TASK.json 是否需要补充
  for (const agent of KNOWN_AGENTS) {
    const iter = microIterateAgentTask(agent.id);
    if (iter.updated) {
      results.microIterations.push({ agent: agent.id, changes: iter.changes });
    }
  }

  results.duration = Date.now() - startTime;

  // 落盘报告
  appendReport(results);

  return results;
}

// CLI 入口
if (require.main === module) {
  const autoFix = process.argv.includes('--fix') || process.argv.includes('-f');
  run({ autoFix }).then(r => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  }).catch(e => {
    console.error('self-improving-agent error:', e.message);
    process.exit(1);
  });
}

module.exports = { run, auditOpenClawConfig, auditAgentTasks, checkOpenClawVersion, microIterateAgentTask };
