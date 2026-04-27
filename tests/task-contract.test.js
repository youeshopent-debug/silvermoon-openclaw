const assert = require('assert');
const {
  classifyTaskKind,
  extractTaskNeed,
  applyTaskContractToReply,
} = require('../lib/task-contract');

function run() {
  assert.equal(classifyTaskKind('帮我修复 main.js 的晨报排版'), 'artifact');
  assert.equal(classifyTaskKind('解释一下为什么晨报排版会乱'), 'advisory');

  const need1 = extractTaskNeed('请把排版对齐成图2那种风格');
  assert.equal(need1.needSample, true);

  const r1 = applyTaskContractToReply({
    replyText: '我需要确认一下：你想要什么？',
    kind: 'artifact',
    need: need1,
    cooldownMap: {},
    nowMs: 1_000_000,
    cooldownMs: 30 * 60 * 1000,
  });
  assert.ok(/缺样板\/模板/.test(r1.text));
  assert.ok(r1.cooldownMap.sample);

  const r2 = applyTaskContractToReply({
    replyText: '可以再确认一次吗？',
    kind: 'artifact',
    need: need1,
    cooldownMap: r1.cooldownMap,
    nowMs: 1_000_100,
    cooldownMs: 30 * 60 * 1000,
  });
  assert.ok(/当前缺样板\/模板/.test(r2.text));

  const r2b = applyTaskContractToReply({
    replyText: '请提供更多细节或上下文信息，我才能继续处理。',
    kind: 'artifact',
    need: need1,
    cooldownMap: {},
    nowMs: 1_100_000,
    cooldownMs: 30 * 60 * 1000,
  });
  assert.ok(/缺样板\/模板/.test(r2b.text));

  const longAdvice =
    '建议用 A 方案：在出站清洗层加入任务契约门禁，限制每轮只问一个问题，并把最终结果固定成 3 条可确认条目。这样可以显著减少刷屏与空转，同时保证“可追溯、可复盘”。';
  const r3 = applyTaskContractToReply({
    replyText: longAdvice,
    kind: 'advisory',
    need: { needMaterial: false, needSample: false, needDeadline: false },
    cooldownMap: {},
    nowMs: 2_000_000,
    cooldownMs: 30 * 60 * 1000,
  });
  assert.ok(/✅ 验收清单/.test(r3.text));
}

run();

