const assert = require('assert');
const { selectRecentPendingReminder, selectPendingReminderByIdPrefix } = require('../lib/reminder-store');

function run() {
  const now = Date.parse('2026-04-16T10:00:00.000Z');
  const items = [
    { id: 'aaa111', channelId: 'c1', userId: 'u1', message: 'x', createdAt: '2026-04-16T09:58:00.000Z', done: false },
    { id: 'bbb222', channelId: 'c1', userId: 'u1', message: 'y', createdAt: '2026-04-16T09:59:30.000Z', done: false },
    { id: 'ccc333', channelId: 'c1', userId: 'u2', message: 'z', createdAt: '2026-04-16T09:59:40.000Z', done: false },
    { id: 'ddd444', channelId: 'c2', userId: 'u1', message: 'w', createdAt: '2026-04-16T09:59:50.000Z', done: false },
  ];

  const recent = selectRecentPendingReminder(items, { channelId: 'c1', userId: 'u1', nowMs: now, withinMs: 5 * 60 * 1000 });
  assert.equal(recent.id, 'bbb222');

  const byPrefix = selectPendingReminderByIdPrefix(items, { channelId: 'c1', userId: 'u1', prefix: 'aaa' });
  assert.equal(byPrefix.id, 'aaa111');

  const none = selectRecentPendingReminder(items, { channelId: 'c1', userId: 'u1', nowMs: now, withinMs: 10 * 1000 });
  assert.equal(none, null);
}

run();

