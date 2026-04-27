const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function run() {
  const p = path.join(__dirname, '..', 'main.js');
  const s = fs.readFileSync(p, 'utf-8');
  assert.equal(s.includes("require('./lib/discord-send-fallback')"), true);
  assert.equal(/sendDiscordWithFallback\s*\(/.test(s), true);
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

