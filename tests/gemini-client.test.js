const assert = require('assert');

async function run() {
  const { parseGeminiTextFromResponse, buildGeminiRequestBody } = require('../lib/gemini-client');
  assert.equal(typeof parseGeminiTextFromResponse, 'function');
  assert.equal(typeof buildGeminiRequestBody, 'function');

  {
    const body = buildGeminiRequestBody({
      system: 'sys',
      user: 'hi',
    });
    assert.equal(typeof body, 'object');
    assert.equal(Array.isArray(body.contents), true);
  }

  {
    const text = parseGeminiTextFromResponse({
      candidates: [
        {
          content: {
            parts: [{ text: 'OK' }],
          },
        },
      ],
    });
    assert.equal(text, 'OK');
  }

  {
    const text = parseGeminiTextFromResponse({});
    assert.equal(text, '');
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

