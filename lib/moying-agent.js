'use strict';

const fs = require('fs');
const path = require('path');

const MOYING_DIR = path.join(__dirname, '..', '.silvermoon_core', 'moying');
const ESCALATION_DIR = path.join(MOYING_DIR, 'escalation_reports');
const MOYING_LOG = path.join(__dirname, '..', 'workspace', 'CRON', 'moying_agent.log');

let moyingState = {
  enabled: true,
  reminderInterval: 10 * 60 * 1000,
  maxRemindersPerTask: 5,
  lastReminderSent: {},
  reminderCount: {},
};

let telegramSendRef = null;
let discordSendRef = null;

if (!fs.existsSync(MOYING_DIR)) fs.mkdirSync(MOYING_DIR, { recursive: true });
if (!fs.existsSync(ESCALATION_DIR)) fs.mkdirSync(ESCALATION_DIR, { recursive: true });

function moLog(action, detail) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action,
      detail: String(detail).slice(0, 500),
    }) + '\n';
    fs.appendFileSync(MOYING_LOG, line, 'utf8');
  } catch {}
}

function setBridges(telegramFn, discordFn) {
  telegramSendRef = telegramFn;
  discordSendRef = discordFn;
}

async function sendToUser(text) {
  if (telegramSendRef) {
    try { await telegramSendRef(text); } catch (e) { moLog('TG_ERR', e.message); }
  }
  if (discordSendRef) {
    try { await discordSendRef(text); } catch (e) { moLog('DC_ERR', e.message); }
  }
}

async function sendReminder(level, title, message) {
  const text = `🔔 墨影提醒 [${level}]\n📋 ${title}\n\n${message}`;
  await sendToUser(text);
}

/**
 * 生成卡住任务升级报告
 * 5次提醒后自动触发，分析根因+给出修复建议
 */
function generateEscalationReport(stuckTask, allTasks) {
  const now = new Date();
  const created = new Date(stuckTask.createdAt || now);
  const stuckDurationMs = now - created;
  const stuckHours = Math.floor(stuckDurationMs / 3600000);
  const stuckMins = Math.floor((stuckDurationMs % 3600000) / 60000);

  const report = {
    reportId: `esc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    generatedAt: now.toISOString(),
    taskId: stuckTask.taskId || 'unknown',
    taskTitle: stuckTask.title || stuckTask.name || '未知任务',
    taskSource: stuckTask.source || 'unknown',
    taskOwner: stuckTask.owner || 'unassigned',
    stuckDuration: `${stuckHours}h${stuckMins}m`,
    totalRemindersSent: moyingState.reminderCount[stuckTask.taskId] || 0,
    currentStatus: stuckTask.status || 'todo',

    rootCauseAnalysis: analyzeRootCause(stuckTask),
    fixRecommendations: generateFixRecommendations(stuckTask),

    taskContext: {
      rawText: stuckTask.rawText || '',
      urgency: stuckTask.urgency || 'medium',
      createdAt: stuckTask.createdAt,
      updatedAt: stuckTask.updatedAt,
      patrolCount: stuckTask.patrolCount || 0,
      stuckCount: stuckTask.stuckCount || 0,
    },
  };

  return report;
}

function analyzeRootCause(stuckTask) {
  const causes = [];
  const owner = stuckTask.owner || '';

  if (!owner || owner === 'unassigned') {
    causes.push('❌ 未分配执行人 — 任务没有指定归属 Agent，无人执行');
  }
  if (stuckTask.patrolCount > 10) {
    causes.push('⏳ 看门狗巡检超过10次仍未完成 — 可能任务定义有问题或依赖资源不可用');
  }
  if (stuckTask.source === 'cron_chain') {
    causes.push('⏰ Cron 定时任务触发 — Agent 可能离线或未收到指令');
  }
  if (stuckTask.stuckCount > 3) {
    causes.push('🔁 多次被标记为卡住 — 任务可能陷入循环或死锁');
  }

  if (causes.length === 0) {
    causes.push('📋 任务已派发但未确认完成 — 需检查 Agent 是否在线或是否有依赖阻塞');
  }

  return causes;
}

function generateFixRecommendations(stuckTask) {
  const recs = [];
  const owner = stuckTask.owner || '';

  if (!owner || owner === 'unassigned') {
    recs.push('方案一：指派执行人 — 用 set_cron 重新指定 owner');
  }
  if (owner && owner !== 'unassigned') {
    recs.push('方案二：检查 ' + owner + ' 是否在线，手动唤醒后重试');
  }
  recs.push('方案三：标记为"已失效"并创建替代任务');

  return recs;
}

/**
 * 升级报告处理入口
 * 5次提醒后触发
 */
async function onEscalation(stuckTask, allTasks) {
  const report = generateEscalationReport(stuckTask, allTasks);

  const reportPath = path.join(ESCALATION_DIR, `${report.reportId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  moLog('ESCALATION', `生成报告: ${report.reportId} [${report.taskTitle}]`);

  const reportText = [
    `🚨 **任务卡住升级报告**`,
    `━━━━━━━━━━━━━━━━━`,
    `📋 任务: ${report.taskTitle}`,
    `👤 负责人: ${report.taskOwner}`,
    `⏱ 卡住时长: ${report.stuckDuration}`,
    `🔔 已提醒: ${report.totalRemindersSent}次`,
    `📌 当前状态: ${report.currentStatus}`,
    ``,
    `**🔍 根因分析：**`,
    ...report.rootCauseAnalysis.map(c => c),
    ``,
    `**🛠 修复建议：**`,
    ...report.fixRecommendations.map(c => c),
    ``,
    `🏷 报告ID: \`${report.reportId}\``,
  ].join('\n');

  await sendToUser(reportText);
  moLog('ESCALATION_SENT', `报告已发送: ${report.reportId}`);
}

async function onStuckTask(stuckTask, allTasks) {
  if (!moyingState.enabled) return;

  const taskId = stuckTask.taskId || stuckTask.title || 'unknown';
  const now = Date.now();
  const lastSent = moyingState.lastReminderSent[taskId] || 0;
  const count = moyingState.reminderCount[taskId] || 0;

  // 已达最大提醒次数 → 触发升级报告
  if (count >= moyingState.maxRemindersPerTask) {
    await onEscalation(stuckTask, allTasks);
    moyingState.reminderCount[taskId] = count + 1; // 标记为已升级，避免重复触发
    return;
  }

  // 未达间隔时间 → 跳过
  if (now - lastSent < moyingState.reminderInterval) return;

  moyingState.lastReminderSent[taskId] = now;
  moyingState.reminderCount[taskId] = count + 1;

  let level = 'INFO';
  let prefix = '';
  if (count >= 3) {
    level = 'CRITICAL';
    prefix = '⚠️ 多次提醒未完成！';
  } else if (count >= 1) {
    level = 'WARN';
    prefix = '⏳ 任务持续卡住！';
  }

  const title = stuckTask.title || stuckTask.name || '未知任务';
  const desc = [
    prefix,
    `任务: ${title}`,
    `来源: ${stuckTask.source || 'unknown'}`,
    `状态: ${stuckTask.status || 'todo'}`,
    `创建: ${stuckTask.createdAt || 'unknown'}`,
    `提醒次数: ${count + 1}/${moyingState.maxRemindersPerTask}`,
    `卡住任务总数: ${allTasks ? allTasks.length : 0}`,
  ].join('\n');

  await sendReminder(level, title, desc);
  moLog('REMIND', `task=${title} level=${level} count=${count + 1}`);

  const recordPath = path.join(MOYING_DIR, `${taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  try {
    const record = { taskId, title, level, count: count + 1, lastReminded: new Date().toISOString() };
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf8');
  } catch {}
}

function resetReminders(taskId) {
  if (taskId) {
    delete moyingState.lastReminderSent[taskId];
    delete moyingState.reminderCount[taskId];
    const recordPath = path.join(MOYING_DIR, `${taskId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    try { fs.unlinkSync(recordPath); } catch {}
  } else {
    moyingState.lastReminderSent = {};
    moyingState.reminderCount = {};
    try {
      const files = fs.readdirSync(MOYING_DIR);
      for (const f of files) {
        const fp = path.join(MOYING_DIR, f);
        if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
      }
    } catch {}
  }
  moLog('RESET', taskId ? `task=${taskId}` : 'all');
}

function getStatus() {
  return {
    enabled: moyingState.enabled,
    activeReminders: Object.keys(moyingState.lastReminderSent).length,
    totalRemindersSent: Object.values(moyingState.reminderCount).reduce((a, b) => a + b, 0),
    escalationDir: ESCALATION_DIR,
    config: {
      reminderInterval: moyingState.reminderInterval,
      maxRemindersPerTask: moyingState.maxRemindersPerTask,
    },
  };
}

/**
 * Agent 离线自动恢复
 * 当检测到 agentBot 失联时调用，尝试重启 polling
 */
async function recoverAgent(agentId, agentName, agentBotRef) {
  const tag = `${agentName || agentId || 'unknown'}`;
  moLog('RECOVER_ATTEMPT', `开始恢复 ${tag}`);

  if (!agentBotRef || typeof agentBotRef.startPolling !== 'function') {
    moLog('RECOVER_FAIL', `${tag} 无有效 bot 引用`);
    return {
      success: false,
      agentId,
      agentName,
      message: `❌ ${tag} 无有效 Telegram Bot 实例，无法自动恢复。请手动重启网关。`,
      attempts: 0,
    };
  }

  const MAX_ATTEMPTS = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await agentBotRef.stopPolling().catch(() => {});
      await new Promise(r => setTimeout(r, 2000 * attempt)); // 退避等待
      await agentBotRef.startPolling();

      moLog('RECOVER_OK', `${tag} 第${attempt}次尝试成功`);
      return {
        success: true,
        agentId,
        agentName,
        message: `✅ ${tag} 已恢复（${agentName}）`,
        attempts: attempt,
      };
    } catch (err) {
      lastError = err;
      moLog('RECOVER_RETRY', `${tag} 第${attempt}次失败: ${err.message}`);
    }
  }

  const failMsg = `❌ ${tag} 自动恢复失败（${MAX_ATTEMPTS}次尝试均失败）: ${lastError?.message || '未知错误'}。`;
  moLog('RECOVER_FAIL', failMsg);
  return {
    success: false,
    agentId,
    agentName,
    message: failMsg,
    attempts: MAX_ATTEMPTS,
    lastError: lastError?.message,
  };
}

module.exports = {
  setBridges,
  onStuckTask,
  resetReminders,
  getStatus,
  recoverAgent,
  MOYING_DIR,
  ESCALATION_DIR,
};
