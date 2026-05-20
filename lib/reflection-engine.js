'use strict';

const fs = require('fs');
const path = require('path');
const selfState = require('./self-state');

const REFLECTIONS_DIR = path.join(__dirname, '..', '.silvermoon_core', 'reflections');
const REFLECTIONS_INDEX = path.join(REFLECTIONS_DIR, 'index.json');

const TRIGGER_RULES = {
  max_consecutive_errors: 3,
  max_error_rate: 0.1,
  min_reflection_interval_hours: 6,
  max_owner_displeasure: 2,
};

function ensureDir() {
  if (!fs.existsSync(REFLECTIONS_DIR)) {
    fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });
  }
}

function loadIndex() {
  ensureDir();
  try {
    if (fs.existsSync(REFLECTIONS_INDEX)) {
      return JSON.parse(fs.readFileSync(REFLECTIONS_INDEX, 'utf8'));
    }
  } catch {}
  return { reflections: [] };
}

function saveIndex(index) {
  ensureDir();
  fs.writeFileSync(REFLECTIONS_INDEX, JSON.stringify(index, null, 2), 'utf8');
}

function shouldReflect() {
  const state = selfState.get();
  const reasons = [];

  if (state.consecutive_owner_displeasure >= TRIGGER_RULES.max_owner_displeasure) {
    reasons.push(`主人连续不满意${state.consecutive_owner_displeasure}次`);
  }
  if (state.consecutive_errors >= TRIGGER_RULES.max_consecutive_errors) {
    reasons.push(`连续错误${state.consecutive_errors}次`);
  }
  if (state.error_rate_24h >= TRIGGER_RULES.max_error_rate) {
    reasons.push(`24h错误率${(state.error_rate_24h * 100).toFixed(0)}%`);
  }
  if (state.last_reflection_at) {
    const hoursSince = (Date.now() - new Date(state.last_reflection_at).getTime()) / 3600000;
    if (hoursSince >= TRIGGER_RULES.min_reflection_interval_hours) {
      reasons.push(`距上次反思已${Math.round(hoursSince)}小时`);
    }
  } else {
    reasons.push('从未进行过反思');
  }

  return {
    should: reasons.length > 0,
    reasons,
    urgency: state.consecutive_owner_displeasure >= 1 ? 'high' : state.error_rate_24h > 0.2 ? 'medium' : 'low',
  };
}

async function analyzeWithLLM(context, callLLM) {
  if (typeof callLLM !== 'function') {
    return generateLocalAnalysis(context);
  }

  const prompt = `你是一个AI自我反思分析器。请根据以下运行数据生成反思结论和改进建议。

【运行数据】
${JSON.stringify(context, null, 2)}

请输出JSON格式的分析结果，包含：
1. issues: 发现的问题列表（含severity: high/medium/low）
2. rootCauses: 每个问题的根因分析
3. improvements: 改进建议（含可执行的具体action）
4. priority: 整体优先级 (high/medium/low)
5. summary: 一句话总结

只输出JSON，不要其他文字。`;

  try {
    const response = await callLLM([{ role: 'user', content: prompt }], {
      model: 'qwen2.5:7b',
      temperature: 0.3,
      maxTokens: 1000,
    });
    const text = typeof response === 'string' ? response : response.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[reflection] LLM analysis failed:', e.message);
  }

  return generateLocalAnalysis(context);
}

