const assert = require('assert');

async function run() {
  const { routeWithLLM } = require('../lib/brain-router');
  assert.equal(typeof routeWithLLM, 'function');

  {
    const askFast = async () => '{"mode":"chat","brain":"groq","needsTools":false}';
    const r = await routeWithLLM({ askFast, text: '你在吗', memoryHint: '无', channelId: 'c1' });
    assert.equal(r.mode, 'chat');
    assert.equal(r.brain, 'groq');
    assert.equal(r.needsTools, false);
  }

  {
    const askFast = async () => '好的\n{"mode":"work","brain":"gemini","needsTools":true}\n谢谢';
    const r = await routeWithLLM({ askFast, text: '帮我查最新资料', memoryHint: '', channelId: 'c2' });
    assert.equal(r.mode, 'work');
    assert.equal(r.brain, 'gemini');
    assert.equal(r.needsTools, true);
  }

  {
    const askFast = async () => 'not json';
    const r = await routeWithLLM({ askFast, text: 'hello', memoryHint: '', channelId: 'c3' });
    assert.equal(r.mode, 'chat');
    assert.equal(r.brain, 'groq');
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

