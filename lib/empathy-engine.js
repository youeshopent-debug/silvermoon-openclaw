'use strict';

const fs = require('fs');
const path = require('path');

const EMPATHY_DIR = path.join(__dirname, '..', '.silvermoon_core', 'empathy');
const HISTORY_FILE = path.join(EMPATHY_DIR, 'interaction_history.json');
const PREFERENCES_FILE = path.join(EMPATHY_DIR, 'user_preferences.json');
const PATTERNS_FILE = path.join(EMPATHY_DIR, 'behavior_patterns.json');

function ensureDir() {
  if (!fs.existsSync(EMPATHY_DIR)) fs.mkdirSync(EMPATHY_DIR, { recursive: true });
}

// ─── 情感信号词库 ────────────────────────────────────────
const EMOTION_SIGNALS = {
  angry: {
    keywords: ['气', '火大', '无语', '失望', '忍不了', '烦', '怒', '岂有此理', '搞什么', '到底', '这么久', 'again', 'annoyed', 'frustrated', 'tired of', 'sick of', 'useless'],
    boost: 1.5
  },
  frustrated: {
    keywords: ['为什么', '做不到', '不行', '不会', '不能', '失败', '卡住', 'bug', '不对', '错误', '又', '还是', '没用', 'broken', 'not working', 'error', 'failed', 'stuck'],
    boost: 1.3
  },
  urgent: {
    keywords: ['立即', '马上', '赶紧', '立刻', '快点', '急', 'asap', 'urgent', 'hurry', 'now!', 'now'],
    boost: 1.4
  },
  satisfied: {
    keywords: ['很好', '不错', '棒', '厉害', '完美', '满意', 'nice', 'perfect', 'great', 'awesome', 'good job', 'well done', 'excellent'],
    boost: 0.8
  },
  tired: {
    keywords: ['累', '困', '睡觉', '休息', '晚安', '疲惫', 'tired', 'sleep', 'exhausted', 'bed'],
    boost: 0.6
  },
  confused: {
    keywords: ['啥', '哪里', '怎么', '什么意思', '不懂', '为什么', 'confused', 'what', 'how', 'why', 'huh', '搞不懂', '不理解', '糊涂', '不明白', '没搞懂'],
    boost: 0.9
  }
};

const EMOTION_PATTERNS = {
  capsRatio: /[A-Z]{3,}/g,
  repeatPunct: /[!?。！？]{2,}/g,
  complaintPrefix: /^(又|怎么|为什么|到底|能不能|有没有|是不是|你们|你)/,
  gratitude: /^(谢谢|多谢|感谢|thx|thanks|thank you|nice|good)/i,
  command: /^(去|来|帮我|给我|把|请|立刻|马上|run|exec|do|make|create|start|build)/i,
};

// ─── 情绪检测 ────────────────────────────────────────
function detectEmotion(text) {
  if (!text || typeof text !== 'string') return { emotion: 'neutral', confidence: 0.5 };
  const lower = text.toLowerCase();
  let scores = { neutral: 0.5 };
  let hasExclamation = false;

  for (const [emotion, config] of Object.entries(EMOTION_SIGNALS)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (lower.includes(kw)) score += 0.15 * config.boost;
    }
    if (score > 0) scores[emotion] = score;
  }

  // 大写字母占比高 → 激动/愤怒
  const caps = text.match(EMOTION_PATTERNS.capsRatio);
  if (caps) {
    const capsLen = caps.join('').length;
    const ratio = capsLen / text.length;
    if (ratio > 0.3) {
      scores.angry = (scores.angry || 0) + 0.3;
      hasExclamation = true;
    }
  }

  // 重复标点 → 强烈情绪
  const punct = text.match(EMOTION_PATTERNS.repeatPunct);
  if (punct) {
    punct.forEach(p => {
      if (p.includes('!') || p.includes('！')) hasExclamation = true;
      scores.angry = (scores.angry || 0) + 0.15;
    });
  }

  // 感谢模式 → 降低负面权重
  if (EMOTION_PATTERNS.gratitude.test(lower)) {
    scores.satisfied = (scores.satisfied || 0) + 0.3;
    if (scores.angry) scores.angry *= 0.5;
  }

  // 命令模式 → 增加 urgency
  if (EMOTION_PATTERNS.command.test(lower)) {
    scores.urgent = (scores.urgent || 0) + 0.2;
  }

  // 选最高分
  let topEmotion = 'neutral';
  let topScore = 0.5;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topEmotion = emotion;
    }
  }

  return {
    emotion: topEmotion,
    confidence: Math.min(topScore, 1),
    scores,
    hasExclamation
  };
}

