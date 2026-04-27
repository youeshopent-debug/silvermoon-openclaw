function selectRecentPendingReminder(items, opts) {
  const list = Array.isArray(items) ? items : [];
  const channelId = String(opts?.channelId || '').trim();
  const userId = String(opts?.userId || '').trim();
  const nowMs = Number.isFinite(opts?.nowMs) ? Number(opts.nowMs) : Date.now();
  const withinMs = Number.isFinite(opts?.withinMs) ? Number(opts.withinMs) : 5 * 60 * 1000;
  if (!channelId) return null;
  const cutoff = nowMs - withinMs;

  let best = null;
  for (const it of list) {
    if (!it || it.done) continue;
    if (String(it.channelId || '').trim() !== channelId) continue;
    if (userId && String(it.userId || '').trim() !== userId) continue;
    const createdAt = Date.parse(String(it.createdAt || ''));
    if (!Number.isFinite(createdAt) || createdAt < cutoff) continue;
    if (!best || createdAt > Date.parse(String(best.createdAt || ''))) best = it;
  }
  return best;
}

function selectPendingReminderByIdPrefix(items, opts) {
  const list = Array.isArray(items) ? items : [];
  const channelId = String(opts?.channelId || '').trim();
  const userId = String(opts?.userId || '').trim();
  const prefix = String(opts?.prefix || '').trim().toLowerCase();
  if (!prefix) return null;

  for (const it of list) {
    if (!it || it.done) continue;
    if (channelId && String(it.channelId || '').trim() !== channelId) continue;
    if (userId && String(it.userId || '').trim() !== userId) continue;
    const id = String(it.id || '').trim().toLowerCase();
    if (id && id.startsWith(prefix)) return it;
  }
  return null;
}

module.exports = {
  selectRecentPendingReminder,
  selectPendingReminderByIdPrefix,
};

