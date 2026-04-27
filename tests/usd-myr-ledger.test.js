const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getFxSnapshotForBinding,
  openLedgerDb,
  ensureLedgerSchema,
  recordPayment,
  getPaymentByEvent,
} = require('../lib/usd-myr-ledger');

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-ledger-'));
  const briefCachePath = path.join(tmp, 'brief_cache.json');

  {
    const now = new Date('2026-04-23T17:40:50.000Z');
    writeJson(briefCachePath, {
      fx: 4.7,
      fxUpdatedAt: '2026-04-23T17:40:20.000Z',
      fxSource: 'shadow-watchdog',
    });

    let refreshCalls = 0;
    const snap = await getFxSnapshotForBinding({
      briefCachePath,
      maxAgeMs: 10 * 60 * 1000,
      now,
      readJson,
      writeJson,
      refreshUsdMyr: async () => {
        refreshCalls += 1;
        return { fx: 4.8, fxSource: 'api', fxAsOf: '2026-04-23T17:40:45.000Z' };
      },
    });

    assert.equal(snap.ok, true);
    assert.equal(refreshCalls, 0);
    assert.equal(snap.fx, 4.7);
    assert.equal(snap.fxSource, 'shadow-watchdog');
  }

  {
    const now = new Date('2026-04-23T17:40:50.000Z');
    writeJson(briefCachePath, {
      fx: 4.6,
      fxUpdatedAt: '2026-04-23T15:00:00.000Z',
      fxSource: 'shadow-watchdog',
    });

    let refreshCalls = 0;
    const snap = await getFxSnapshotForBinding({
      briefCachePath,
      maxAgeMs: 10 * 60 * 1000,
      now,
      readJson,
      writeJson,
      refreshUsdMyr: async () => {
        refreshCalls += 1;
        return { fx: 4.8, fxSource: 'exchangerate', fxAsOf: '2026-04-23T17:40:45.000Z' };
      },
    });

    assert.equal(snap.ok, true);
    assert.equal(refreshCalls, 1);
    const after = readJson(briefCachePath);
    assert.equal(after.fx, 4.8);
    assert.equal(after.fxSource, 'exchangerate');
    assert.ok(String(after.fxUpdatedAt || '').startsWith('2026-04-23T17:40'));
  }

  {
    const db = openLedgerDb({ dbPath: ':memory:' });
    ensureLedgerSchema(db);

    const now = new Date('2026-04-23T17:40:50.000Z');
    const fxSnap = {
      ok: true,
      fx: 4.7,
      fxSource: 'shadow-watchdog',
      fxUpdatedAt: '2026-04-23T17:40:20.000Z',
      boundAt: now.toISOString(),
    };

    const r1 = recordPayment({
      db,
      provider: 'stripe',
      eventId: 'evt_1',
      amountUsdCents: 1,
      fxSnapshot: fxSnap,
      now,
      rawHash: 'sha256:abc',
    });
    assert.equal(r1.inserted, true);

    const row = getPaymentByEvent(db, { provider: 'stripe', eventId: 'evt_1' });
    assert.equal(row.amountUsdCents, 1);
    assert.equal(row.fxUsdMyr, 4.7);
    assert.equal(row.fxSource, 'shadow-watchdog');
    assert.equal(row.amountMyrCents, 5);

    const r2 = recordPayment({
      db,
      provider: 'stripe',
      eventId: 'evt_1',
      amountUsdCents: 1,
      fxSnapshot: fxSnap,
      now,
      rawHash: 'sha256:abc',
    });
    assert.equal(r2.inserted, false);
  }

  {
    const now = new Date('2026-04-23T17:40:50.000Z');
    writeJson(briefCachePath, {
      fx: 4.6,
      fxUpdatedAt: '2026-04-23T10:00:00.000Z',
      fxSource: 'shadow-watchdog',
    });

    const snap = await getFxSnapshotForBinding({
      briefCachePath,
      maxAgeMs: 10 * 60 * 1000,
      now,
      readJson,
      writeJson,
      refreshUsdMyr: async () => {
        throw new Error('net_down');
      },
    });

    assert.equal(snap.ok, false);
    assert.equal(snap.reason, 'fx_unavailable');

    const db = openLedgerDb({ dbPath: ':memory:' });
    ensureLedgerSchema(db);
    assert.throws(() => {
      recordPayment({
        db,
        provider: 'stripe',
        eventId: 'evt_2',
        amountUsdCents: 100,
        fxSnapshot: snap,
        now,
        rawHash: 'sha256:def',
      });
    });
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });