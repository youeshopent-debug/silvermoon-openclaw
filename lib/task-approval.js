'use strict';

const taskRadar = require('./task-radar');

const APPROVAL_EMOJI = '👍';
const REJECT_EMOJI = '❌';
const PENDING_APPROVAL_STATUS = 'pending_approval';

function isApprovalReaction(reactionEmoji) {
  return reactionEmoji === APPROVAL_EMOJI || reactionEmoji === REJECT_EMOJI;
}

async function handleApprovalReaction(reaction, user) {
  if (user.bot) return null;
  const emoji = reaction.emoji.name;
  if (!isApprovalReaction(emoji)) return null;

  const msg = reaction.message;
  const embed = msg.embeds && msg.embeds[0];
  if (!embed) return null;

  const taskIdField = embed.fields && embed.fields.find(f => f.name === '任务ID');
  if (!taskIdField) return null;

  const taskId = taskIdField.value.trim();
  const task = taskRadar.readAllTasks().find(t => t.taskId === taskId);
  if (!task) return null;

  if (emoji === APPROVAL_EMOJI) {
    taskRadar.updateTaskStatus(taskId, { status: 'approved' });
    taskRadar.removeTaskFile(taskId);
    taskRadar.appendLog('APPROVED', taskId, `approved by ${user.tag}`);
    return { action: 'approved', taskId, title: task.title };
  }

  if (emoji === REJECT_EMOJI) {
    taskRadar.updateTaskStatus(taskId, { status: 'rejected' });
    taskRadar.removeTaskFile(taskId);
    taskRadar.appendLog('REJECTED', taskId, `rejected by ${user.tag}`);
    return { action: 'rejected', taskId, title: task.title };
  }

  return null;
}

function buildApprovalEmbed(taskInfo) {
  return {
    color: 0xFFD700,
    title: '📋 任务完成待审批',
    fields: [
      { name: '任务ID', value: taskInfo.taskId, inline: false },
      { name: '标题', value: taskInfo.title, inline: false },
      { name: '负责人', value: taskInfo.owner, inline: true },
      { name: '紧急程度', value: taskInfo.urgency, inline: true },
      { name: '来源', value: taskInfo.source, inline: true },
      { name: '创建时间', value: taskInfo.createdAt, inline: false },
      { name: '状态', value: taskInfo.status, inline: true },
      { name: '操作', value: `请点击 👍 批准 或 ❌ 驳回`, inline: false },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: '银月钱庄 · 任务审批系统' },
  };
}

function markPendingApproval(taskId) {
  return taskRadar.updateTaskStatus(taskId, { status: PENDING_APPROVAL_STATUS });
}

module.exports = {
  APPROVAL_EMOJI,
  REJECT_EMOJI,
  PENDING_APPROVAL_STATUS,
  isApprovalReaction,
  handleApprovalReaction,
  buildApprovalEmbed,
  markPendingApproval,
};
