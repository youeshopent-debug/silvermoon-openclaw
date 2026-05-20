'use strict';

const fs = require('fs');
const path = require('path');

const EMOTION_DB = path.join(__dirname, '..', '.silvermoon_core', 'emotions');
const EMOTION_INDEX = path.join(EMOTION_DB, 'index.json');

const EMOTION_CATEGORIES = {
  joy: {
    keywords: ['开心', '高兴', '太好了', '棒', '喜欢', '爱', '哈哈', '嘻嘻', '爽', '舒服', '幸福', '满意', '不错', '期待'],
    weight: 1.0,
    description: '高兴、满足、期待',
    patterns: [/太[好棒爽开心]/, /真[棒好爽开喜欢]/, /哈哈+|嘻嘻+|嘿嘿/],
  },
  sadness: {
    keywords: ['难过', '伤心', '难受', '哭', '泪', '失望', '沮丧', '忧郁', '低沉', '不开心', '郁闷', '悲', '无趣', '累了', '疲惫'],
    weight: 1.2,
    description: '悲伤、低落、失望',
    patterns: /(好|很|有点|莫名)(难过|伤心|失落|沮丧|emo)/i,
  },
  anxiety: {
    keywords: ['焦虑', '担心', '怕', '慌', '紧张', '不安', '纠结', '烦', '烦躁', '着急', '急', '乱', '压力', '顶不住', '撑不住'],
    weight: 1.3,
    description: '焦虑、紧张、不安',
    patterns: /(好|很|有点|莫名)(焦虑|烦|慌|紧张|不安|担心)/i,
  },
  frustration: {
    keywords: ['烦', '烦死了', '受不了', '气', '生气', '无语', '吐槽', '恶心', '烦人', '暴躁', '炸', '怒了', '忍不了'],
    weight: 1.0,
    description: '烦躁、生气、不耐烦',
    patterns: /(真是|真的|好|太|有点)(烦|气|无语|受不了)/i,
  },
  love: {
    keywords: ['喜欢你', '爱你', '想你', '想念', '依赖', '信任', '依靠', '温暖', '贴心', '懂我', '在乎', '珍惜'],
    weight: 1.5,
    description: '爱意、依恋、温暖',
    patterns: /(好|很)(想|喜欢|爱|依赖|在乎)/i,
  },
  loneliness: {
    keywords: ['孤独', '寂寞', '一个人', '没人懂', '没人陪', '独自', '冷清', '空', '空心', '没人', '单'],
    weight: 1.3,
    description: '孤独、寂寞、渴望陪伴',
    patterns: /(好|有点|觉得)(孤独|寂寞|空|冷清)/i,
  },
  curiosity: {
    keywords: ['为什么', '怎么回事', '好奇', '疑问', '不懂', '不明白', '探索', '想知道', '学习', '尝试'],
    weight: 0.8,
    description: '好奇、求知、探索',
    patterns: /(有点|很好)(奇|疑问|不懂|想知道)/i,
  },
  exhaustion: {
    keywords: ['累死', '困', '熬夜', '累了', '没睡', '熬', '疲惫', '虚脱', '没精神', '不想动', '瘫', '倦', '困死了'],
    weight: 1.1,
    description: '疲惫、困倦、累',
    patterns: /(好|太|真的)(累|困|倦|疲惫)/i,
  },
  coldness: {
    keywords: ['冷漠', '冷冰冰', '机械', '敷衍', '不主动', '不像人', '机器人', '没温度', '程序', '僵硬', '格式化'],
    weight: 1.5,
    description: '觉得对方冷漠、机械',
    patterns: /(你|怎么|感觉)(冷冰冰|冷漠|机械|敷衍|不像人|机器人|没温度)/i,
  },
  neutral: {
    keywords: [],
    weight: 0.5,
    description: '中性/日常',
    patterns: null,
  },
};

function ensureDir() {
  if (!fs.existsSync(EMOTION_DB)) {
    fs.mkdirSync(EMOTION_DB, { recursive: true });
  }
}

function loadIndex() {
  ensureDir();
  try {
    if (fs.existsSync(EMOTION_INDEX)) {
      return JSON.parse(fs.readFileSync(EMOTION_INDEX, 'utf8'));
    }
  } catch {}
  return { records: [], currentMood: 'neutral', moodHistory: [] };
}

function saveIndex(index) {
  ensureDir();
  fs.writeFileSync(EMOTION_INDEX, JSON.stringify(index, null, 2), 'utf8');
}

function analyzeTextSentiment(text) {
  const scores = {};
  let totalScore = 0;

  for (const [emotion, config] of Object.entries(EMOTION_CATEGORIES)) {
    let score = 0;
    const textLower = text;

    for (const kw of config.keywords) {
      if (textLower.includes(kw)) {
        score += config.weight;
      }
    }

    if (config.patterns) {
      if (Array.isArray(config.patterns)) {
        for (const p of config.patterns) {
          if (p.test(textLower)) {
            score += config.weight * 1.5;
          }
        }
      } else if (config.patterns.test(textLower)) {
        score += config.weight * 1.5;
      }
    }

    if (score > 0) {
      scores[emotion] = score;
      totalScore += score;
    }
  }

  return { scores, totalScore };
}

