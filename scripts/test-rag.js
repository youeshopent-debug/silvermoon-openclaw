const path = require('path');
const { MemoryStore } = require(path.join(__dirname, '..', 'lib', 'memory'));
const mem = new MemoryStore({ dbPath: path.join(__dirname, '..', 'user_data', 'memory', 'silvermoon_memory.sqlite') });
mem.init();

(async () => {
  // 模拟 handleMessageCreate 第4层中的代码
  const query = '银月钱庄有哪些智能体';
  const results = await mem.searchSemantic(query, { limit: 5 });

  console.log('searchSemantic raw:', JSON.stringify({ ok: results?.ok, count: results?.items?.length, error: results?.error || results?.reason || '(none)' }));
  if (!results?.ok || !results.items?.length) {
    // 打印所有 mem_vec 的 uid
    const db = require('better-sqlite3')(path.join(__dirname, '..', 'user_data', 'memory', 'silvermoon_memory.sqlite'));
    const allVecs = db.prepare("SELECT uid FROM mem_vec").all();
    console.log('mem_vec uids:', allVecs.map(r => r.uid));
    db.close();
    mem.close();
    return;
  }

  console.log(`\n=== 搜索结果 (${results.items.length}条) ===\n`);
  for (const item of results.items) {
    console.log(`[${item.score}] uid=${item.uid}`);
    console.log(`  FULL CONTENT: ${JSON.stringify(item.content)}`);
    console.log(`  SLICE(0,120): ${JSON.stringify(item.content.slice(0, 120))}`);
    console.log('');
  }

  // 模拟 tool-router handler 构建的响应
  const header = '✅ 主人，银月通过语义搜索找到以下与「智能体」相关的内容：';
  const lines = [header, ''];
  results.items.forEach((r, i) => {
    lines.push(`🔹 ${i + 1}. ${r.score} ${r.content.slice(0, 500)}`);
    if (r.at) lines.push(`   📅 ${r.at}`);
  });
  const finalReply = lines.join('\n');
  console.log('=== 最终发送内容 ===');
  console.log(finalReply);

  mem.close();
})().catch(e => { console.error(e); mem.close(); });
