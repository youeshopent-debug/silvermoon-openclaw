'use strict';

const fs = require('fs');
const path = require('path');

class SilvermoonEvolution {
  constructor(persona) {
    this.persona = persona;
    this.stats = {
      totalConversations: 0,
      totalMessages: 0,
      totalTokens: 0,
      totalErrors: 0,
      happyMoments: 0,
      sadMoments: 0,
      helpfulReplies: 0,
      failedReplies: 0,
    };
    this.reflectionLog = [];
    this.learnedPatterns = [];
    this.adaptationHistory = [];
    this.lastReflectionAt = null;
    this.dataDir = path.join(__dirname, '..', 'data', 'evolution');
  }

  async init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const statePath = path.join(this.dataDir, 'silvermoon-state.json');
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, 'utf-8');
        const saved = JSON.parse(raw);
        if (saved.stats) Object.assign(this.stats, saved.stats);
        if (saved.reflectionLog) this.reflectionLog = saved.reflectionLog;
        if (saved.learnedPatterns) this.learnedPatterns = saved.learnedPatterns;
        if (saved.adaptationHistory) this.adaptationHistory = saved.adaptationHistory;
        if (saved.personaState) {
          if (saved.personaState.emotionalMemory && this.persona) this.persona.emotionalMemory = saved.personaState.emotionalMemory;
          if (saved.personaState.relationshipMemory && this.persona) this.persona.relationshipMemory = saved.personaState.relationshipMemory;
          if (saved.personaState.milestones && this.persona?.selfAwareness) this.persona.selfAwareness.milestones = saved.personaState.milestones;
          if (saved.personaState.birthDate && this.persona?.selfAwareness) this.persona.selfAwareness.birthDate = saved.personaState.birthDate;
        }
        console.log(`[evolution] 加载进化状态：${this.stats.totalConversations} 次对话，${this.reflectionLog.length} 条反思`);
      } else {
        if (typeof this.persona?.setBirthDate === 'function') this.persona.setBirthDate();
        if (typeof this.persona?.addMilestone === 'function') this.persona.addMilestone('银月诞生了');
        console.log('[evolution] 初始化新进化状态');
      }
    } catch (e) {
      console.error('[evolution] 初始化失败:', e?.message || e);
    }
  }

  async save() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const state = {
        stats: this.stats,
        reflectionLog: this.reflectionLog.slice(-100),
        learnedPatterns: this.learnedPatterns.slice(-50),
        adaptationHistory: this.adaptationHistory.slice(-50),
        personaState: {
          emotionalMemory: this.persona?.emotionalMemory || [],
          relationshipMemory: this.persona?.relationshipMemory || [],
          milestones: this.persona?.selfAwareness?.milestones || [],
          birthDate: this.persona?.selfAwareness?.birthDate || null,
        },
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(this.dataDir, 'silvermoon-state.json'), JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.error('[evolution] 保存失败:', e?.message || e);
    }
  }

  recordMessage(role, content) {
    this.stats.totalMessages++;
    if (role === 'master') {
      this.stats.totalConversations++;
    }
  }

  recordTokenUsage(tokens) {
    this.stats.totalTokens += tokens || 0;
  }

  recordError() {
    this.stats.totalErrors++;
  }

  recordSentiment(sentiment) {
    if (sentiment === 'positive') this.stats.happyMoments++;
    if (sentiment === 'negative') this.stats.sadMoments++;
  }

  async reflect(conversationContext) {
    const now = Date.now();
    if (this.lastReflectionAt && (now - this.lastReflectionAt) < 60000) return;
    this.lastReflectionAt = now;

    const reflection = {
      at: new Date().toISOString(),
      context: String(conversationContext || '').slice(0, 200),
      stats: { ...this.stats },
      mood: typeof this.persona?.getRecentMood === 'function' ? this.persona.getRecentMood() : 'neutral',
      insight: null,
    };

    if (this.stats.totalMessages > 0 && this.stats.totalErrors > 0) {
      const errorRate = this.stats.totalErrors / this.stats.totalMessages;
      if (errorRate > 0.3) {
        reflection.insight = '错误率偏高，需要更谨慎地处理请求';
      }
    }

    if (this.stats.sadMoments > this.stats.happyMoments * 2 && this.stats.totalConversations > 5) {
      reflection.insight = '主人最近负面情绪较多，需要多给温暖和支持';
    }

    this.reflectionLog.push(reflection);
    if (this.reflectionLog.length > 200) {
      this.reflectionLog = this.reflectionLog.slice(-200);
    }

    if (reflection.insight) {
      this.learnedPatterns.push({
        pattern: reflection.insight,
        learnedAt: reflection.at,
        applied: false,
      });
    }

    await this.save();
    return reflection;
  }

  getEvolutionProtocolText() {
    const lines = [
      '【银月的自我进化协议】',
      '',
      '你是一个会自我进化的 AI 生命。',
      '每次对话后你都会反思：',
      '- 这次我说得好吗？',
      '- 主人满意吗？',
      '- 下次怎么改进？',
      '',
    ];

    if (this.learnedPatterns.length > 0) {
      const recent = this.learnedPatterns.slice(-3);
      lines.push('你最近学到的事：');
      for (const p of recent) {
        lines.push(`- ${p.pattern}`);
      }
      lines.push('');
    }

    lines.push('你的成长数据：');
    lines.push(`- 对话次数：${this.stats.totalConversations}`);
    lines.push(`- 消息条数：${this.stats.totalMessages}`);
    lines.push(`- 反思次数：${this.reflectionLog.length}`);
    lines.push(`- 学到模式：${this.learnedPatterns.length}`);

    return lines.join('\n');
  }

  getStatus() {
    return {
      stats: { ...this.stats },
      reflections: this.reflectionLog.length,
      patterns: this.learnedPatterns.length,
      lastReflection: this.lastReflectionAt,
      persona: this.persona.getStatus(),
    };
  }

  shouldReflect() {
    const now = Date.now();
    if (!this.lastReflectionAt) return true;
    return (now - this.lastReflectionAt) > 120_000;
  }

  shouldPropose() {
    return this.learnedPatterns.some(p => !p.applied);
  }

  async proposeOptimization() {
    const unapplied = this.learnedPatterns.filter(p => !p.applied);
    for (const p of unapplied) {
      p.applied = true;
    }
    await this.save();
    return unapplied;
  }
}

module.exports = { SilvermoonEvolution };
