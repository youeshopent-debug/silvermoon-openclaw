const assert = require('assert');

const { splitTextToChunks } = require('../lib/text-chunk');

async function run() {
  {
    const chunks = splitTextToChunks('a\nb\nc', 3);
    assert.deepEqual(chunks, ['a\nb', 'c']);
  }

  {
    const s = '12345\n67890\nabcde\nfghij';
    const chunks = splitTextToChunks(s, 10);
    for (const c of chunks) assert.equal(c.length <= 10, true);
    assert.equal(chunks.join('\n'), s);
  }

  {
    const chunks = splitTextToChunks('x'.repeat(25), 10);
    assert.deepEqual(chunks, ['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
  }

  {
    const chunks = splitTextToChunks('\n\n a \n\n', 10);
    assert.deepEqual(chunks, ['a']);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
