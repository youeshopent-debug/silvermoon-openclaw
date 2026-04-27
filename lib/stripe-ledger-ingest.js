const { extractStripeUsdCents } = require('./stripe-event');
const {
  getFxSnapshotForBinding,
  openLedgerDb,
  ensureLedgerSchema,
  recordPayment,
} = require('./usd-myr-ledger');

async function ingestStripeEventToLedger({
  event,
  dbPath,
  briefCachePath,
  maxAgeMs,
  now,
  readJson,
  writeJson,
  refreshUsdMyr,
  rawHash,
}) {
  const amt = extractStripeUsdCents(event);
  if (!amt || amt.ok !== true) {
    return { ok: false, reason: amt && amt.reason ? amt.reason : 'bad_event' };
  }

  const fxSnap = await getFxSnapshotForBinding({
    briefCachePath,
    maxAgeMs,
    now,
    readJson,
    writeJson,
    refreshUsdMyr,
  });

  if (!fxSnap || fxSnap.ok !== true) {
    return { ok: false, reason: 'fx_unavailable', fxError: fxSnap && fxSnap.error ? fxSnap.error : 'unknown' };
  }

  const db = openLedgerDb({ dbPath });
  ensureLedgerSchema(db);

  const rec = recordPayment({
    db,
    provider: 'stripe',
    eventId: event && typeof event.id === 'string' ? event.id : '',
    amountUsdCents: amt.amountUsdCents,
    fxSnapshot: fxSnap,
    now,
    rawHash,
  });

  return {
    ok: true,
    inserted: rec.inserted,
    amountUsdCents: amt.amountUsdCents,
    fxUsdMyr: fxSnap.fx,
    fxSource: fxSnap.fxSource,
    fxUpdatedAt: fxSnap.fxUpdatedAt,
    boundAt: fxSnap.boundAt,
  };
}

module.exports = { ingestStripeEventToLedger };
