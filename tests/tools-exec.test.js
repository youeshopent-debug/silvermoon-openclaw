const assert = require('assert');

async function run() {
  const { executeTool } = require('../lib/tools');
  assert.equal(typeof executeTool, 'function');

  {
    const r = await executeTool({ name: 'tailErrors', args: { maxLines: 5 }, ctx: { baseDir: __dirname } });
    assert.equal(typeof r, 'object');
    assert.equal(typeof r.ok, 'boolean');
  }

  {
    const r = await executeTool({ name: 'proposeExec', args: { cmd: 'rm -rf /' }, ctx: { channelId: 'c1', requestedBy: 'u1' } });
    assert.equal(r.ok, true);
    assert.equal(r.needApproval, true);
    assert.equal(typeof r.plan.kind, 'string');
  }

  {
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss><channel>
<item><title>AI headlines</title><link>https://example.com/a</link></item>
<item><title>Model release</title><link>https://example.com/b</link></item>
</channel></rss>`;
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    });
    const r = await executeTool({
      name: 'webSearch',
      args: { query: 'ai 领域 最新资料' },
      ctx: { fetchImpl },
    });
    assert.equal(r.ok, true);
    assert.equal(Array.isArray(r.results), true);
    assert.equal(r.results.length >= 1, true);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
