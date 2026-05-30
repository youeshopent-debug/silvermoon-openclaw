'use strict';
const fs = require('fs');
const path = require('path');

const MEM_DIR = path.resolve(__dirname, '..', '.silvermoon_core', 'lcs_memory');
const WARM_DIR = path.join(MEM_DIR, 'warm');
const COLD_DIR = path.join(MEM_DIR, 'cold');
const HOT_MEMORY = path.join(MEM_DIR, 'memory.md');
const DEERFLOW_URL = 'http://127.0.0.1:2026/api/chat';

async function run() {
  const now = new Date();
  const weekTag = now.toISOString().slice(0, 10);

  fs.mkdirSync(COLD_DIR, { recursive: true });

  const hotContent = fs.existsSync(HOT_MEMORY) ? fs.readFileSync(HOT_MEMORY, 'utf-8') : '';
  const warmFiles = fs.existsSync(WARM_DIR) ? fs.readdirSync(WARM_DIR).filter(f => f.endsWith('.md')).sort().slice(-10) : [];
  const warmContent = warmFiles.map(f => `[${f}]\n${fs.readFileSync(path.join(WARM_DIR, f), 'utf-8').slice(0, 500)}`).join('\n---\n');

  let essence = `每周精馏 — ${weekTag}\n\n`;
  if (hotContent || warmContent) {
    const prompt = `你负责对李长寿（LCS）本周工作记录做精馏。

热记忆：
${hotContent.slice(0, 3000) || '(空)'}

每日总结：
${warmContent.slice(0, 3000) || '(空)'}

输出纯JSON：
{"essence":"持续有效的核心知识（<300字）","archive":["可以归档的旧条目"]}`;
    try {
      const resp = await fetch(DEERFLOW_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }], model: 'or-codex/gpt-5.4-mini'
        }), signal: AbortSignal.timeout(30000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || data.content || '';
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        essence += parsed.essence || '(无)';
        if (parsed.archive?.length > 0) {
          const archivePath = path.join(COLD_DIR, `archive_${weekTag}.md`);
          fs.writeFileSync(archivePath, `# 归档 — ${weekTag}\n\n${parsed.archive.map(i => `- ${i}`).join('\n')}\n`);
          console.log(`[lcs-weekly] 📦 归档 ${parsed.archive.length} 条`);
        }
      }
    } catch {}
  } else {
    essence += '(本周无记录)';
  }

  const essencePath = path.join(COLD_DIR, `weekly_${weekTag}.md`);
  fs.writeFileSync(essencePath, essence);
  console.log(`[lcs-weekly] ✅ 精馏 → ${essencePath}`);
}

run().catch(e => console.error('[lcs-weekly] 失败:', e.message));
