const assert = require('assert');

async function run() {
  const { buildSilvermoonSystemPrompt, buildWorkCard } = require('../lib/persona-silvermoon');
  assert.equal(typeof buildSilvermoonSystemPrompt, 'function');
  assert.equal(typeof buildWorkCard, 'function');

  {
    const s = buildSilvermoonSystemPrompt({ mode: 'chat' });
    assert.equal(typeof s, 'string');
    assert.equal(/禁止.*Markdown.*表格/.test(s), true);
    assert.equal(/必须.*中文/.test(s), true);
  }

  {
    const s = buildSilvermoonSystemPrompt({ mode: 'work' });
    assert.equal(/单列|垂直|卡片/.test(s), true);
    assert.equal(/不得.*表格/.test(s), true);
  }

  {
    const out = buildWorkCard({ title: '排障进展', bullets: ['现象: A', '原因: B', '动作: C'] });
    assert.equal(typeof out, 'string');
    assert.equal(out.includes('排障进展'), true);
    assert.equal(out.includes('🔹'), true);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