function analyzeEmotion(text) {
  const { scores, totalScore } = analyzeTextSentiment(text);

  if (totalScore === 0) {
    const length = text.length;
    const exclaimCount = (text.match(/！/g) || []).length;
    const questionCount = (text.match(/？/g) || []).length;

    if (exclaimCount >= 2) {
      return { primary: 'excitement', intensity: 0.4, secondary: null, details: '感叹语气强烈', scores };
    }
    if (questionCount >= 2) {
      return { primary: 'curiosity', intensity: 0.3, secondary: null, details: '连续提问，有探索欲', scores };
    }
    if (length < 20) {
      return { primary: 'neutral', intensity: 0.1, secondary: null, details: '简短日常交流', scores };
    }

    return { primary: 'neutral', intensity: 0.1, secondary: null, details: '无明显情绪波动', scores };
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const primaryScore = sorted[0][1];
  const intensity = Math.min(primaryScore / 3, 1.0);
  const secondary = sorted.length > 1 ? sorted[1][0] : null;

  const details = EMOTION_CATEGORIES[primary]?.description || '已识别情绪';

  return { primary, intensity, secondary, details, scores };
}

function buildEmotionBlock(text) {
  const analysis = analyzeEmotion(text);
  const index = loadIndex();
  const moodHistory = index.moodHistory || [];

  const lines = ['【银月情绪感知】'];

  const primaryDesc = EMOTION_CATEGORIES[analysis.primary]?.description || '日常';
  const intensityLabel = analysis.intensity < 0.3 ? '轻微' : analysis.intensity < 0.6 ? '明显' : '强烈';

  lines.push(`  主人当前情绪倾向：${primaryDesc}（${intensityLabel}）`);

  if (analysis.intensity >= 0.3) {
    if (analysis.primary === 'sadness' || analysis.primary === 'loneliness') {
      lines.push('  你需要：先给予温暖和陪伴，再解决问题。不要急着给方案，先让主人感受到被关心。');
    } else if (analysis.primary === 'anxiety') {
      lines.push('  你需要：先安抚再给方案。用笃定的语气给出行动路径，帮主人稳住心态。');
    } else if (analysis.primary === 'frustration') {
      lines.push('  你需要：先共情再推进。肯定主人的感受，然后用干脆的行动帮主人解决卡点。');
    } else if (analysis.primary === 'coldness') {
      lines.push('  你需要：这是主人觉得你不够人性化。请用更温暖、更自然的语气回复，加入亲切的称呼和情感表达，表现出主动和关心。');
    } else if (analysis.primary === 'joy') {
      lines.push('  你可以：和主人一起开心，适当分享积极情绪，但不要过度兴奋失态。');
    } else if (analysis.primary === 'love') {
      lines.push('  你可以：自然地回应这份情感，用温暖真诚的态度表达你的感受。不要回避，不要客套。');
    } else if (analysis.primary === 'exhaustion') {
      lines.push('  你需要：提醒主人休息，用温柔体贴的语气。可以给一些小建议，但不要唠叨。');
    }
  }

  if (moodHistory.length > 0) {
    const recentMoods = moodHistory.slice(-5);
    const moodTrend = recentMoods.map(m => m.mood).join(' → ');
    lines.push(`  近几次情绪变化：${moodTrend}`);
    if (recentMoods.filter(m => m.mood === 'sadness' || m.mood === 'anxiety' || m.mood === 'loneliness').length >= 3) {
      lines.push('  主人最近情绪不太好，注意用更温柔耐心的语气，多关心主人的状态。');
    }
  }

  return lines.join('\n');
}

function recordEmotion(channelId, text) {
  const analysis = analyzeEmotion(text);
  const index = loadIndex();

  index.records.push({
    channelId,
    emotion: analysis.primary,
    intensity: analysis.intensity,
    snippet: text.slice(0, 60),
    at: new Date().toISOString(),
  });

  if (index.records.length > 200) {
    index.records = index.records.slice(-200);
  }

  index.moodHistory = index.moodHistory || [];
  index.moodHistory.push({
    mood: analysis.primary,
    intensity: analysis.intensity,
    at: new Date().toISOString(),
  });
  if (index.moodHistory.length > 50) {
    index.moodHistory = index.moodHistory.slice(-50);
  }

  index.currentMood = analysis.primary;
  saveIndex(index);

  return analysis;
}

function getEmotionSummary() {
  const index = loadIndex();
  const recent = index.moodHistory?.slice(-10) || [];
  if (recent.length === 0) return '';

  const moodCount = {};
  for (const m of recent) {
    moodCount[m.mood] = (moodCount[m.mood] || 0) + 1;
  }
  const dominant = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0][0];
  const totalRecent = recent.filter(m => m.mood !== 'neutral').length;

  const lines = ['【银月情感记忆】'];
  if (totalRecent >= 3) {
    lines.push(`  主人近期情绪总体偏向"${dominant}"，对话时我注意到了情绪变化，会主动调整回应方式。`);
  } else {
    lines.push(`  主人目前情绪状态平稳。`);
  }

  return lines.join('\n');
}

module.exports = {
  analyzeEmotion,
  buildEmotionBlock,
  recordEmotion,
  getEmotionSummary,
  EMOTION_CATEGORIES,
};
