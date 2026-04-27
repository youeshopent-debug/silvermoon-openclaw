const assert = require('assert');

const { isModelDownNoticeText, toCompactModelDownReply } = require('../lib/model-down-guard');

async function run() {
  {
    const s = '⚠️ 主人\n🔹 本地 Ollama 无法连接（127.0.0.1:11434）\n🔹 请确认 Ollama 正在运行且端口可用\n🔹 fetch failed';
    assert.equal(isModelDownNoticeText(s), true);
  }

  {
    const s = '⚠️ 主人\n🔹 Groq 通道异常，已自动回退本地模型\n🔹 HTTP 401';
    assert.equal(isModelDownNoticeText(s), true);
  }

  {
    const s = '✅ 主人\n🔹 我在线';
    assert.equal(isModelDownNoticeText(s), false);
  }

  {
    const r = toCompactModelDownReply('⚠️ 主人\n🔹 本地 Ollama 无法连接（127.0.0.1:11434）');
    assert.equal(typeof r, 'string');
    assert.equal(r.includes('127.0.0.1:11434'), false);
    assert.equal(r.includes('Ollama'), false);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

