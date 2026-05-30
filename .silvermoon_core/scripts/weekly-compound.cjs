#!/usr/bin/env node
const M = require('./_memory_lib.cjs');
const fs = require('fs');

const PROMPT_TEMPLATE = `你是银月钱庄的记忆蒸馏大师。本周围绕系统开发与运营有以下记录：

Microsync 微同步记录（重点捕捉）：
---
{{MICROSYNC}}
---

Daily Wrap-up 每日总结：
---
{{DAILY}}
---

当前 memory.md（热记忆）内容：
---
{{HOT_MEMORY}}
---

请执行两个任务：

### 任务 1：提炼精华
从上述微同步和每日总结中，提取"值得长期保留"的核心精华（不超过 500 字）。
输出格式（纯 JSON，不要 markdown）：
{"essence": "长期保留的核心精华内容（Markdown格式文本）"}

### 任务 2：减肥建议
扫描当前 memory.md，找出"已完成的专案、被取代的旧设定、过于琐碎的细节"，建议移除内容。
输出格式（纯 JSON，不要 markdown）：
{"remove_items": ["建议移除的条目1", "建议移除的条目2"]}`;

async function run() {
  const now = new Date();
  console.log(`[weekly-compound] ${now.toISOString()} 开始本周蒸馏...`);

  const microDir = M.MICRO_DIR;
  const warmDir = M.WARM_DIR;
  const hotMemoryPath = M.HOT_MEMORY;

  const microFiles = fs.existsSync(microDir)
    ? fs.readdirSync(microDir).filter(f => f.endsWith('.json')).sort().slice(-30)
    : [];
  const microData = [];
  for (const f of microFiles) {
    try {
      microData.push(JSON.parse(fs.readFileSync(path.join(microDir, f), 'utf-8')));
    } catch {}
  }
  const microSummary = microData.flatMap(d => d.entries || []).slice(0, 50);

  const dailyFiles = fs.existsSync(warmDir)
    ? fs.readdirSync(warmDir).filter(f => f.endsWith('.md') && !f.startsWith('TEMPLATE')).sort().slice(-10)
    : [];
  const dailySummary = dailyFiles.map(f => {
    const content = fs.readFileSync(path.join(warmDir, f), 'utf-8');
    return `[${f}]\n${content.slice(0, 1000)}`;
  }).join('\n\n---\n\n');

  const hotMemory = fs.existsSync(hotMemoryPath) ? fs.readFileSync(hotMemoryPath, 'utf-8') : '(空)';

  const currentSizeKB = Buffer.byteLength(hotMemory, 'utf-8') / 1024;
  console.log(`[weekly-compound] memory.md 当前大小: ${currentSizeKB.toFixed(1)}KB`);

  const prompt = PROMPT_TEMPLATE
    .replace('{{MICROSYNC}}', microSummary.map(e =>
      `- ${e.reason || ''} → ${e.discovery || ''} → ${e.conclusion || ''}`
    ).join('\n') || '(无)')
    .replace('{{DAILY}}', dailySummary || '(无)')
    .replace('{{HOT_MEMORY}}', hotMemory.slice(0, 4000));

  const result = await M.callDeerFlow(prompt);

  if (result) {
    try {
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const essence = parsed.essence;
      const removeItems = parsed.remove_items || [];

      if (essence && essence.length > 50) {
        M.ensureDir(M.COLD_DIR);
        const essencePath = path.join(M.COLD_DIR, 'research', `weekly_essence_${now.toISOString().slice(0, 10)}.md`);
        fs.writeFileSync(essencePath, `# 每周精華 — ${now.toISOString().slice(0, 10)}\n\n${essence}\n`, 'utf-8');
        console.log(`[weekly-compound] ✅ 精華已写入 → ${essencePath}`);

        M.appendToHotMemory(`\n> [每周精華 ${now.toISOString().slice(0, 10)}] ${essence.slice(0, 200)}...`);
      }

      if (removeItems.length > 0) {
        console.log(`[weekly-compound] ${removeItems.length} 条建议移除：`);
        removeItems.forEach(item => console.log(`   🗑️ ${item}`));

        M.archiveHotMemory();

        const slimMemory = stripFromHotMemory(hotMemory, removeItems);
        if (slimMemory.length < hotMemory.length) {
          fs.writeFileSync(hotMemoryPath, slimMemory, 'utf-8');
          const newSizeKB = Buffer.byteLength(slimMemory, 'utf-8') / 1024;
          console.log(`[weekly-compound] ✅ memory.md 减重: ${currentSizeKB.toFixed(1)}KB → ${newSizeKB.toFixed(1)}KB`);
        }
      } else {
        console.log('[weekly-compound] 无减肥建议');
      }
    } catch (e) {
      console.warn('[weekly-compound] DeerFlow 解析失败:', e.message);
    }
  } else {
    console.log('[weekly-compound] DeerFlow 不可用，执行本地归档');
    M.archiveHotMemory();
  }

  console.log('[weekly-compound] ✅ 完成');
}

function stripFromHotMemory(content, removeItems) {
  let result = content;
  for (const item of removeItems) {
    if (typeof item === 'string' && item.length > 5) {
      result = result.split(item).join('');
    }
  }
  const lines = result.split('\n').filter(l => l.trim());
  const deduped = [];
  for (const line of lines) {
    if (!deduped.includes(line)) deduped.push(line);
  }
  return deduped.join('\n');
}

const path = require('path');
run().catch(e => console.error('[weekly-compound] 失败:', e.message));
