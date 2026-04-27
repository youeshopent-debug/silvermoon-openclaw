/**
 * conversation.js — 对话分级 + 防重复发送
 * 替代原有硬编码在 main.js 中的对话分级逻辑
 *
 * 分级标准：
 *   Level 0：问候/确认/简单回应 → 直接模板回复，不调 LLM
 *   Level 1：简单查询 → 低 token 消耗
 *   Level 2：一般对话 → 标准处理
 *   Level 3：深度任务 → 高 token + 子 Agent 编排
 */

'use strict';

const { detectLang } = require('./intent');

// ─── 对话分级 ───────────────────────────────────────────────

/**
 * 对话复杂度分级
 * @param {string} text - 用户消息
 * @returns {{ level: 0|1|2|3, quickReply?: string }}
 */
function classifyComplexity(text) {
  if (!text || typeof text !== 'string') return { level: 1 };

  const cleaned = text.trim().toLowerCase();
  const lang = detectLang(text);

  // ── Level 0：问候/确认/简单回应 ──
  const greetingPatterns = {
    zh: [
      /^(在[吗嘛]|hi|hello|嗨|你好|早[上啊]?|晚上好|下午好|嘿|喂|银月|在不在|睡了[吗嘛]|早安|晚安|好[的吧]|ok|嗯|行)/i,
      /^(来了|收到|明白|了解|知道了|没问题|可以|好的吧)/i,
    ],
    en: [
      /^(hi|hello|hey|yo|sup|good\s*(morning|afternoon|evening)|are\s*you\s*there|you\s*there)/i,
      /^(ok|okay|sure|got\s*it|understood|alright|cool|nice)/i,
    ],
    ms: [
      /^(hai|hello|hey|selamat\s*(pagi|petang|malam)|apa\s*khabar|ada\s*ke|kau\s*ada)/i,
      /^(ok|okey|baik|faham|setuju|boleh)/i,
    ],
  };

  const patterns = greetingPatterns[lang] || greetingPatterns.zh;
  for (const re of patterns) {
    if (re.test(cleaned)) {
      const quickReplies = {
        zh: '在的，主人～',
        en: 'Yes, Master?',
        ms: 'Ya, Tuan?',
      };
      return { level: 0, quickReply: quickReplies[lang] || quickReplies.zh };
    }
  }

  // 纯 emoji 或极短消息
  if (cleaned.length <= 2 && /^[\p{Emoji}\s]+$/u.test(cleaned)) {
    return { level: 0, quickReply: '在的，主人～' };
  }

  // ── Level 3：深度任务特征 ──
  const deepTaskPatterns = {
    zh: [
      /(分析|研究|调查|调研|对比|评估|总结|归纳|规划|设计|开发|编写|重构|优化|调试|排查|修复)/,
      /(架构|方案|计划|策略|路线图|roadmap|设计稿|原型|数据库|部署|架构)/,
      /(代码|脚本|程序|项目|系统|平台|框架|组件|模块|接口|API)/,
    ],
    en: [
      /(analyze|research|investigate|compare|evaluate|summarize|plan|design|develop|write|refactor|optimize|debug|fix)/,
      /(architecture|proposal|plan|strategy|roadmap|design|database|deploy|system)/,
      /(code|script|program|project|platform|framework|component|module|api)/,
    ],
    ms: [
      /(analisis|kaji|banding|nilai|rumus|rancang|bina|tulis|optimum|debug|baiki)/,
      /(seni\s*bina|cadangan|pelan|strategi|reka\s*bentuk|pangkalan\s*data)/,
    ],
  };

  const deepPatterns = deepTaskPatterns[lang] || deepTaskPatterns.zh;
  let deepScore = 0;
  for (const re of deepPatterns) {
    if (re.test(cleaned)) deepScore++;
  }

  if (deepScore >= 2 || cleaned.length > 200) {
    return { level: 3 };
  }

  // ── Level 2：一般对话 ──
  if (deepScore === 1 || cleaned.length > 50) {
    return { level: 2 };
  }

  // ── Level 1：简单查询 ──
  return { level: 1 };
}

// ─── LLM 参数映射 ───────────────────────────────────────────

/**
 * 根据对话级别获取 LLM 调用参数
 * @param {number} level - 对话级别 0-3
 * @returns {{ maxTokens: number, temperature: number, retrieveContext: boolean }}
 */
function getLlmParams(level) {
  switch (level) {
    case 0:
      return { maxTokens: 64, temperature: 0.3, retrieveContext: false };
    case 1:
      return { maxTokens: 256, temperature: 0.3, retrieveContext: false };
    case 2:
      return { maxTokens: 512, temperature: 0.5, retrieveContext: true };
    case 3:
      return { maxTokens: 1024, temperature: 0.5, retrieveContext: true };
    default:
      return { maxTokens: 256, temperature: 0.3, retrieveContext: false };
  }
}

// ─── 防重复发送 ─────────────────────────────────────────────

/** @type {Map<string, { text: string, at: number }>} 频道最近发送记录 */
const recentSentMap = new Map();

/**
 * 检查是否重复消息（防止同一内容短时间内重复发送）
 * @param {string} channelId - 频道 ID
 * @param {string} text - 待发送文本
 * @param {number} [cooldownMs] - 冷却时间（默认 5000ms）
 * @returns {boolean} 是否重复
 */
function isDuplicate(channelId, text, cooldownMs) {
  if (!channelId || !text) return false;
  const key = `${channelId}:${text.slice(0, 50)}`;
  const now = Date.now();
  const cooldown = cooldownMs || 5000;
  const prev = recentSentMap.get(key);
  if (prev && (now - prev.at) < cooldown) {
    return true;
  }
  recentSentMap.set(key, { text, at: now });
  // 清理过期记录
  for (const [k, v] of recentSentMap) {
    if (now - v.at > 60000) recentSentMap.delete(k);
  }
  return false;
}

// ─── 导出 ───────────────────────────────────────────────────

module.exports = { classifyComplexity, getLlmParams, isDuplicate };
