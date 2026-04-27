const assert = require('assert');

const { guardOutgoingText, guardOutgoingPayload } = require('../lib/anti-hallucination-guard');

async function run() {
  {
    const g = guardOutgoingText('✅ 主人\n详见 DROPBOX 链接：https://www.dropbox.com/s/xxxxxxxx/早报.pdf', {
      resolveEvidence: () => null,
      formatEvidence: () => '',
    });
    assert.equal(g.blocked, true);
    assert.equal(/^🚨\s*主人/.test(String(g.text || '')), true);
  }

  {
    const g = guardOutgoingText('✅ 主人\n已上传\nDROPBOX路径: DROPBOX/银月/a.txt', {
      resolveEvidence: () => ({ absPath: 'C:\\mock\\DROPBOX\\银月\\a.txt', size: 2048, baseName: 'a.txt' }),
      formatEvidence: () => 'DROPBOX/银月/a.txt',
    });
    assert.equal(g.blocked, true);
    assert.equal(/已核验本地文件存在：DROPBOX\/银月\/a\.txt/.test(String(g.text || '')), true);
    assert.equal(/dropbox\.com/i.test(String(g.text || '')), false);
    assert.equal(/x{6,}/i.test(String(g.text || '')), false);
  }

  {
    const g = guardOutgoingPayload(
      { content: '✅ 主人\nOK', embeds: [{ title: '交付', description: '详见 dropbox.com/s/xxxxxxxx' }] },
      { resolveEvidence: () => null, formatEvidence: () => '' }
    );
    assert.equal(g.blocked, true);
    assert.equal(/^🚨\s*主人/.test(String(g.payload?.content || '')), true);
    assert.equal(Boolean(g.payload?.embeds), false);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

