// 模拟网关的语义搜索流程
const path = require('path');
const { MemoryStore } = require('../lib/memory');
const config = require('../lib/config');

async function main() {
  const memory = new MemoryStore({ dbPath: config.paths.memorySqlite });
  await memory.init();

  const query = '银月钱庄有哪些智能体';
  const result = await memory.searchSemantic(query, { limit: 5 });
  console.log('semantic_search results:', JSON.stringify(result, null, 2));
  
  if (result.ok && result.items.length > 0) {
    result.items.forEach((item, i) => {
      const formatted = `🔹 ${i + 1}. [${item.score}] ${item.content.slice(0, 500)}`;
      console.log('\nFORMATTED:', formatted);
      // Check for § character
      console.log('has §:', formatted.includes('§'));
      console.log('has UI/UX:', formatted.includes('UI/UX'));
      console.log('has Next.js:', formatted.includes('Next.js'));
      console.log('has Web3.0:', formatted.includes('Web3.0'));
      console.log('has shared_memory:', formatted.includes('shared_memory'));
    });
  } else {
    console.log('NO RESULTS');
  }
  
  process.exit(0);
}

main().catch(console.error);
