'use strict';
/**
 * 追踪 !rag 输出管道：从 DB → searchSemantic → tool-router handler → sendTelegramReply
 * 找出 English 文本在哪个环节被过滤
 */
const path = require('path');
const { createMemory } = require('./lib/memory');
const MEMORY_SQLITE_PATH = path.join(__dirname, 'user_data', 'memory', 'silvermoon_memory.sqlite');
const memory = createMemory({ dbPath: MEMORY_SQLITE_PATH });

async function main() {
  // 1. 从 memory searchSemantic 取数据
  const results = await memory.searchSemantic('银月钱庄有哪些智能体', { limit: 5 });
  console.log('=== STEP 1: searchSemantic raw output ===');
  for (const r of results) {
    console.log(`SCORE:`, r.score);
    console.log(`CONTENT (raw):`, JSON.stringify(r.content));
    console.log(`AT (raw):`, JSON.stringify(r.at));
  }

  // 2. 模拟 tool-router.js handler 的逻辑
  // (1) content slice(0, 500)
  // (2) at append
  const lines = ['🔍 语义搜索结果：'];
  for (const r of results) {
    const contentStr = r.content.slice(0, 500);
    lines.push(`🔹 [${r.score}] ${contentStr}`);
    if (r.at) lines.push(`   📅 ${r.at}`);
  }
  const handlerOutput = lines.join('\n');
  console.log('\n=== STEP 2: tool-router handler output ===');
  console.log(JSON.stringify(handlerOutput.slice(0, 500)));

  // 3. 模拟 sanitizeDiscordReply 的调用
  const { sanitizeDiscordReply } = require('./main.js');
  // 直接调用 main.js 中暴露的函数
  // 但 main.js 可能没有 export sanitizeDiscordReply，用另一种方式
  console.log('\n=== STEP 3: 检查是否有外部修改 ===');
  console.log('（需要手动检查 Telegram 实际输出）');

  // 比较：content 里是否包含 Trae/UI/UX/SEO/shared_memory
  for (const r of results) {
    const checks = ['Trae', 'UI/UX', 'SEO', 'shared_memory', 'OpenClaw'];
    const missing = checks.filter(c => !r.content.includes(c));
    if (missing.length > 0) {
      console.log(`⛔ CONTENT 缺少: ${missing.join(', ')}`);
    } else {
      console.log(`✅ CONTENT 包含所有关键英文词`);
    }
  }

  await memory.close();
  console.log('\n=== DONE ===');
}

main().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
