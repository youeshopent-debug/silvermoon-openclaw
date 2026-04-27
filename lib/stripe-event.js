function isNonNegativeInt(x) {
  return Number.isInteger(x) && x >= 0;
}

function extractStripeUsdCents(evt) {
  const type = evt && typeof evt.type === 'string' ? evt.type : '';
  const obj = evt && evt.data && evt.data.object ? evt.data.object : null;

  if (type === 'checkout.session.completed') {
    const amount = obj && obj.amount_total;
    if (!isNonNegativeInt(amount)) return { ok: false, reason: 'missing_amount' };
    return { ok: true, amountUsdCents: amount };
  }

  if (type === 'payment_intent.succeeded') {
    const amount = obj && obj.amount;
    if (!isNonNegativeInt(amount)) return { ok: false, reason: 'missing_amount' };
    return { ok: true, amountUsdCents: amount };
  }

  return { ok: false, reason: 'unsupported_type' };
}

module.exports = { extractStripeUsdCents };
