const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ingestStripeEventToLedger } = require('../lib/stripe-ledger-ingest');

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf-8');
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-stripe-ledger-'));
  const briefCachePath = path.join(tmp, 'brief_cache.json');
  const dbPath = path.join(tmp, 'ledger.sqlite');

  {
    const now = new Date('2026-04-23T17:40:50.000Z');
    let refreshCalls = 0;

    const evt = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { amount_total: 123 } },
    };

    const r1 = await ingestStripeEventToLedger({
      event: evt,
      dbPath,
      briefCachePath,
      maxAgeMs: 10 * 60 * 1000,
      now,
      readJson,
      writeJson,
      refreshUsdMyr: async () => {
        refreshCalls += 1;
        return { fx: 4.8, fxSource: 'exchangerate', fxAsOf: '2026-04-23T17:40:45.000Z' };
      },
      rawHash: 'sha256:abc',
    });

    assert.equal(r1.ok, true);
    assert.equal(r1.inserted, true);
    assert.equal(r1.amountUsdCents, 123);
    assert.equal(r1.fxSource, 'exchangerate');
    assert.equal(refreshCalls, 1);

    const afterCache = readJson(briefCachePath);
    assert.equal(afterCache.fx, 4.8);
    assert.equal(afterCache.fxSource, 'exchangerate');

    const r2 = await ingestStripeEventToLedger({
      event: evt,
      dbPath,
      briefCachePath,
      maxAgeMs: 10 * 60 * 1000,
      now,
      readJson,
      writeJson,
      refreshUsdMyr: async () => {
        refreshCalls += 1;
        return { fx: 4.9, fxSource: 'exchangerate', fxAsOf: '2026-04-23T17:40:46.000Z' };
      },
      rawHash: 'sha256:abc',
    });

    assert.equal(r2.ok, true);
    assert.equal(r2.inserted, false);
  }

  {
    const now = new Date('2026-04-23T17:40:50.000Z');
    const evt = { id: 'evt_2', type: 'customer.created', data: { object: {} } };
    const r = await ingestStripeEventToLedger({
      event: evt,
      dbPath,
      briefCachePath,
      maxAgeMs: 10 * 60 * 1000,
      now,
      readJson,
      writeJson,
      refreshUsdMyr: async () => ({ fx: 4.8, fxSource: 'exchangerate' }),
    });

    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unsupported_type');
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