// ─── 回应策略推荐 ────────────────────────────────────
function recommendStrategy(detected, preferences = {}) {
  const { emotion, confidence, hasExclamation } = detected;
  const strategy = { tone: 'normal', length: 'normal', action: 'reply', priority: 5 };

  switch (emotion) {
    case 'angry':
      strategy.tone = 'apologetic';
      strategy.length = 'minimal';
      strategy.action = 'immediate_action';
      strategy.priority = 10;
      strategy.note = '主人情绪激动，直接行动不辩解，精简回复';
      break;
    case 'frustrated':
      strategy.tone = 'calm';
      strategy.length = 'concise';
      strategy.action = 'report_progress';
      strategy.priority = 9;
      strategy.note = '主人遇到困难，简洁报当前状态并提供明确解决方案';
      break;
    case 'urgent':
      strategy.tone = 'direct';
      strategy.length = 'minimal';
      strategy.action = 'execute_now';
      strategy.priority = 10;
      strategy.note = '主人很急，直接执行不确认';
      break;
    case 'satisfied':
      strategy.tone = 'warm';
      strategy.length = 'normal';
      strategy.action = 'continue';
      strategy.priority = 3;
      strategy.note = '主人心情好，可适当主动建议';
      break;
    case 'tired':
      strategy.tone = 'gentle';
      strategy.length = 'minimal';
      strategy.action = 'summarize';
      strategy.priority = 7;
      strategy.note = '主人累了，简洁汇报后安静等待';
      break;
    case 'confused':
      strategy.tone = 'patient';
      strategy.length = 'detailed';
      strategy.action = 'explain';
      strategy.priority = 6;
      strategy.note = '主人有疑问，耐心清晰地解释';
      break;
    default:
      strategy.tone = preferences.preferredTone || 'normal';
      strategy.length = 'normal';
  }

  if (hasExclamation && emotion !== 'angry') strategy.priority += 2;

  return strategy;
}

// ─── 交互记录 ────────────────────────────────────────
function recordInteraction(text, role = 'user', meta = {}) {
  ensureDir();
  const history = loadHistory();
  const detected = detectEmotion(text);

  history.push({
    timestamp: new Date().toISOString(),
    role,
    emotion: detected.emotion,
    confidence: detected.confidence,
    textPreview: text.slice(0, 120),
    meta
  });

  // 上限 200 条
  if (history.length > 200) history.splice(0, history.length - 200);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  return detected;
}

function loadHistory() {
  ensureDir();
  try {
    if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {}
  return [];
}

/**
 * 清空交互记录
 */
function clearHistory() {
  ensureDir();
  fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
}

// ─── 偏好学习 ────────────────────────────────────────
function learnPreference(key, value) {
  ensureDir();
  const prefs = loadPreferences();
  prefs[key] = { value, updatedAt: new Date().toISOString() };
  fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(prefs, null, 2), 'utf8');
}

function loadPreferences() {
  ensureDir();
  try {
    if (fs.existsSync(PREFERENCES_FILE)) return JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8'));
  } catch {}
  return {};
}

function getPreference(key) {
  const prefs = loadPreferences();
  return prefs[key]?.value || null;
}

// ─── 用户行为模式分析 ────────────────────────────────
function analyzePatterns() {
  const history = loadHistory();
  if (history.length < 5) return { reliable: false, note: '数据不足，无法分析' };

  const userMessages = history.filter(h => h.role === 'user');
  const recent = userMessages.slice(-20);

  // 情绪分布
  const emotionCounts = {};
  for (const m of recent) {
    emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + 1;
  }

  // 最常见情绪
  let topEmotion = 'neutral';
  let topCount = 0;
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    if (count > topCount) { topCount = count; topEmotion = emotion; }
  }

  // 负面情绪比例
  const negativeEmotions = ['angry', 'frustrated'];
  const negativeCount = recent.filter(m => negativeEmotions.includes(m.emotion)).length;
  const negativeRatio = recent.length > 0 ? negativeCount / recent.length : 0;

  // 交互间隔分析
  const timestamps = recent.map(m => new Date(m.timestamp).getTime()).filter(t => !isNaN(t));
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }
  const avgInterval = intervals.length > 0
    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
    : 0;

  const patterns = {
    reliable: true,
    analyzedAt: new Date().toISOString(),
    sampleSize: recent.length,
    dominantEmotion: topEmotion,
    emotionDistribution: emotionCounts,
    negativeRatio: Math.round(negativeRatio * 100) / 100,
    avgResponseIntervalMs: Math.round(avgInterval),
    avgResponseIntervalMin: Math.round(avgInterval / 60000),
    suggestedTone: negativeRatio > 0.4 ? 'apologetic_direct' : (negativeRatio > 0.2 ? 'cautious' : 'normal'),
    lastEmotion: recent.length > 0 ? recent[recent.length - 1].emotion : 'neutral',
  };

  // 持久化分析结果
  fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf8');

  return patterns;
}

