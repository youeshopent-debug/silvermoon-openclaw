const assert = require('assert');

async function run() {
  const { createEvidenceDeduper } = require('../lib/evidence-dedupe');
  const d = createEvidenceDeduper({ size: 3 });

  const cid = 'c1';
  const e1 = '🔹 联网证据：\n🔹 Title A｜https://news.google.com/x?a=1';
  assert.equal(d.isDuplicate(cid, e1), false);
  const r1 = d.record(cid, e1);
  assert.equal(r1.ok, true);
  assert.equal(typeof r1.hash, 'string');
  assert.equal(d.isDuplicate(cid, e1), true);

  const e1b = '🔹 联网证据：\n🔹 Title A｜https://news.google.com/x?a=2';
  assert.equal(d.isDuplicate(cid, e1b), true);

  const e2 = '🔹 联网证据：\n🔹 Title B｜https://example.com/b';
  d.record(cid, e2);
  const e3 = '🔹 联网证据：\n🔹 Title C｜https://example.com/c';
  d.record(cid, e3);
  const e4 = '🔹 联网证据：\n🔹 Title D｜https://example.com/d';
  d.record(cid, e4);

  assert.equal(d.isDuplicate(cid, e1), false);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

