const assert = require('assert');
const http = require('http');

const { fetchWithTimeout, parseRssAnyItems, buildMorningBriefFields, buildMorningBriefEmbeds } = require('../lib/morning-brief-utils');

async function withServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function run() {
  {
    const srv = await withServer((req, res) => {
      if (req.url === '/slow') {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        }, 250);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('fast');
    });
    try {
      const fast = await fetchWithTimeout(`${srv.baseUrl}/fast`, { timeoutMs: 200 });
      assert.equal(fast.status, 200);
      const fastText = await fast.text();
      assert.equal(fastText, 'fast');

      let timedOut = false;
      try {
        await fetchWithTimeout(`${srv.baseUrl}/slow`, { timeoutMs: 40 });
      } catch (e) {
        timedOut = /timeout/i.test(String(e?.message || e));
      }
      assert.equal(timedOut, true);
    } finally {
      await srv.close();
    }
  }

  {
    const rss = `
      <rss><channel>
        <item><title><![CDATA[Hello World - BBC]]></title><link>https://example.com/a</link></item>
        <item><title>Second</title><link>https://example.com/b</link></item>
      </channel></rss>
    `;
    const items = parseRssAnyItems(rss, 10);
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'Hello World - BBC');
    assert.equal(items[0].link, 'https://example.com/a');
  }

  {
    const atom = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom One</title>
          <link href="https://example.com/x"/>
        </entry>
      </feed>
    `;
    const items = parseRssAnyItems(atom, 10);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, 'Atom One');
    assert.equal(items[0].link, 'https://example.com/x');
  }

  {
    const fields = buildMorningBriefFields({
      weatherLines: ['🌡️ 气温：31.0℃ / 湿度：70%'],
      fxLines: ['💱 美元/马币 4.7000'],
      newsLines: ['🗞️ 本地：示例一', '🤖 科技：示例二'],
    });
    assert.equal(fields.length, 3);
    for (const f of fields) {
      assert.equal(f.inline, false);
      assert.equal(/\n\n$/.test(String(f.value || '')), true);
    }
  }

  {
    const embeds = buildMorningBriefEmbeds({
      generatedAtText: '2026-04-19 08:00',
      fileName: '2026-04-19_早报.md',
      weatherLines: ['🌡️ 气温：31.0℃ / 湿度：70%', '⚠️ 警示：暂无'],
      fxLines: ['🥇 国际黄金：$3200.00', '💱 美元/马币 4.7000'],
      newsCards: [
        { icon: '🗞️', name: '本地', headline: '示例一', impact: '对本地现金流压力偏中性' },
        { icon: '🤖', name: '科技', headline: '示例二', impact: '对效率与成本结构有正向影响' },
      ],
    });
    assert.equal(Array.isArray(embeds), true);
    assert.equal(embeds.length >= 4, true);
    for (const e of embeds) {
      assert.equal(/\n\n$/.test(String(e.description || '')), true);
    }
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
