const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');

test('search quota: blocks by pool and resets by KL dateKey (UTC+8)', async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'openclaw-quota-'));
  const quotaPath = path.join(tmpDir, 'search_quota.json');
  const { createQuotaStore } = require('../lib/search-quota');
  const store = createQuotaStore({ quotaPath });

  const day1 = new Date('2026-04-19T00:10:00+08:00');
  const day2 = new Date('2026-04-20T00:10:00+08:00');

  for (let i = 0; i < 10; i += 1) {
    const r = await store.tryConsume('manual', day1);
    assert.equal(r.ok, true);
  }
  {
    const r = await store.tryConsume('manual', day1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'pool_exhausted');
  }
  for (let i = 0; i < 14; i += 1) {
    const r = await store.tryConsume('brief', day1);
    assert.equal(r.ok, true);
  }
  {
    const r = await store.tryConsume('brief', day1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'pool_exhausted');
  }
  for (let i = 0; i < 16; i += 1) {
    const r = await store.tryConsume('deep', day1);
    assert.equal(r.ok, true);
  }
  {
    const r = await store.tryConsume('deep', day1);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'pool_exhausted');
    assert.equal(r.status.total.used, 40);
  }

  {
    const s = await store.getQuotaStatus(day2);
    assert.equal(s.dateKey, '2026-04-20');
    assert.equal(s.total.used, 0);
    assert.equal(s.pools.brief.used, 0);
    assert.equal(s.pools.manual.used, 0);
    assert.equal(s.pools.deep.used, 0);
  }
});
