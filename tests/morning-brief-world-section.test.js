const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const mainPath = path.join(__dirname, '..', 'main.js');
  const raw = fs.readFileSync(mainPath, 'utf-8');
  assert.equal(raw.includes('国际新闻（全球要闻）'), true);
  assert.equal(raw.includes('feeds.bbci.co.uk/zhongwen/simp/world/rss.xml'), true);
  assert.equal(raw.includes('/rss/headlines/section/topic/WORLD'), true);
  assert.equal(/gl=CN/.test(raw) || /ceid=CN:zh-Hans/.test(raw), true);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
