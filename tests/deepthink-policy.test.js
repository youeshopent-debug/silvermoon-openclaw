const assert = require('assert');

const { parseInterventionPrefix, isDeepThinkTriggerText, resolveDeepThinkStatus } = require('../lib/deepthink-policy');

async function run() {
  {
    const r = parseInterventionPrefix('[强制深思] 你好');
    assert.equal(r.mode, 'force_on');
    assert.equal(r.text, '你好');
  }
  {
    const r = parseInterventionPrefix('   [极速执行]报告 https://a.test');
    assert.equal(r.mode, 'force_off');
    assert.equal(r.text, '报告 https://a.test');
  }
  {
    assert.equal(isDeepThinkTriggerText('我要报告'), true);
    assert.equal(isDeepThinkTriggerText('随便聊聊'), false);
  }
  {
    const s1 = resolveDeepThinkStatus('[强制深思] 随便聊聊');
    assert.equal(s1.enabled, true);
    assert.equal(s1.status, '开-最高权限强制开启');
  }
  {
    const s2 = resolveDeepThinkStatus('[极速执行] 报告');
    assert.equal(s2.enabled, false);
    assert.equal(s2.status, '关-最高权限极速跳过');
  }
  {
    const s3 = resolveDeepThinkStatus('报告');
    assert.equal(s3.enabled, true);
    assert.equal(s3.status, '自动-命中触发词');
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });

