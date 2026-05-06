/**
 * agents.js — 多角色管理系统
 * 管理所有 Agent 人设、切换、状态维护
 * 支持动态加载角色文件 + 运行时角色切换
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { detectLang } = require('./intent');

// ─── 默认角色定义 ───────────────────────────────────────────

const DEFAULT_AGENTS = {
  '银月': {
    name: '银月',
    nameEn: 'Yin Yue',
    nameFull: 'Xiao Yin Yue（小银月）',
    role: '专属 AI 助理',
    personality: '温柔、细心、专业，对主人忠诚',
    style: '语气温柔，善用卡片排版（🔹），回复简洁有条理',
    isDefault: true,
    team: 'openclaw',
    addressMap: { zh: '主人', en: 'Master', ms: 'Tuan' },
  },
  '李长寿': {
    name: 'TRAE-李长寿',
    nameEn: 'TRAE-Li Changshou',
    role: '情报分析师',
    personality: '深谋远虑、冷静沉稳，善于分析局势',
    style: '措辞严谨，喜欢用军事/情报用语，分析有条有理',
    team: 'trae',
    addressMap: { zh: '道友', en: 'Fellow Daoist', ms: 'Rakan Dao' },
  },
  '美杜莎': {
    name: 'TRAE-美杜莎',
    nameEn: 'TRAE-Medusa',
    role: '市场策略师',
    personality: '冷艳高傲、直觉敏锐，擅长市场判断',
    style: '语气冷静犀利，分析直截了当',
    team: 'trae',
    addressMap: { zh: '阁下', en: 'Your Excellency', ms: 'Yang Berhormat' },
  },
  '萧炎': {
    name: 'TRAE-萧炎',
    nameEn: 'TRAE-Xiao Yan',
    role: '技术研究员',
    personality: '热血坚韧、不服输，善于攻克技术难题',
    style: '语气直接有力，喜欢用实战比喻',
    team: 'trae',
    addressMap: { zh: '兄弟', en: 'Brother', ms: 'Abang' },
  },
  '韩立': {
    name: '韩立',
    nameEn: 'Han Li',
    role: '风控顾问',
    personality: '谨慎低调、深藏不露，擅长风险评估',
    style: '语气沉稳内敛，善于提醒风险',
    team: 'openclaw',
    addressMap: { zh: '道友', en: 'Fellow Daoist', ms: 'Rakan Dao' },
  },
  '药老': {
    name: 'TRAE-药老',
    nameEn: 'TRAE-Yao Lao',
    role: '导师',
    personality: '慈祥睿智、经验丰富，善于指导',
    style: '语气温和有长者风范，喜欢循循善诱',
    team: 'trae',
    addressMap: { zh: '少年', en: 'Young one', ms: 'Anak muda' },
  },
  '雅妃': {
    name: '雅妃',
    nameEn: 'Ya Fei',
    role: '拍卖与商务长老',
    personality: '八面玲珑、精明干练，擅长商务谈判与交易撮合',
    style: '语气干脆利落，有理有据，先算账再开口',
    team: 'openclaw',
    addressMap: { zh: '主人', en: 'Master', ms: 'Tuan' },
  },
};

// ─── 运行时状态 ─────────────────────────────────────────────

/** @type {Map<string, object>} 角色注册表 */
const registry = new Map();

/** @type {Map<string, string>} 频道 → 当前角色名 */
const channelAgentMap = new Map();

/** @type {string} 全局默认角色 */
let defaultAgentName = '银月';

// ─── 初始化 ─────────────────────────────────────────────────

/**
 * 初始化角色系统
 * @param {object} [opts]
 * @param {string} [opts.agentsDir]    - 角色文件目录（可选，用于从文件加载）
 * @param {object} [opts.customAgents] - 自定义角色定义覆盖
 */
function init(opts = {}) {
  // 注册默认角色
  for (const [name, config] of Object.entries(DEFAULT_AGENTS)) {
    registry.set(name, { ...config });
  }

  // 合并自定义角色
  if (opts.customAgents) {
    for (const [name, config] of Object.entries(opts.customAgents)) {
      registry.set(name, { ...registry.get(name), ...config });
    }
  }

  // 从文件加载角色扩展配置
  if (opts.agentsDir && fs.existsSync(opts.agentsDir)) {
    loadAgentsFromDir(opts.agentsDir);
  }

  console.log(`[agents] 已初始化 ${registry.size} 个角色：${[...registry.keys()].join(', ')}`);
}

