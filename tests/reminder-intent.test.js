const assert = require('assert');
const { parseReminderIntent } = require('../lib/reminder-intent');

function run() {
  const base = new Date('2026-04-16T10:00:00.000Z');

  const r1 = parseReminderIntent('30分钟后提醒我发邮件给客户', base);
  assert.equal(r1.ok, true);
  assert.equal(r1.message, '发邮件给客户');

  const r2 = parseReminderIntent('2小时后提醒我检查店铺库存', base);
  assert.equal(r2.ok, true);
  assert.equal(r2.message, '检查店铺库存');

  const r3 = parseReminderIntent('今天 23:10 提醒我提交日报', base);
  assert.equal(r3.ok, true);
  assert.equal(r3.message, '提交日报');

  const r5 = parseReminderIntent('明天 23:10 提醒我提交日报', base);
  assert.equal(r5.ok, true);
  assert.equal(r5.message, '提交日报');

  const r6 = parseReminderIntent('后天 23:10 提醒我提交日报', base);
  assert.equal(r6.ok, true);
  assert.equal(r6.message, '提交日报');

  const r7 = parseReminderIntent('每天 23:10 提醒我提交日报', base);
  assert.equal(r7.ok, true);
  assert.equal(r7.message, '提交日报');
  assert.equal(r7.repeat, 'daily');

  const r4 = parseReminderIntent('提醒我交房租', base);
  assert.equal(r4.ok, false);
  assert.equal(r4.needTime, true);
}

run();

