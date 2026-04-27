function cleanMessage(s) {
  return String(s || '')
    .replace(/^\s*(提醒我|记得|帮我记得)\s*/i, '')
    .trim();
}

function tzOffsetMs(tzOffsetMin) {
  const m = Number(tzOffsetMin || 0);
  if (!Number.isFinite(m)) return 0;
  return m * 60 * 1000;
}

function toTz(baseUtc, tzOffsetMin) {
  return new Date(new Date(baseUtc).getTime() + tzOffsetMs(tzOffsetMin));
}

function fromTz(tzDate, tzOffsetMin) {
  return new Date(new Date(tzDate).getTime() - tzOffsetMs(tzOffsetMin));
}

function toDateLike(baseUtc, tzOffsetMin, y, m, d, hh, mm) {
  const tzBase = toTz(baseUtc, tzOffsetMin);
  const tz = new Date(tzBase);
  tz.setUTCFullYear(y, m - 1, d);
  tz.setUTCHours(hh, mm, 0, 0);
  return fromTz(tz, tzOffsetMin);
}

function parseReminderIntent(text, now, tzOffsetMin) {
  const s = String(text || '').trim();
  const baseUtc = now instanceof Date ? new Date(now) : new Date();
  const tzNow = toTz(baseUtc, tzOffsetMin);
  if (!s) return { ok: false, needTime: true };

  let m = s.match(/^每天\s*(\d{1,2}):(\d{2})\s*(?:提醒我)?\s*(.+)$/);
  if (m) {
    const hh = Number(m[1]); const mm = Number(m[2]);
    const message = cleanMessage(m[3]);
    if (!message) return { ok: false, needTime: true };
    const tzWhen = new Date(tzNow);
    tzWhen.setUTCSeconds(0, 0);
    tzWhen.setUTCHours(hh, mm, 0, 0);
    if (tzWhen.getTime() <= tzNow.getTime()) tzWhen.setUTCDate(tzWhen.getUTCDate() + 1);
    return { ok: true, whenAt: fromTz(tzWhen, tzOffsetMin), message, repeat: 'daily' };
  }

  m = s.match(/(\d+)\s*分钟后(?:提醒我)?\s*(.+)$/);
  if (m) {
    const mins = Math.max(1, Number(m[1] || 0));
    const message = cleanMessage(m[2]);
    if (!message) return { ok: false, needTime: true };
    return { ok: true, whenAt: new Date(baseUtc.getTime() + mins * 60 * 1000), message };
  }

  m = s.match(/(\d+)\s*小时后(?:提醒我)?\s*(.+)$/);
  if (m) {
    const hrs = Math.max(1, Number(m[1] || 0));
    const message = cleanMessage(m[2]);
    if (!message) return { ok: false, needTime: true };
    return { ok: true, whenAt: new Date(baseUtc.getTime() + hrs * 60 * 60 * 1000), message };
  }

  m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})\s*(?:提醒我)?\s*(.+)$/);
  if (m) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    const hh = Number(m[4]); const mm = Number(m[5]);
    const message = cleanMessage(m[6]);
    if (!message) return { ok: false, needTime: true };
    return { ok: true, whenAt: toDateLike(baseUtc, tzOffsetMin, y, mo, d, hh, mm), message };
  }

  m = s.match(/(今天|明天)?\s*(\d{1,2}):(\d{2})\s*(?:提醒我)?\s*(.+)$/);
  if (m) {
    const day = String(m[1] || '今天');
    const hh = Number(m[2]); const mm = Number(m[3]);
    const message = cleanMessage(m[4]);
    if (!message) return { ok: false, needTime: true };
    const tzWhen = new Date(tzNow);
    tzWhen.setUTCSeconds(0, 0);
    tzWhen.setUTCHours(hh, mm, 0, 0);
    if (day === '明天') tzWhen.setUTCDate(tzWhen.getUTCDate() + 1);
    if (day === '后天') tzWhen.setUTCDate(tzWhen.getUTCDate() + 2);
    if (day !== '明天' && day !== '后天' && tzWhen.getTime() <= tzNow.getTime()) tzWhen.setUTCDate(tzWhen.getUTCDate() + 1);
    return { ok: true, whenAt: fromTz(tzWhen, tzOffsetMin), message };
  }

  if (/(提醒我|记得|帮我记得)/.test(s)) return { ok: false, needTime: true };
  return { ok: false, needTime: false };
}

module.exports = { parseReminderIntent };

