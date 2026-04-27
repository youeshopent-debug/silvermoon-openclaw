function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function safeParseDateMs(s) {
  if (typeof s !== 'string' || !s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return ms;
}

async function getFxSnapshotForBinding({
  briefCachePath,
  maxAgeMs,
  now,
  readJson,
  writeJson,
  refreshUsdMyr,
}) {
  const nowDate = now instanceof Date ? now : new Date();
  const nowMs = nowDate.getTime();

  let cached = null;
  try {
    cached = readJson(briefCachePath);
  } catch (_) {
    cached = null;
  }

  if (cached && isFiniteNumber(cached.fx) && cached.fx > 0) {
    const updatedMs = safeParseDateMs(cached.fxUpdatedAt);
    if (updatedMs !== null && typeof maxAgeMs === 'number' && maxAgeMs >= 0) {
      if (nowMs - updatedMs <= maxAgeMs && typeof cached.fxSource === 'string' && cached.fxSource) {
        return {
          ok: true,
          fx: cached.fx,
          fxSource: cached.fxSource,
          fxUpdatedAt: cached.fxUpdatedAt,
          fxAsOf: cached.fxAsOf,
          boundAt: nowDate.toISOString(),
          usedFallbackRefresh: false,
        };
      }
    }
  }

  try {
    const fresh = await refreshUsdMyr();
    if (!fresh || !isFiniteNumber(fresh.fx) || fresh.fx <= 0 || typeof fresh.fxSource !== 'string' || !fresh.fxSource) {
      throw new Error('bad_fx_payload');
    }

    const nextCache = {
      fx: fresh.fx,
      fxSource: fresh.fxSource,
      fxAsOf: fresh.fxAsOf,
      fxUpdatedAt: nowDate.toISOString(),
    };

    writeJson(briefCachePath, nextCache);

    return {
      ok: true,
      fx: nextCache.fx,
      fxSource: nextCache.fxSource,
      fxUpdatedAt: nextCache.fxUpdatedAt,
      fxAsOf: nextCache.fxAsOf,
      boundAt: nextCache.fxUpdatedAt,
      usedFallbackRefresh: true,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'fx_unavailable',
      boundAt: nowDate.toISOString(),
      error: e && e.message ? String(e.message) : 'unknown',
    };
  }
}

function openLedgerDb({ dbPath }) {
  const { DatabaseSync } = require('node:sqlite');
  const p = typeof dbPath === 'string' && dbPath ? dbPath : ':memory:';
  return new DatabaseSync(p);
}

function ensureLedgerSchema(db) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      eventId TEXT NOT NULL,
      amountUsdCents INTEGER NOT NULL,
      fxUsdMyr REAL NOT NULL,
      fxSource TEXT NOT NULL,
      fxUpdatedAt TEXT NOT NULL,
      boundAt TEXT NOT NULL,
      amountMyrCents INTEGER NOT NULL,
      rawHash TEXT,
      createdAt TEXT NOT NULL,
      UNIQUE(provider, eventId)
    );
  `);
}

function recordPayment({
  db,
  provider,
  eventId,
  amountUsdCents,
  fxSnapshot,
  now,
  rawHash,
}) {
  if (!fxSnapshot || fxSnapshot.ok !== true) {
    throw new Error('fx_unavailable');
  }
  if (typeof provider !== 'string' || !provider) {
    throw new Error('bad_provider');
  }
  if (typeof eventId !== 'string' || !eventId) {
    throw new Error('bad_eventId');
  }
  if (!Number.isInteger(amountUsdCents) || amountUsdCents < 0) {
    throw new Error('bad_amountUsdCents');
  }

  const nowDate = now instanceof Date ? now : new Date();
  const fx = fxSnapshot.fx;
  const amountMyrCents = Math.round(amountUsdCents * fx);

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO payments (
      provider, eventId, amountUsdCents,
      fxUsdMyr, fxSource, fxUpdatedAt, boundAt,
      amountMyrCents, rawHash, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const r = stmt.run(
    provider,
    eventId,
    amountUsdCents,
    fx,
    fxSnapshot.fxSource,
    fxSnapshot.fxUpdatedAt,
    fxSnapshot.boundAt,
    amountMyrCents,
    rawHash || null,
    nowDate.toISOString()
  );

  return {
    inserted: r.changes === 1,
    lastInsertRowid: r.lastInsertRowid,
  };
}

function getPaymentByEvent(db, { provider, eventId }) {
  const stmt = db.prepare(
    'SELECT provider, eventId, amountUsdCents, fxUsdMyr, fxSource, fxUpdatedAt, boundAt, amountMyrCents, rawHash, createdAt FROM payments WHERE provider=? AND eventId=?'
  );
  return stmt.get(provider, eventId);
}

module.exports = {
  getFxSnapshotForBinding,
  openLedgerDb,
  ensureLedgerSchema,
  recordPayment,
  getPaymentByEvent,
};
