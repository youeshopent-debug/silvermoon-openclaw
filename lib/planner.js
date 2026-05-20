'use strict';

const fs = require('fs');
const path = require('path');
const selfState = require('./self-state');
const memoryPalace = require('./memory-palace');

const PLANS_DIR = path.join(__dirname, '..', '.silvermoon_core', 'plans');
const QUEUE_FILE = path.join(PLANS_DIR, 'task_queue.json');

function ensureDir() {
  if (!fs.existsSync(PLANS_DIR)) fs.mkdirSync(PLANS_DIR, { recursive: true });
}

function readQueue() {
  ensureDir();
  try {
    if (fs.existsSync(QUEUE_FILE)) return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch {}
  return { tasks: [], nextId: 1 };
}

function writeQueue(queue) {
  ensureDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
}

// ─── P-L-A-N 四阶段 ──────────────────────────────────────

function perceive(taskInput, context) {
  const state = selfState.get();
  const memorySummary = memoryPalace.getMemorySummary();
  return {
    task: taskInput,
    context,
    selfState: {
      mood: state.mood,
      errorRate: state.error_rate_24h,
      successRate: state.task_success_rate_7d,
      consecutiveErrors: state.consecutive_errors,
    },
    memoryStatus: memorySummary,
    timestamp: new Date().toISOString(),
    complexity: estimateComplexity(taskInput),
  };
}

function estimateComplexity(taskInput) {
  const text = (typeof taskInput === 'string' ? taskInput : JSON.stringify(taskInput)).toLowerCase();
  let score = 0;

  // 多步骤指标
  const multiStepIndicators = ['并且', '然后', '同时', '先', '再', 'and', 'then', 'also', 'first', 'then'];
  for (const ind of multiStepIndicators) {
    if (text.includes(ind)) score += 2;
  }
  // 需要调研
  if (text.includes('调研') || text.includes('research') || text.includes('调查') || text.includes('分析')) score += 3;
  // 需要编码
  if (text.includes('代码') || text.includes('code') || text.includes('实现') || text.includes('implement')) score += 3;
  // 需要多个工具
  if (text.includes('调用') || text.includes('call') || text.includes('tool') || text.includes('工具')) score += 2;
  // 涉及多人
  if (text.includes('团队') || text.includes('team') || text.includes('分配') || text.includes('协作')) score += 2;
  // 长度指标
  const words = text.split(/\s+/).length;
  if (words > 50) score += 2;
  if (words > 100) score += 3;

  if (score >= 8) return { level: 'complex', score, reason: '高复杂度任务' };
  if (score >= 4) return { level: 'moderate', score, reason: '中等复杂度' };
  return { level: 'simple', score, reason: '简单任务' };
}

function learn(taskPlan, history) {
  const relevantMemories = [];
  if (typeof taskPlan.task === 'string') {
    const keywords = taskPlan.task.split(/\s+/).filter(w => w.length > 2);
    for (const kw of keywords.slice(0, 5)) {
      const found = memoryPalace.searchAll(kw, 3);
      relevantMemories.push(...found);
    }
  }
  return {
    relevantMemories: relevantMemories.slice(0, 10),
    previousSimilarTasks: relevantMemories.filter(m => m.type === 'task').length,
    lessonsFromHistory: relevantMemories.length > 0 ? '有相关经验可以参考' : '没有找到相关历史记录',
  };
}

function plan(taskPlan, learned) {
  const queue = readQueue();
  const taskId = `plan-${Date.now().toString(36)}-${queue.nextId}`;
  queue.nextId++;

  const planRecord = {
    id: taskId,
    createdAt: new Date().toISOString(),
    source: 'planner',
    complexity: taskPlan.complexity,
    task: taskPlan.task,
    context: taskPlan.context,
    historicalLessons: learned.lessonsFromHistory,
    steps: generateSteps(taskPlan),
    status: 'pending',
    priority: taskPlan.complexity.level === 'complex' ? 'high' : taskPlan.complexity.level === 'moderate' ? 'medium' : 'low',
  };

  queue.tasks.push(planRecord);
  if (queue.tasks.length > 50) queue.tasks = queue.tasks.slice(-50);
  writeQueue(queue);

  memoryPalace.addEpisode(
    `新建计划: ${typeof taskPlan.task === 'string' ? taskPlan.task.slice(0, 100) : '复杂任务'}`,
    'task',
    'neutral',
    `优先级: ${planRecord.priority}, 复杂度: ${taskPlan.complexity.level}`
  );

  return planRecord;
}

function generateSteps(taskPlan) {
  const complexity = taskPlan.complexity.level;
  const steps = [];

  if (complexity === 'simple') {
    steps.push({ order: 1, action: '执行任务', expectedOutput: '任务完成' });
  } else if (complexity === 'moderate') {
    steps.push({ order: 1, action: '拆解任务为子步骤', expectedOutput: '任务拆解清单' });
    steps.push({ order: 2, action: '按序执行各子步骤', expectedOutput: '逐步完成' });
    steps.push({ order: 3, action: '汇总结果并报告', expectedOutput: '完成报告' });
  } else {
    steps.push({ order: 1, action: '需求分析与方案设计', expectedOutput: '方案概要' });
    steps.push({ order: 2, action: '判断是否需要调用团队力量', expectedOutput: '团队任务分配' });
    steps.push({ order: 3, action: '分阶段执行', expectedOutput: '阶段性成果' });
    steps.push({ order: 4, action: '集成验证', expectedOutput: '验证通过' });
    steps.push({ order: 5, action: '输出最终结果', expectedOutput: '最终报告' });
  }

  return steps;
}

function act(planId, result) {
  const queue = readQueue();
  const task = queue.tasks.find(t => t.id === planId);
  if (!task) return false;

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.result = result;
  writeQueue(queue);

  selfState.recordTaskCompletion(true);
  memoryPalace.addEpisode(
    `完成任务: ${typeof task.task === 'string' ? task.task.slice(0, 100) : '复杂任务'}`,
    'task',
    'positive',
    `完成于 ${task.completedAt}`
  );

  return true;
}

function note(planId, notes) {
  const queue = readQueue();
  const task = queue.tasks.find(t => t.id === planId);
  if (!task) return false;

  if (!task.notes) task.notes = [];
  task.notes.push({
    content: notes,
    timestamp: new Date().toISOString(),
  });
  writeQueue(queue);
  return true;
}

// ─── 完整流程 ─────────────────────────────────────────────

async function fullPlan(taskInput, context = {}) {
  const perceived = perceive(taskInput, context);
  const learned = learn(perceived, context.history);
  const planRecord = plan(perceived, learned);
  return { plan: planRecord, perceived, learned };
}

// ─── 查询 ────────────────────────────────────────────────

function getPendingTasks() {
  const queue = readQueue();
  return queue.tasks.filter(t => t.status === 'pending');
}

function getAllTasks(limit = 20) {
  const queue = readQueue();
  return queue.tasks.slice(-limit);
}

function getTaskStats() {
  const queue = readQueue();
  const total = queue.tasks.length;
  const pending = queue.tasks.filter(t => t.status === 'pending').length;
  const completed = queue.tasks.filter(t => t.status === 'completed').length;
  const highPriority = queue.tasks.filter(t => t.priority === 'high' && t.status === 'pending').length;
  return { total, pending, completed, highPriority };
}

function getPlannerBlock() {
  const stats = getTaskStats();
  const pending = getPendingTasks();
  const lines = [
    '【银月任务队列】',
    `  待办: ${stats.pending} | 已完成: ${stats.completed} | 高优待办: ${stats.highPriority}`,
  ];
  for (const task of pending.slice(0, 5)) {
    const taskText = typeof task.task === 'string' ? task.task.slice(0, 80) : JSON.stringify(task.task).slice(0, 80);
    lines.push(`  [${task.priority}] ${taskText}`);
  }
  return lines.join('\n');
}

module.exports = {
  perceive,
  estimateComplexity,
  learn,
  plan,
  act,
  note,
  fullPlan,
  getPendingTasks,
  getAllTasks,
  getTaskStats,
  getPlannerBlock,
};