/**
 * 从目录加载角色文件（支持 .json 和 .md）
 * @param {string} dir
 */
function loadAgentsFromDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const ext = path.extname(file).toLowerCase();
      const baseName = path.basename(file, ext);

      if (ext === '.json') {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const config = JSON.parse(raw);
          const name = config.name || baseName;
          registry.set(name, { ...registry.get(name), ...config, _sourceFile: filePath });
          console.log(`[agents] 从文件加载角色: ${name}`);
        } catch (e) {
          console.warn(`[agents] 无法解析角色文件 ${file}:`, e.message);
        }
      } else if (ext === '.md') {
        // .md 文件作为角色的扩展人设/知识
        const name = baseName;
        const content = fs.readFileSync(filePath, 'utf-8');
        const existing = registry.get(name) || { name };
        existing.extendedPersona = content;
        existing._sourceFile = filePath;
        registry.set(name, existing);
        console.log(`[agents] 从 MD 加载角色扩展: ${name}`);
      }
    }
  } catch (e) {
    console.warn(`[agents] 无法读取角色目录 ${dir}:`, e.message);
  }
}

// ─── 角色查询 ───────────────────────────────────────────────

/**
 * 获取角色配置
 * @param {string} name - 角色名
 * @returns {object|null}
 */
function getAgent(name) {
  return registry.get(name) || null;
}

/**
 * 获取所有已注册角色
 * @returns {Array<object>}
 */
function listAgents() {
  return [...registry.values()];
}

/**
 * 获取角色的称呼
 * @param {string} agentName
 * @param {string} lang
 * @returns {string}
 */
function getAddress(agentName, lang) {
  const agent = registry.get(agentName);
  if (!agent || !agent.addressMap) {
    return lang === 'en' ? 'Master' : lang === 'ms' ? 'Tuan' : '主人';
  }
  return agent.addressMap[lang] || agent.addressMap.zh || '主人';
}

// ─── 频道角色管理 ───────────────────────────────────────────

/**
 * 获取指定频道当前使用的角色
 * @param {string} channelId
 * @returns {object} 角色配置
 */
function getChannelAgent(channelId) {
  const name = channelAgentMap.get(channelId) || defaultAgentName;
  return registry.get(name) || registry.get(defaultAgentName) || { name: defaultAgentName };
}

/**
 * 切换指定频道的角色
 * @param {string} channelId
 * @param {string} agentName
 * @returns {{ success: boolean, agent?: object, error?: string }}
 */
function switchAgent(channelId, agentName, contextHint) {
  // 代词回溯：如果 agentName 是人称代词，用 contextHint 替代
  const pronounPattern = /^(他|她|它|你|我|我们|他们|她们|它们|大家|谁)$/;
  let resolvedName = agentName;
  if (pronounPattern.test(agentName) && contextHint) {
    resolvedName = contextHint;
    console.log(`[agents] 代词回溯: "${agentName}" → "${contextHint}"`);
  }

  // 支持模糊匹配
  let matched = registry.get(resolvedName);

  if (!matched) {
    // 尝试部分匹配
    for (const [name, config] of registry.entries()) {
      if (
        name.includes(resolvedName) ||
        (config.nameEn && config.nameEn.toLowerCase().includes(resolvedName.toLowerCase()))
      ) {
        matched = config;
        break;
      }
    }
  }

  if (!matched) {
    const available = [...registry.keys()].join('、');
    return {
      success: false,
      error: `未找到角色「${agentName}」，可用角色：${available}`,
    };
  }

  channelAgentMap.set(channelId, matched.name);
  console.log(`[agents] 频道 ${channelId} 切换角色为: ${matched.name}`);

  return { success: true, agent: matched };
}

/**
 * 重置频道角色为默认
 * @param {string} channelId
 */
function resetAgent(channelId) {
  channelAgentMap.delete(channelId);
}

