const assert = require('assert');

const { createShadowWatchdog } = require('../lib/shadow-watchdog');

async function run() {
  {
    const calls = { writeCache: 0, forceRepost: 0 };
    const wd = createShadowWatchdog({
      cronDir: 'C:\\mock\\CRON',
      getTzNow: () => new Date('2026-04-19T00:00:00Z'),
      formatYmd: () => '20260419',
      getEnv: () => ({ TAVILY_API_KEY: 'k', DROPBOX_TOKEN: 'd' }),
      listDir: async () => ['20260419_早报.md', '20260419_早报.sent'],
      exists: async () => true,
      readJson: async () => ({ fx: 4.7 }),
      writeJson: async () => { calls.writeCache++; },
      fetchUsdMyrApi: async () => 4.7,
      fetchUsdMyrTavily: async () => 4.70001,
      forceRepost: async () => { calls.forceRepost++; return true; },
    });
    const r = await wd.runOnce();
    assert.equal(r.severity, 'ok');
    assert.equal(Boolean(r.shouldNotifyDiscord), false);
    assert.equal(calls.forceRepost, 0);
  }

  {
    const calls = { writeCache: 0 };
    const wd = createShadowWatchdog({
      cronDir: 'C:\\mock\\CRON',
      getTzNow: () => new Date('2026-04-19T00:00:00Z'),
      formatYmd: () => '20260419',
      getEnv: () => ({ TAVILY_API_KEY: '', DROPBOX_TOKEN: 'd' }),
      listDir: async () => [],
      exists: async () => false,
      readJson: async () => ({}),
      writeJson: async () => { calls.writeCache++; },
      fetchUsdMyrApi: async () => 4.7,
      fetchUsdMyrTavily: async () => null,
      forceRepost: async () => true,
    });
    const r = await wd.runOnce();
    assert.equal(r.severity, 'red');
    assert.equal(Boolean(r.shouldNotifyDiscord), true);
    assert.equal(/TAVILY_API_KEY/i.test(r.summary), true);
    assert.equal(calls.writeCache, 0);
  }

  {
    const calls = { forceRepost: 0 };
    const wd = createShadowWatchdog({
      cronDir: 'C:\\mock\\CRON',
      getTzNow: () => new Date('2026-04-19T00:00:00Z'),
      formatYmd: () => '20260419',
      getEnv: () => ({ TAVILY_API_KEY: 'k', DROPBOX_TOKEN: 'd' }),
      listDir: async () => ['20260419_早报.md'],
      exists: async (p) => /_早报\.md$/.test(p),
      readJson: async () => ({}),
      writeJson: async () => {},
      fetchUsdMyrApi: async () => 4.7,
      fetchUsdMyrTavily: async () => 4.9,
      forceRepost: async () => { calls.forceRepost++; return false; },
    });
    const r = await wd.runOnce();
    assert.equal(r.severity, 'red');
    assert.equal(Boolean(r.shouldNotifyDiscord), true);
    assert.equal(calls.forceRepost, 1);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