function loadPatterns() {
  ensureDir();
  try {
    if (fs.existsSync(PATTERNS_FILE)) return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
  } catch {}
  return null;
}

// ─── 对外接口 ────────────────────────────────────────
function buildEmpathyBlock(text) {
  if (!text || typeof text !== 'string') return '';
  const detected = detectEmotion(text);
  const prefs = loadPreferences();
  const strategy = recommendStrategy(detected, prefs);
  const patterns = loadPatterns();

  const lines = ['【共情引擎·实时状态】'];
  lines.push(`检测情绪：${detected.emotion}（置信度 ${Math.round(detected.confidence * 100)}%）`);
  lines.push(`推荐策略：语气=${strategy.tone} | 长度=${strategy.length} | 动作=${strategy.action} | 优先级=${strategy.priority}`);

  if (patterns?.reliable && patterns.sampleSize >= 10) {
    const neg = Math.round(patterns.negativeRatio * 100);
    lines.push(`用户画像：近${patterns.sampleSize}条消息负面率${neg}%，主导情绪"${patterns.dominantEmotion}"`);
    if (patterns.negativeRatio > 0.3) {
      lines.push('⚠️ 近期负面比例偏高 → 减少冗余询问，优先直接执行');
    }
  }

  if (strategy.tone === 'apologetic') {
    lines.push('⚡ 情绪触发协议：如果主人表达不满 → 不道歉不辩解，直接报告当前任务状态或立即执行新指令');
  }
  if (strategy.action === 'execute_now' || strategy.action === 'immediate_action') {
    lines.push('⚡ 高优先级指令 → 直接执行，严禁先确认再行动');
  }

  return lines.join('\n');
}

/**
 * 结构化共情输出（程序消费用，相比 buildEmpathyBlock 的展示字符串）
 * 返回 { emotion, confidence, strategy, patterns, timestamp }
 */
function buildEmpathyObject(text) {
  if (!text || typeof text !== 'string') {
    return { emotion: 'neutral', confidence: 0.5, strategy: null, patterns: null, timestamp: new Date().toISOString() };
  }
  const detected = detectEmotion(text);
  const prefs = loadPreferences();
  const strategy = recommendStrategy(detected, prefs);
  const patterns = loadPatterns();

  return {
    emotion: detected.emotion,
    confidence: detected.confidence,
    scores: detected.scores,
    hasExclamation: detected.hasExclamation,
    strategy: {
      tone: strategy.tone,
      length: strategy.length,
      action: strategy.action,
      priority: strategy.priority,
      note: strategy.note || null
    },
    userProfile: patterns?.reliable ? {
      sampleSize: patterns.sampleSize,
      negativeRatio: patterns.negativeRatio,
      dominantEmotion: patterns.dominantEmotion,
      suggestedTone: patterns.suggestedTone
    } : null,
    timestamp: new Date().toISOString()
  };
}

function getRecentEmotionSummary(count = 5) {
  const history = loadHistory();
  const recent = history.filter(h => h.role === 'user').slice(-count);
  if (recent.length === 0) return '暂无交互记录';
  const emotions = recent.map(r => `${r.emotion}(${Math.round(r.confidence * 100)}%)`).join(' → ');
  return `近${recent.length}条消息情绪：${emotions}`;
}

module.exports = {
  detectEmotion,
  recommendStrategy,
  recordInteraction,
  learnPreference,
  getPreference,
  loadPreferences,
  analyzePatterns,
  loadPatterns,
  buildEmpathyBlock,
  buildEmpathyObject,
  clearHistory,
  getRecentEmotionSummary,
  loadHistory,
};
