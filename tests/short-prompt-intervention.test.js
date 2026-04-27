const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const p = path.join(__dirname, '..', 'main.js');
  const s = fs.readFileSync(p, 'utf-8');
  assert.equal(s.includes('Detect repetitive info. Forcing deep exploration for new evidence'), true);
  assert.equal(s.includes('shouldShortPromptIntervene'), true);
  assert.equal(s.includes('forceDeepExploreForNewEvidence'), true);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

