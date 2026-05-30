'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'agents', 'main', 'sessions');
const MEM_DIR = path.join(ROOT, '.silvermoon_core', 'lcs_memory');
const WARM_DIR = path.join(MEM_DIR, 'warm');
const HOT_MEMORY = path.join(MEM_DIR, 'memory.md');
const DEERFLOW_URL = 'http://127.0.0.1:2026/api/chat';

function readAll(sinceTime) {
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

async function run() {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const msgs = readAll(since.toISOString());

  const summary = { date: now.toISOString().slice(0, 10), decisions: [], tasks: [], tech: [], unfinished: [] };

  if (msgs.length > 0) {
    try {
      const dialog = msgs.map(m => `[${m.role}] ${(m.content || '').slice(0, 500)}`).join('\n').slice(0, 10000);
      const resp = await fetch(DEERFLOW_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `你负责总结李长寿（LCS）过去24小时的工作记录。

输出格式（纯JSON）：
{"decisions":[{"item":"决策","conclusion":"结论"}],"tasks":[{"item":"完成事项","status":"done/pending"}],"tech":[{"issue":"技术问题","resolution":"解决"}],"unfinished":["未完成"]}

无则用[]。对话：
${dialog}` }], model: 'or-codex/gpt-5.4-mini'
        }), signal: AbortSignal.timeout(25000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || data.content || '';
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        Object.assign(summary, JSON.parse(cleaned));
      }
    } catch {}
  }

  fs.mkdirSync(WARM_DIR, { recursive: true });
  const fname = `${summary.date}.md`;
  const md = [
    `# LCS 每日总结 — ${summary.date}`,
    `> 范围: ${since.toISOString()} ~ ${now.toISOString()}`,
    '',
    '## 决策',
    ...(summary.decisions || []).map(d => `- **${d.item || ''}**: ${d.conclusion || ''}`) || ['*无*'],
    '',
    '## 任务',
    ...(summary.tasks || []).map(t => `- ${t.status === 'done' ? '✅' : '🔄'} ${t.item || ''}`) || ['*无*'],
    '',
    '## 技术笔记',
    ...(summary.tech || []).map(t => `- ${t.issue || ''} → ${t.resolution || ''}`) || ['*无*'],
    '',
    '## 未完成',
    ...(summary.unfinished || []).map(u => `- [ ] ${u}`) || ['*无*'],
    '',
    '---',
    `> 总消息数: ${msgs.length}`,
  ].join('\n');
  fs.writeFileSync(path.join(WARM_DIR, fname), md);

  const hotLine = `## ${summary.date} 总结\n${(summary.decisions || []).map(d => `- 决策: ${d.item || ''}`).join('\n')}\n${(summary.unfinished || []).map(u => `- [ ] ${u}`).join('\n')}\n`;
  fs.mkdirSync(path.dirname(HOT_MEMORY), { recursive: true });
  fs.appendFileSync(HOT_MEMORY, hotLine + '\n');

  console.log(`[lcs-daily] ✅ ${fname} (${msgs.length} 消息)`);
}

run().catch(e => console.error('[lcs-daily] 失败:', e.message));
