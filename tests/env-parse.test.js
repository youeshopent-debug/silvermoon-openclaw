const assert = require('assert');

async function run() {
  const { parseEnvText } = require('../lib/env-parse');
  assert.equal(typeof parseEnvText, 'function');

  {
    const raw = [
      '# comment',
      '- GROQ_API_KEY=gsk_test_123',
      '• GEMINI_API_KEY=AIza_test_456',
      'export TAVILY_API_KEY=tav_test_789',
      ' OPENCLAW_PROXY_URL = http://127.0.0.1:7890 ',
      '',
    ].join('\n');
    const env = parseEnvText(raw);
    assert.equal(env.GROQ_API_KEY, 'gsk_test_123');
    assert.equal(env.GEMINI_API_KEY, 'AIza_test_456');
    assert.equal(env.TAVILY_API_KEY, 'tav_test_789');
    assert.equal(env.OPENCLAW_PROXY_URL, 'http://127.0.0.1:7890');
  }

  {
    const raw = '- BAD LINE WITHOUT EQUALS';
    const env = parseEnvText(raw);
    assert.equal(Object.keys(env).length, 0);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

