'use strict';

const fs = require('fs');
const path = require('path');

class AgentEvolution {
  constructor(agentName, persona) {
    this.agentName = agentName;
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

  _stateFile() {
    return path.join(this.dataDir, `${this.agentName}-state.json`);
  }

  async init() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const statePath = this._stateFile();
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, 'utf-8');
        const saved = JSON.parse(raw);
        if (saved.stats) Object.assign(this.stats, saved.stats);
        if (saved.reflectionLog) this.reflectionLog = saved.reflectionLog;
        if (saved.learnedPatterns) this.learnedPatterns = saved.learnedPatterns;
        if (saved.adaptationHistory) this.adaptationHistory = saved.adaptationHistory;
        if (saved.personaState) {
          if (saved.personaState.emotionalMemory) this.persona.emotionalMemory = saved.personaState.emotionalMemory;
          if (saved.personaState.relationshipMemory) this.persona.relationshipMemory = saved.personaState.relationshipMemory;
          if (saved.personaState.milestones) this.persona.selfAwareness.milestones = saved.personaState.milestones;
          if (saved.personaState.birthDate) this.persona.selfAwareness.birthDate = saved.personaState.birthDate;
        }
        console.log(`[evolution/${this.agentName}] 加载进化状态：${this.stats.totalConversations} 次对话，${this.reflectionLog.length} 条反思`);
      } else {
        this.persona.setBirthDate();
        this.persona.addMilestone(`${this.agentName}诞生了`);
        console.log(`[evolution/${this.agentName}] 初始化新进化状态`);
      }
    } catch (e) {
      console.error(`[evolution/${this.agentName}] 初始化失败:`, e?.message || e);
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
          emotionalMemory: this.persona.emotionalMemory,
          relationshipMemory: this.persona.relationshipMemory,
          milestones: this.persona.selfAwareness.milestones,
          birthDate: this.persona.selfAwareness.birthDate,
        },
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this._stateFile(), JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[evolution/${this.agentName}] 保存失败:`, e?.message || e);
    }
  }

  record(type, duration) {
    if (type === 'llmCall') {
      this.stats.totalConversations++;
      if (typeof duration === 'number') this.stats.totalTokens += Math.round(duration);
    }
    if (type === 'intentHit') this.stats.helpfulReplies++;
    if (type === 'xiaoyanTrade' || type === 'xiaoyanCrawler') this.stats.helpfulReplies++;
  }

  recordMessage(role) {
    this.stats.totalMessages++;
    if (role === 'master') {
      this.stats.totalConversations++;
    }
  }

  recordTokenUsage(tokens) {
    this.stats.totalTokens += tokens || 0;
  }

  recordSearch(success) {
    if (success) this.stats.helpfulReplies++;
    else this.stats.failedReplies++;
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
      mood: this.persona.getRecentMood(),
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
      `【${this.agentName}的自我进化协议】`,
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

  get metrics() {
    return {
      totalMessages: this.stats.totalMessages,
      llmCalls: this.stats.totalConversations,
      totalTokens: this.stats.totalTokens,
      searchSuccess: this.stats.helpfulReplies,
      searchFail: this.stats.failedReplies,
      avgResponseTimeMs: this.stats.totalConversations > 0
        ? Math.round(this.stats.totalTokens / this.stats.totalConversations)
        : 0,
    };
  }

  getOptimizationProposals() {
    const proposals = [];
    if (this.stats.totalMessages > 50 && this.stats.failedReplies > this.stats.helpfulReplies * 0.5) {
      proposals.push('错误率偏高，建议检查 LLM 链路');
    }
    if (this.learnedPatterns.length > 0) {
      const recent = this.learnedPatterns.slice(-3);
      for (const p of recent) {
        if (!p.applied) {
          proposals.push(p.pattern);
          p.applied = true;
        }
      }
    }
    return proposals;
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
}

module.exports = { AgentEvolution };
