const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const p = path.join(__dirname, '..', 'main.js');
  const s = fs.readFileSync(p, 'utf-8');
  assert.equal(s.includes("require('./lib/persona-silvermoon')"), true);
  assert.equal(s.includes("require('./lib/brain-router')"), true);
  assert.equal(s.includes("require('./lib/tools')"), true);
  assert.equal(s.includes('askSilvermoonAutonomyD'), true);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

