class SilvermoonEvolution {
  constructor({ notifyOwner, now }) {
    this.notifyOwner = typeof notifyOwner === 'function' ? notifyOwner : async () => {};
    this.now = typeof now === 'function' ? now : () => new Date();
    this.metrics = {
      totalMessages: 0,
      quickReplies: 0,
      intentHits: 0,
      toolRoutes: 0,
      llmCalls: 0,
      searchSuccess: 0,
      searchFail: 0,
      avgResponseTimeMs: 0,
      totalResponseTimeMs: 0,
    };
    this.lastReflectionAt = null;
    this.reflectionIntervalMs = 30 * 60 * 1000;
    this.lastProposalAt = null;
    this.proposalCooldownMs = 60 * 60 * 1000;
    this.consecutiveSearchFails = 0;
    this.consecutiveLowEfficiency = 0;
  }

  record(type, durationMs) {
    this.metrics.totalMessages++;
    if (type === 'quickReply') this.metrics.quickReplies++;
    else if (type === 'intentHit') this.metrics.intentHits++;
    else if (type === 'toolRoute') this.metrics.toolRoutes++;
    else if (type === 'llmCall') {
      this.metrics.llmCalls++;
      if (typeof durationMs === 'number') {
        this.metrics.totalResponseTimeMs += durationMs;
        this.metrics.avgResponseTimeMs = this.metrics.totalResponseTimeMs / this.metrics.llmCalls;
      }
    }
  }

  recordSearch(success) {
    if (success) {
      this.metrics.searchSuccess++;
      this.consecutiveSearchFails = 0;
    } else {
      this.metrics.searchFail++;
      this.consecutiveSearchFails++;
    }
  }

  getEfficiency() {
    const m = this.metrics;
    const total = m.totalMessages || 1;
    const llmRatio = m.llmCalls / total;
    const searchSuccessRate = (m.searchSuccess + m.searchFail) > 0
      ? m.searchSuccess / (m.searchSuccess + m.searchFail)
      : 1;
    const avgTime = m.avgResponseTimeMs;
    return { llmRatio, searchSuccessRate, avgTime, totalMessages: m.totalMessages };
  }

  shouldReflect() {
    const now = this.now().getTime();
    if (!this.lastReflectionAt) return true;
    return (now - this.lastReflectionAt.getTime()) >= this.reflectionIntervalMs;
  }

  async reflect() {
    this.lastReflectionAt = this.now();
    const eff = this.getEfficiency();
    const issues = [];

    if (eff.searchSuccessRate < 0.5) {
      issues.push(`🔍 搜索成功率仅 ${(eff.searchSuccessRate * 100).toFixed(0)}%，建议检查搜索源配置或增加备用搜索源。`);
    }
    if (eff.llmRatio > 0.8) {
      issues.push(`🤖 LLM 调用占比 ${(eff.llmRatio * 100).toFixed(0)}%，建议增加 QUICK_REPLY_TABLE 和意图拦截规则以减少 LLM 开销。`);
    }
    if (eff.avgTime > 10000) {
      issues.push(`⏱ 平均响应时间 ${(eff.avgTime / 1000).toFixed(1)}s，建议检查 LLM 模型响应速度或启用缓存。`);
    }
    if (this.consecutiveSearchFails >= 3) {
      issues.push(`⚠️ 连续 ${this.consecutiveSearchFails} 次搜索失败，建议切换默认搜索源或检查网络代理。`);
    }

    if (issues.length > 0) {
      console.log(`[🧬 Evolution Reflection] ${this.now().toISOString()}`);
      issues.forEach(i => console.log(`  ${i}`));
      this.consecutiveLowEfficiency++;
    } else {
      console.log(`[🧬 Evolution Reflection] 系统运行状态良好。`);
      this.consecutiveLowEfficiency = 0;
    }

    return issues;
  }

  shouldPropose() {
    const now = this.now().getTime();
    if (!this.lastProposalAt) return false;
    return (now - this.lastProposalAt.getTime()) >= this.proposalCooldownMs;
  }

  async proposeOptimization() {
    this.lastProposalAt = this.now();
    const issues = await this.reflect();
    if (issues.length === 0) return;

    const proposal = [
      '🧬 **银月自我进化提案**',
      '',
      '银月在运行中检测到以下可优化项：',
      ...issues.map(i => `- ${i}`),
      '',
      '请主人确认是否执行优化？回复"执行"即可。',
    ].join('\n');

    await this.notifyOwner(proposal);
    console.log(`[🧬 Evolution] Optimization proposal sent to owner.`);
  }

  getStatus() {
    const eff = this.getEfficiency();
    return {
      metrics: { ...this.metrics },
      efficiency: eff,
      consecutiveSearchFails: this.consecutiveSearchFails,
      consecutiveLowEfficiency: this.consecutiveLowEfficiency,
      lastReflectionAt: this.lastReflectionAt?.toISOString() || null,
      lastProposalAt: this.lastProposalAt?.toISOString() || null,
    };
  }
}

module.exports = { SilvermoonEvolution };
