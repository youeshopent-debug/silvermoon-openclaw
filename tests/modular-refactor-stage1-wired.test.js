const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const p = path.join(__dirname, '..', 'main.js');
  const s = fs.readFileSync(p, 'utf-8');
  assert.equal(s.includes("require('./lib/intent')"), true);
  assert.equal(s.includes("require('./lib/memory')"), true);
  assert.equal(s.includes("require('./lib/silvermoon-postprocess')"), true);
  assert.equal(/tryIntentIntercept\s*\(/.test(s), true);
  assert.equal(/createMemory\s*\(/.test(s), true);
  assert.equal(/memory\.init\s*\(/.test(s) || /MEMORY.*\.init\s*\(/.test(s), true);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