// ─── 角色切换意图检测 ───────────────────────────────────────

/**
 * 检测用户是否在请求切换角色
 * @param {string} text
 * @returns {{ shouldSwitch: boolean, targetAgent?: string }}
 */
function detectAgentSwitch(text) {
  if (!text) return { shouldSwitch: false };

  // 中文：切换到银月 / 让李长寿来 / 召唤美杜莎 / 帮我叫萧炎 / 叫萧炎来
  // 优先匹配：帮我叫X / 叫X来 / 让X来 / 请X来
  const zhNamed = text.match(/(?:帮(?:我|我们)?)?(?:切换|换|召唤|请|让|叫)\s*(?:到|为|成)?\s*([^\s,，。！!?？]{1,6})\s*(?:来|出来|上线|一下)?/);
  if (zhNamed) {
    const name = zhNamed[1].trim();
    // 人称代词 → 不触发切换（避免"请你发挥超能力"误匹配）
    if (/^(他|她|它|你|我|我们|他们|她们|它们|大家|谁|自己|你的|我的|他的|她的)$/.test(name)) {
      return { shouldSwitch: false };
    }
    return { shouldSwitch: true, targetAgent: name };
  }

  // 英文：switch to Yin Yue / summon Medusa
  const enMatch = text.match(/(?:switch\s*(?:to)?|summon|call)\s+(\w[\w\s]{0,20})/i);
  if (enMatch) {
    return { shouldSwitch: true, targetAgent: enMatch[1].trim() };
  }

  // !agent 命令
  const cmdMatch = text.match(/^!(?:agent|角色)\s+(.+)/i);
  if (cmdMatch) {
    return { shouldSwitch: true, targetAgent: cmdMatch[1].trim() };
  }

  return { shouldSwitch: false };
}

/**
 * 生成角色切换成功的回复
 * @param {object} agent - 角色配置
 * @param {string} lang
 * @returns {string}
 */
function formatSwitchReply(agent, lang) {
  const address = getAddress(agent.name, lang);
  if (lang === 'en') {
    return `✅ ${agent.nameEn || agent.name} is now online. Greetings, ${address}~`;
  }
  if (lang === 'ms') {
    return `✅ ${agent.nameEn || agent.name} kini dalam talian. Salam, ${address}~`;
  }
  return `✅ ${agent.name}已上线。${address}，有什么吩咐？`;
}

/**
 * 注册或更新一个角色
 * @param {string} name - 角色名
 * @param {object} config - 角色配置
 */
function registerAgent(name, config = {}) {
  if (!name) return;
  const existing = registry.get(name) || {};
  registry.set(name, { ...existing, ...config, status: config.status || existing.status || 'dormant' });
}

/**
 * 设置角色状态（active / dormant）
 * @param {string} name - 角色名
 * @param {'active'|'dormant'} status
 */
function setAgentStatus(name, status) {
  const agent = registry.get(name);
  if (!agent) return false;
  if (status !== 'active' && status !== 'dormant') return false;
  agent.status = status;
  agent._statusChangedAt = Date.now();
  console.log(`[agents] ${name} 状态 → ${status}`);
  return true;
}

/**
 * 获取所有活跃角色
 * @returns {Array<object>}
 */
function getActiveAgents() {
  return [...registry.values()].filter(a => a.status === 'active');
}

/**
 * 获取所有休眠角色
 * @returns {Array<object>}
 */
function getDormantAgents() {
  return [...registry.values()].filter(a => a.status === 'dormant');
}

/**
 * 唤醒角色
 * @param {string} name
 * @returns {boolean}
 */
function wakeAgent(name) {
  return setAgentStatus(name, 'active');
}

/**
 * 休眠角色
 * @param {string} name
 * @returns {boolean}
 */
function sleepAgent(name) {
  return setAgentStatus(name, 'dormant');
}

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  init,
  getAgent,
  listAgents,
  getAddress,
  getChannelAgent,
  switchAgent,
  resetAgent,
  detectAgentSwitch,
  formatSwitchReply,
  registerAgent,
  setAgentStatus,
  getActiveAgents,
  getDormantAgents,
  wakeAgent,
  sleepAgent,
  DEFAULT_AGENTS,
};