function generateLocalAnalysis(context) {
  const issues = [];
  const improvements = [];

  if (context.consecutive_owner_displeasure > 0) {
    issues.push({
      issue: '主人连续不满意',
      severity: context.consecutive_owner_displeasure >= 2 ? 'high' : 'medium',
      detail: `连续${context.consecutive_owner_displeasure}次反馈不满意`,
    });
    improvements.push({
      action: '主动向主人确认需求细节，确保理解正确后再执行',
      target: '主人满意度',
    });
    improvements.push({
      action: '执行前先输出简要计划让主人确认方向',
      target: '沟通效率',
    });
  }

  if (context.error_rate_24h > 0.1) {
    issues.push({
      issue: '错误率偏高',
      severity: context.error_rate_24h > 0.3 ? 'high' : 'medium',
      detail: `24h错误率${(context.error_rate_24h * 100).toFixed(0)}%`,
    });
    improvements.push({
      action: '增加输入验证和错误处理，执行关键操作前先做可行性检查',
      target: '稳定性',
    });
    improvements.push({
      action: '遇到异常时先尝试备用方案再报错',
      target: '韧性',
    });
  }

  if (context.consecutive_errors > 2) {
    issues.push({
      issue: '连续执行失败',
      severity: context.consecutive_errors > 5 ? 'high' : 'medium',
      detail: `连续${context.consecutive_errors}次执行错误`,
    });
    improvements.push({
      action: '切换到降级模式，用更保守的方式执行',
      target: '可靠性',
    });
  }

  if (context.task_success_rate_7d < 0.7) {
    issues.push({
      issue: '任务成功率偏低',
      severity: 'medium',
      detail: `7天成功率${(context.task_success_rate_7d * 100).toFixed(0)}%`,
    });
    improvements.push({
      action: '优先处理简单任务建立信心，复杂任务先拆解再执行',
      target: '任务完成率',
    });
  }

  if (issues.length === 0) {
    improvements.push({
      action: '继续保持当前运行状态',
      target: '稳定运行',
    });
  }

  return {
    issues,
    improvements,
    priority: issues.some(i => i.severity === 'high') ? 'high' : 'low',
    summary: issues.length > 0
      ? `发现${issues.length}个问题，提出${improvements.length}条改进建议`
      : '运行状态良好，无需重大调整',
  };
}

async function reflect(callLLM) {
  const state = selfState.get();
  const trigger = shouldReflect();
  if (!trigger.should && state.consecutive_owner_displeasure === 0) {
    return { reflected: false, reason: '无需反思' };
  }

  const context = {
    uptime_hours: state.uptime_hours,
    error_rate_24h: state.error_rate_24h,
    consecutive_errors: state.consecutive_errors,
    consecutive_owner_displeasure: state.consecutive_owner_displeasure,
    task_success_rate_7d: state.task_success_rate_7d,
    total_tasks_completed: state.total_tasks_completed,
    last_reflection_at: state.last_reflection_at,
    trigger_reasons: trigger.reasons,
  };

  const analysis = await analyzeWithLLM(context, callLLM);

  const record = {
    reflected_at: new Date().toISOString(),
    trigger_reasons: trigger.reasons,
    urgency: trigger.urgency,
    state_snapshot: context,
    analysis,
  };

  const index = loadIndex();
  index.reflections.push(record);
  if (index.reflections.length > 50) {
    index.reflections = index.reflections.slice(-50);
  }
  saveIndex(index);

  const id = Date.now().toString(36);
  const recordPath = path.join(REFLECTIONS_DIR, `reflection-${id}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');

  selfState.set('reflection_count', (state.reflection_count || 0) + 1);
  selfState.set('last_reflection_at', record.reflected_at);
  if (state.consecutive_owner_displeasure > 0) {
    selfState.set('consecutive_owner_displeasure', 0);
  }

  return { reflected: true, record };
}

function getImprovementsBlock() {
  const index = loadIndex();
  const recent = index.reflections.slice(-3);
  if (recent.length === 0) return '';

  const allActions = recent.flatMap(r =>
    r.analysis?.improvements?.map(imp => `- ${imp.action}（目标：${imp.target}）`) || []
  );
  const unique = [...new Set(allActions)];

  if (unique.length === 0) return '';

  const lines = ['【本次会话待落实的改进项】'];
  lines.push(...unique.slice(0, 5));
  return lines.join('\n');
}

function getReflectionSummary() {
  const index = loadIndex();
  const recent = index.reflections.slice(-3);
  if (recent.length === 0) return '暂无反思记录。';

  const lines = ['【近期反思回顾】'];
  for (const r of recent) {
    const date = new Date(r.reflected_at).toLocaleString('zh-CN', { timeZone: 'Asia/Singapore' });
    lines.push(`  [${date}] ${r.analysis?.summary || '已反思'}`);
    if (r.analysis?.issues?.length > 0) {
      for (const issue of r.analysis.issues) {
        lines.push(`    ⚠ ${issue.issue} (${issue.severity})`);
      }
    }
  }
  return lines.join('\n');
}

function getRecentLessons() {
  const index = loadIndex();
  const lessons = new Set();
  for (const r of index.reflections) {
    for (const imp of (r.analysis?.improvements || [])) {
      lessons.add(`- ${imp.action}`);
    }
  }
  return lessons.size > 0
    ? '【银月经验教训积累】\n' + [...lessons].slice(-8).join('\n')
    : '';
}

module.exports = {
  reflect,
  shouldReflect,
  getImprovementsBlock,
  getReflectionSummary,
  getRecentLessons,
  REFLECTIONS_DIR,
};
