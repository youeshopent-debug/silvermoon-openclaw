const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const p = path.join(__dirname, '..', 'main.js');
  const s = fs.readFileSync(p, 'utf-8');

  assert.equal(s.includes("process.env.NODE_ENV !== 'production'"), false);
  assert.equal(s.includes('STATE.routing.forceLocal = true'), false);
  assert.equal(s.includes("process.env.USE_PROXY = '0'"), false);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
