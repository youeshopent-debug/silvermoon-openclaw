'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'agents', 'main', 'sessions');
const MEM_DIR = path.join(ROOT, '.silvermoon_core', 'lcs_memory');
const WARM_DIR = path.join(MEM_DIR, 'warm');
const HOT_MEMORY = path.join(MEM_DIR, 'memory.md');
const DEERFLOW_URL = 'http://127.0.0.1:2026/api/chat';
const LOOKBACK = 3;

function readSessions(sinceTime) {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'));
  const all = [];
  const since = new Date(sinceTime).getTime();
  for (const file of files) {
    try {
      const lines = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'message') continue;
          const ts = new Date(entry.createdAt || entry.timestamp || 0).getTime();
          if (ts >= since) all.push({ role: entry.role, content: entry.content, ts });
        } catch {}
      }
    } catch {}
  }
  all.sort((a, b) => a.ts - b.ts);
  return all;
}

function localExtract(msgs) {
  const entries = [];
  for (const m of msgs) {
    if (m.role !== 'user') continue;
    const c = (m.content || '').toLowerCase();
    if (c.includes('记住') || c.includes('记得') || c.includes('记录') || c.includes('守则') || c.includes('规则'))
      entries.push({ reason: '用户指令', discovery: '用户要求记录', conclusion: m.content.slice(0, 200) });
    if (c.includes('不要') || c.includes('禁止') || c.includes('不准') || c.includes('不能'))
      entries.push({ reason: '禁止事项', discovery: '用户明确禁止', conclusion: m.content.slice(0, 200) });
  }
  return entries;
}

async function run() {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK * 60 * 60 * 1000);
  const msgs = readSessions(since.toISOString());
  if (msgs.length === 0) { console.log('[lcs-microsync] 无新消息'); return; }

  let entries = [];
  try {
    const dialog = msgs.map(m => `[${m.role}] ${(m.content || '').slice(0, 1000)}`).join('\n').slice(0, 8000);
    const resp = await fetch(DEERFLOW_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `你负责提炼李长寿（LCS）最近3小时的"确定事项"。

规则：只提取明确的决策、新规则、架构变更、用户指令。忽略闲聊、排程输出。
输出纯JSON数组：[{"reason":"场景","discovery":"发现","conclusion":"结论"}]
无则返回[]。

对话：
${dialog}` }], model: 'or-codex/gpt-5.4-mini'
      }), signal: AbortSignal.timeout(20000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || data.content || data.message?.content || '';
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      entries = JSON.parse(cleaned);
      if (!Array.isArray(entries)) entries = [];
    }
  } catch {}
  if (entries.length === 0) entries = localExtract(msgs);
  if (entries.length === 0) { console.log('[lcs-microsync] 无确定事项'); return; }

  fs.mkdirSync(WARM_DIR, { recursive: true });
  const fname = `${now.toISOString().slice(0, 10)}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.json`;
  fs.writeFileSync(path.join(WARM_DIR, fname), JSON.stringify({ at: now.toISOString(), type: 'microsync', entries }, null, 2));

  const mdEntry = entries.map(e => `- [${now.toISOString().slice(0, 10)}] ${e.conclusion || ''}`).join('\n');
  fs.mkdirSync(path.dirname(HOT_MEMORY), { recursive: true });
  fs.appendFileSync(HOT_MEMORY, mdEntry + '\n');

  console.log(`[lcs-microsync] ✅ ${entries.length} 条 → ${fname}`);
}

run().catch(e => console.error('[lcs-microsync] 失败:', e.message));
