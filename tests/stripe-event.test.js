const assert = require('assert');

const { extractStripeUsdCents } = require('../lib/stripe-event');

async function run() {
  {
    const evt = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { amount_total: 123 } },
    };
    const r = extractStripeUsdCents(evt);
    assert.deepEqual(r, { ok: true, amountUsdCents: 123 });
  }

  {
    const evt = {
      id: 'evt_2',
      type: 'payment_intent.succeeded',
      data: { object: { amount: 456 } },
    };
    const r = extractStripeUsdCents(evt);
    assert.deepEqual(r, { ok: true, amountUsdCents: 456 });
  }

  {
    const evt = {
      id: 'evt_3',
      type: 'checkout.session.completed',
      data: { object: { amount_total: null } },
    };
    const r = extractStripeUsdCents(evt);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing_amount');
  }

  {
    const evt = { id: 'evt_4', type: 'customer.created', data: { object: {} } };
    const r = extractStripeUsdCents(evt);
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