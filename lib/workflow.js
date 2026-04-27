/**
 * workflow.js — 流程可视化 + 子 Agent 编排
 * 用于复杂任务的进度广播和子 Agent 协作
 * 替代原有硬编码在 main.js 中的流程跟踪逻辑
 */

'use strict';

const { detectLang } = require('./intent');

// ─── 状态符号 ───────────────────────────────────────────────

const STATUS = {
  PENDING:  '⬜',
  RUNNING:  '🔄',
  DONE:     '✅',
  FAILED:   '❌',
  SKIPPED:  '➖',
};

// ─── 运行中的工作流 ─────────────────────────────────────────

/** @type {Map<string, WorkflowState>} */
const workflows = new Map();

/**
 * @typedef {object} WorkflowState
 * @property {string}   channelId  - 频道 ID
 * @property {string}   title      - 工作流标题
 * @property {Step[]}   steps      - 步骤列表
 * @property {string}   lang       - 语言
 * @property {number}   createdAt  - 创建时间戳
 * @property {Function} [onUpdate] - 状态更新回调
 */

/**
 * @typedef {object} Step
 * @property {string}   id         - 步骤 ID
 * @property {string}   label      - 步骤名称
 * @property {string}   status     - 状态符号
 * @property {string}   [detail]   - 详情
 */

// ─── 创建工作流 ─────────────────────────────────────────────

/**
 * 创建一个新的工作流
 * @param {string} channelId - 频道 ID
 * @param {Array<{ id: string, label: string }>} steps - 步骤定义
 * @param {string} [lang] - 语言
 * @param {object} [opts]
 * @param {string} [opts.title] - 工作流标题
 * @param {Function} [opts.onUpdate] - 状态更新回调
 * @returns {WorkflowState}
 */
function createWorkflow(channelId, steps, lang, opts = {}) {
  const detectedLang = lang || 'zh';
  const title = opts.title || (detectedLang === 'en' ? 'Task Progress' : detectedLang === 'ms' ? 'Perkembangan Tugas' : '任务进度');

  const state = {
    channelId,
    title,
    steps: steps.map((s) => ({
      id: s.id,
      label: s.label,
      status: STATUS.PENDING,
      detail: '',
    })),
    lang: detectedLang,
    createdAt: Date.now(),
    onUpdate: opts.onUpdate || null,
  };

  workflows.set(channelId, state);
  return state;
}

// ─── 更新步骤状态 ───────────────────────────────────────────

/**
 * 更新工作流中某一步的状态
 * @param {string} channelId - 频道 ID
 * @param {string} stepId - 步骤 ID
 * @param {string} status - 新状态 ('pending'|'running'|'done'|'failed'|'skipped')
 * @param {string} [detail] - 详情
 * @returns {WorkflowState|null}
 */
function updateStep(channelId, stepId, status, detail) {
  const state = workflows.get(channelId);
  if (!state) return null;

  const step = state.steps.find((s) => s.id === stepId);
  if (!step) return null;

  const statusMap = {
    pending: STATUS.PENDING,
    running: STATUS.RUNNING,
    done: STATUS.DONE,
    failed: STATUS.FAILED,
    skipped: STATUS.SKIPPED,
  };

  step.status = statusMap[status] || STATUS.PENDING;
  if (detail) step.detail = detail;

  return state;
}

// ─── 渲染进度消息 ───────────────────────────────────────────

/**
 * 将工作流渲染为可读的进度消息
 * @param {string} channelId - 频道 ID
 * @returns {string|null}
 */
function renderProgress(channelId) {
  const state = workflows.get(channelId);
  if (!state) return null;

  const lines = [`📋 ${state.title}`];
  for (const step of state.steps) {
    const detail = step.detail ? ` — ${step.detail}` : '';
    lines.push(`${step.status} ${step.label}${detail}`);
  }

  return lines.join('\n');
}

// ─── 子 Agent 编排 ──────────────────────────────────────────

/**
 * 将任务委托给合适的子 Agent
 * @param {object} task - 任务描述
 * @param {string} task.description - 任务描述
 * @param {string} task.channelId - 频道 ID
 * @param {Array<{ name: string, handler: Function }>} agents - 可用 Agent 列表
 * @param {object} deps - 依赖注入
 * @returns {Promise<{ ok: boolean, results: Array<{ agent: string, result: string }> }>}
 */
async function delegateToAgent(task, agents, deps = {}) {
  const results = [];
  const lang = detectLang(task.description);

  for (const agent of agents) {
    try {
      const result = await agent.handler(task, deps);
      results.push({ agent: agent.name, result: String(result || '') });
    } catch (err) {
      results.push({ agent: agent.name, result: `Error: ${err.message}` });
    }
  }

  return { ok: results.length > 0, results };
}

// ─── 任务模板 ───────────────────────────────────────────────

/**
 * 获取常用任务模板
 * @param {string} type - 模板类型
 * @param {string} [lang] - 语言
 * @returns {Array<{ id: string, label: string }>}
 */
function getTaskTemplate(type, lang) {
  const templates = {
    research: {
      zh: [
        { id: 'collect', label: '收集信息' },
        { id: 'analyze', label: '分析数据' },
        { id: 'conclude', label: '得出结论' },
      ],
      en: [
        { id: 'collect', label: 'Collect Information' },
        { id: 'analyze', label: 'Analyze Data' },
        { id: 'conclude', label: 'Draw Conclusions' },
      ],
      ms: [
        { id: 'collect', label: 'Kumpul Maklumat' },
        { id: 'analyze', label: 'Analisis Data' },
        { id: 'conclude', label: 'Buat Kesimpulan' },
      ],
    },
    development: {
      zh: [
        { id: 'plan', label: '制定方案' },
        { id: 'implement', label: '编码实现' },
        { id: 'test', label: '测试验证' },
        { id: 'deploy', label: '部署上线' },
      ],
      en: [
        { id: 'plan', label: 'Plan' },
        { id: 'implement', label: 'Implement' },
        { id: 'test', label: 'Test' },
        { id: 'deploy', label: 'Deploy' },
      ],
      ms: [
        { id: 'plan', label: 'Rancang' },
        { id: 'implement', label: 'Laksana' },
        { id: 'test', label: 'Uji' },
        { id: 'deploy', label: 'Lancar' },
      ],
    },
    finance: {
      zh: [
        { id: 'fetch', label: '获取行情' },
        { id: 'analyze', label: '分析趋势' },
        { id: 'report', label: '生成报告' },
      ],
      en: [
        { id: 'fetch', label: 'Fetch Data' },
        { id: 'analyze', label: 'Analyze Trends' },
        { id: 'report', label: 'Generate Report' },
      ],
      ms: [
        { id: 'fetch', label: 'Dapatkan Data' },
        { id: 'analyze', label: 'Analisis Trend' },
        { id: 'report', label: 'Hasil Laporan' },
      ],
    },
  };

  const detectedLang = lang || 'zh';
  return templates[type]?.[detectedLang] || templates[type]?.zh || [];
}

// ─── 清理 ───────────────────────────────────────────────────

/**
 * 清理过期的工作流（超过 1 小时）
 */
function purgeStale() {
  const now = Date.now();
  for (const [channelId, state] of workflows) {
    if (now - state.createdAt > 3600000) {
      workflows.delete(channelId);
    }
  }
}

// 每分钟清理一次
setInterval(purgeStale, 60000);

// ─── 导出 ───────────────────────────────────────────────────

module.exports = { createWorkflow, updateStep, renderProgress, delegateToAgent, getTaskTemplate, STATUS };
