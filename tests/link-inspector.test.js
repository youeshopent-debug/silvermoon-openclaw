const assert = require('assert');

const { extractUrls, parseHtmlMeta, stripHtmlToText } = require('../lib/link-inspector');

async function run() {
  {
    const s = '看看这个：https://example.com/a?b=c) 还有 https://example.com/x,';
    const urls = extractUrls(s);
    assert.deepEqual(urls, ['https://example.com/a?b=c', 'https://example.com/x']);
  }

  {
    const html = [
      '<html>',
      '<head>',
      '<title> Hello&nbsp;World </title>',
      '<meta name="description" content="Desc &amp; More">',
      '<meta property="og:title" content="OG T">',
      '<meta property="og:description" content="OG D">',
      '<link rel="canonical" href="https://site.test/canon">',
      '</head>',
      '<body>',
      '<script>var x = 1;</script>',
      '<h1>Title</h1>',
      '<p>A <b>bold</b> line.</p>',
      '</body>',
      '</html>',
    ].join('\n');
    const meta = parseHtmlMeta(html);
    assert.equal(meta.title, 'Hello World');
    assert.equal(meta.description, 'Desc & More');
    assert.equal(meta.ogTitle, 'OG T');
    assert.equal(meta.ogDescription, 'OG D');
    assert.equal(meta.canonical, 'https://site.test/canon');
    const text = stripHtmlToText(html, 999);
    assert.equal(/var x/.test(text), false);
    assert.equal(/Title/.test(text), true);
    assert.equal(/bold/.test(text), true);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
