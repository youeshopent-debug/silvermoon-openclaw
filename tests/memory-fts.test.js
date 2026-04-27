const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const { createMemory } = require('../lib/memory');
  assert.equal(typeof createMemory, 'function');

  const dir = path.join(__dirname, '..', 'user_data', 'memory_test');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  const dbPath = path.join(dir, `mem_${Date.now()}_${Math.random().toString(16).slice(2)}.sqlite`);

  const mem = createMemory({ dbPath });
  const r0 = mem.init();
  assert.equal(r0.ok, true);

  mem.append({ uid: 'u1', at: new Date().toISOString(), channelId: 'c1', role: 'user', content: '你好，我想了解 RWA 方向。' });
  mem.append({ uid: 'u2', at: new Date().toISOString(), channelId: 'c1', role: 'assistant', content: 'RWA 可以从合规、托管、链上凭证开始。' });
  mem.append({ uid: 'u3', at: new Date().toISOString(), channelId: 'c2', role: 'user', content: '比特币 BTC 价格波动很大。' });
  mem.append({ uid: 'u_recent', at: new Date().toISOString(), channelId: 'c1', role: 'user', content: 'RWA RWA RWA（刚刚）' });

  const s1 = mem.search('RWA', { limit: 5 });
  assert.equal(Array.isArray(s1.items), true);
  assert.equal(s1.items.length >= 1, true);

  const s1b = mem.search('RWA', { limit: 10, minAgeMs: 60_000 });
  assert.equal(s1b.ok, true);
  assert.equal(s1b.items.some((x) => x.uid === 'u_recent'), false);

  const s2 = mem.search('BTC', { limit: 5 });
  assert.equal(s2.items.some((x) => x.uid === 'u3'), true);

  const jsonlPath = path.join(dir, `old_${Date.now()}.jsonl`);
  fs.writeFileSync(
    jsonlPath,
    [
      'OPENCLAW_LONG_TERM_MEMORY_DB',
      JSON.stringify({ id: 'm1', at: new Date().toISOString(), channelId: 'c9', role: 'user', content: 'gold price check' }),
      '',
    ].join('\n'),
    'utf-8'
  );
  const mig = mem.migrateFromJsonl(jsonlPath);
  assert.equal(mig.ok, true);
  const s3 = mem.search('gold', { limit: 5 });
  assert.equal(s3.items.some((x) => x.uid === 'm1'), true);

  const deep = mem.searchDeep('RWA', { limit: 6, minAgeMs: 60_000 });
  assert.equal(deep.ok, true);
  assert.equal(Array.isArray(deep.items), true);

  mem.close();
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
