#!/usr/bin/env node
const M = require('./_memory_lib.cjs');

const LOOKBACK_HOURS = 3;
const PROMPT_TEMPLATE = `你是一个记忆提炼专家。分析以下过去 3 小时的对话记录，提取"确定的事情"。

规则：
1. 只提取"确定的事情"：确定的决策、新规则、架构变更、明确要求记住的指令
2. 忽略：闲聊、悬而未决的讨论、否定的/被废弃的方案、排程脚本自身的输出
3. 每一条格式：[原因/场景] -> [发现了什么] -> [最终结论]
4. 如果没有确定的事情，返回空数组

对话记录：
---
{{DIALOG}}
---

输出格式（纯 JSON 数组，不要 markdown 包裹）：
[
  {"reason":"触发原因/场景","discovery":"发现了什么","conclusion":"最终结论/决策"}
]`;

async function run() {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const sinceStr = since.toISOString();

  console.log(`[microsync] ${now.toISOString()} 扫描 ${sinceStr} 以来的会话...`);

  const messages = M.readAllSessions(sinceStr);
  console.log(`[microsync] 读取到 ${messages.length} 条消息（已过滤调度噪声）`);

  if (messages.length === 0) {
    console.log('[microsync] 无新消息，跳过');
    return;
  }

  const dialog = M.formatDialogContext(messages);
  const prompt = PROMPT_TEMPLATE.replace('{{DIALOG}}', dialog.slice(0, 8000));

  const result = await M.callDeerFlow(prompt);

  let entries = [];
  if (result) {
    try {
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      entries = JSON.parse(cleaned);
      if (!Array.isArray(entries)) entries = [];
    } catch {
      console.warn('[microsync] DeerFlow 返回非 JSON，用本地提取');
      entries = localExtract(messages);
    }
  } else {
    entries = localExtract(messages);
  }

  if (entries.length === 0) {
    console.log('[microsync] 无确定事项，跳过写入');
    return;
  }

  const outPath = M.getTempMemoryPath();
  const data = {
    at: M.getNow(),
    type: 'microsync',
    range: [sinceStr, now.toISOString()],
    entries,
  };
  require('fs').writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[microsync] ✅ 写入 ${entries.length} 条 → ${outPath}`);

  for (const e of entries) {
    console.log(`   • [${(e.reason || '').slice(0, 40)}] → ${(e.conclusion || '').slice(0, 60)}`);
  }
}

function localExtract(messages) {
  const entries = [];
  const userMsgs = messages.filter(m => m.role === 'user');
  for (const msg of userMsgs) {
    const c = msg.content || '';
    if (c.includes('记住了') || c.includes('记得') || c.includes('记住')) {
      entries.push({
        reason: '用户要求记录',
        discovery: '用户明确要求记住的内容',
        conclusion: c.slice(0, 200),
      });
    }
  }
  return entries;
}

run().catch(e => console.error('[microsync] 失败:', e.message));
