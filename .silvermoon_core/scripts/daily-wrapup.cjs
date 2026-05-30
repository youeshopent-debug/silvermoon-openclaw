#!/usr/bin/env node
const M = require('./_memory_lib.cjs');
const fs = require('fs');

const LOOKBACK_HOURS = 24;
const PROMPT_TEMPLATE = `你是银月钱庄的记忆总管。分析以下过去 24 小时的完整对话记录，生成结构化摘要。

输出格式要求（纯 JSON 对象，不要 markdown 包裹）：
{
  "decisions": [{"item":"决策内容", "reason":"原因", "conclusion":"结论"}],
  "action_items": [{"item":"待办事项", "owner":"负责人（未知就写 待定）", "priority":"high/medium/low"}],
  "key_dialogues": [{"topic":"主题", "summary":"摘要"}],
  "tech_notes": [{"issue":"问题", "cause":"原因", "resolution":"解决方案"}],
  "unfinished": ["未完成任务"]
}

如果没有某项，用空数组 []。

对话记录：
---
{{DIALOG}}
---`;

async function run() {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const sinceStr = since.toISOString();

  console.log(`[daily-wrapup] ${now.toISOString()} 扫描过去 24 小时...`);

  const messages = M.readAllSessions(sinceStr);
  console.log(`[daily-wrapup] 读取到 ${messages.length} 条消息（已过滤调度噪声）`);

  if (messages.length === 0) {
    console.log('[daily-wrapup] 无消息，生成空摘要');
    writeEmptySummary(now);
    return;
  }

  const dialog = M.formatDialogContext(messages);
  const prompt = PROMPT_TEMPLATE.replace('{{DIALOG}}', dialog.slice(0, 12000));

  const result = await M.callDeerFlow(prompt);

  let summary;
  if (result) {
    try {
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      summary = JSON.parse(cleaned);
    } catch {
      console.warn('[daily-wrapup] DeerFlow 解析失败，用本地提取');
      summary = localExtract(messages);
    }
  } else {
    summary = localExtract(messages);
  }

  const outPath = M.getDailyPath(now);
  const md = renderMarkdown(summary, now, sinceStr);
  M.ensureDir(M.WARM_DIR);
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`[daily-wrapup] ✅ 写入 → ${outPath}`);

  for (const d of (summary.decisions || [])) {
    console.log(`   📋 决策: ${(d.item || d.conclusion || '').slice(0, 60)}`);
  }
  for (const a of (summary.action_items || [])) {
    console.log(`   🔧 待办: ${(a.item || '').slice(0, 60)} (${a.priority || 'medium'})`);
  }
}

function localExtract(messages) {
  const decisions = [];
  const action_items = [];
  const tech_notes = [];
  const unfinished = [];

  for (const m of messages) {
    const c = m.content || '';
    if (m.role === 'user') {
      if (c.includes('决策') || c.includes('决定') || c.includes('就这样')) {
        decisions.push({ item: c.slice(0, 100), reason: '对话中提及', conclusion: c.slice(0, 100) });
      }
      if (c.includes('帮我') || c.includes('需要') || c.includes('实现') || c.includes('做')) {
        action_items.push({ item: c.slice(0, 100), owner: '待定', priority: 'medium' });
      }
      if (c.includes('bug') || c.includes('错误') || c.includes('问题') || c.includes('修复')) {
        tech_notes.push({ issue: c.slice(0, 100), cause: '待分析', resolution: '待解决' });
      }
    }
  }
  return { decisions, action_items, key_dialogues: [], tech_notes, unfinished };
}

function renderMarkdown(s, dateObj, sinceStr) {
  const dateStr = dateObj.toISOString().slice(0, 10);
  const lines = [
    `# 每日总结 — ${dateStr}`,
    '',
    `> 时间范围：${sinceStr} ~ ${dateObj.toISOString()}`,
    `> 类型：daily-wrapup | 生成时间：${M.getNow()}`,
    '',
    '---',
    '',
    '## Decisions（决策）',
    '',
  ];
  for (const d of (s.decisions || [])) {
    lines.push(`- **${d.item || d.conclusion || ''}**：${d.reason || ''} → ${d.conclusion || ''}`);
  }
  if (!(s.decisions || []).length) lines.push('*（无新决策）*');

  lines.push('', '---', '', '## Action Items（待办事项）', '');
  for (const a of (s.action_items || [])) {
    const prio = { high: '🔴', medium: '🟡', low: '🟢' }[a.priority] || '🟡';
    lines.push(`- ${prio} [ ] ${a.item}（${a.owner || '待定'}）`);
  }
  if (!(s.action_items || []).length) lines.push('*（无待办事项）*');

  lines.push('', '---', '', '## Key Dialogues（关键对话）', '');
  for (const k of (s.key_dialogues || [])) {
    lines.push(`- **${k.topic || ''}**：${k.summary || ''}`);
  }
  if (!(s.key_dialogues || []).length) lines.push('*（无关键对话记录）*');

  lines.push('', '---', '', '## 技术笔记/问题排除', '');
  for (const t of (s.tech_notes || [])) {
    lines.push(`- **问题**：${t.issue || ''} → **原因**：${t.cause || ''} → **解决**：${t.resolution || ''}`);
  }
  if (!(s.tech_notes || []).length) lines.push('*（无技术笔记）*');

  lines.push('', '---', '', '## 未完成/明天任务', '');
  for (const u of (s.unfinished || [])) {
    lines.push(`- [ ] ${u}`);
  }
  if (!(s.unfinished || []).length) lines.push('*（无待办）*');

  return lines.join('\n');
}

function writeEmptySummary(dateObj) {
  const md = renderMarkdown({ decisions: [], action_items: [], key_dialogues: [], tech_notes: [], unfinished: [] }, dateObj, new Date(Date.now() - 24*60*60*1000).toISOString());
  const outPath = M.getDailyPath(dateObj);
  M.ensureDir(M.WARM_DIR);
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`[daily-wrapup] ✅ 空摘要 → ${outPath}`);
}

run().catch(e => console.error('[daily-wrapup] 失败:', e.message));
