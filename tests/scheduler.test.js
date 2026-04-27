const test = require('node:test');
const assert = require('node:assert/strict');

const { computeNextRunSimple } = require('../lib/scheduler');

test('computeNextRunSimple: fixed hour', () => {
  const d = computeNextRunSimple('0 8 * * *', 0);
  assert.ok(d instanceof Date);
});

test('computeNextRunSimple: step hours', () => {
  const d = computeNextRunSimple('0 */4 * * *', 0);
  assert.ok(d instanceof Date);
});

