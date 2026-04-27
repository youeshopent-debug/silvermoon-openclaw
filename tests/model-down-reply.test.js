const assert = require('assert');

async function run() {
  const { renderModelDownReply } = require('../lib/model-down-reply');
  assert.equal(typeof renderModelDownReply, 'function');

  {
    const raw = '⚠️ 主人\n🔹 本地 Ollama 无法连接（127.0.0.1:11434）\n🔹 fetch failed';
    const out = renderModelDownReply({ raw, isPing: true });
    assert.equal(typeof out, 'string');
    assert.equal(out.includes('127.0.0.1:11434'), false);
    assert.equal(out.includes('规则模式'), false);
  }

  {
    const raw = '⚠️ 主人\n🔹 Groq 通道异常，已自动回退本地模型\n🔹 HTTP 401';
    const out = renderModelDownReply({ raw, isPing: false, userText: '帮我查 ai 领域 最新资料' });
    assert.equal(typeof out, 'string');
    assert.equal(out.length > 0, true);
    assert.equal(out.includes('127.0.0.1:11434'), false);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

