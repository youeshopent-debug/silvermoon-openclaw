const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}

function shortHash(s) {
  return sha256Hex(s).slice(0, 12);
}

function pickAmount(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    'amount_total',
    'amount_subtotal',
    'amount',
    'unit_amount',
    'amount_received',
  ];
  for (const k of candidates) {
    if (typeof obj[k] === 'number') return { key: k, value: obj[k] };
  }
  return null;
}

function pickCurrency(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.currency === 'string') return obj.currency;
  return null;
}

function sanitizeLine(rec) {
  const bodyObj = rec && rec.body && rec.body.data && rec.body.data.object ? rec.body.data.object : null;
  const amount = pickAmount(bodyObj);
  const currency = pickCurrency(bodyObj);

  const out = {
    at: rec.at || null,
    source: rec.source || null,
    eventIdHash: rec.eventId ? shortHash(rec.eventId) : null,
    type: rec.type || null,
    livemode: Boolean(rec.livemode),
    created: typeof rec.created === 'number' ? rec.created : null,
    sigTs: typeof rec.sigTs === 'number' ? rec.sigTs : null,
    rawBytes: typeof rec.rawBytes === 'number' ? rec.rawBytes : null,
    rawSha256Prefix: rec.rawSha256 ? String(rec.rawSha256).slice(0, 12) : null,
  };

  if (amount) out.amount = { key: amount.key, value: amount.value };
  if (currency) out.currency = currency;

  return out;
}

function main() {
  const root = process.cwd();
  const inPath = path.join(root, 'workspace', 'CASHCLAW', 'stripe.events.jsonl');
  const outDir = path.join(root, 'workspace', 'dropbox', '银月', 'Upwork', 'portfolio', 'webhook-ledger', 'evidence');
  fs.mkdirSync(outDir, { recursive: true });

  const outJsonl = path.join(outDir, 'stripe_events_redacted.jsonl');
  const outMd = path.join(outDir, 'stripe_events_summary.md');

  const lines = fs.readFileSync(inPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const sanitized = [];

  for (const line of lines.slice(-2000)) {
    try {
      const rec = JSON.parse(line);
      sanitized.push(sanitizeLine(rec));
    } catch {}
  }

  fs.writeFileSync(outJsonl, sanitized.map((o) => JSON.stringify(o)).join('\n') + '\n', 'utf8');

  const byType = new Map();
  for (const o of sanitized) {
    const k = o.type || 'unknown';
    byType.set(k, (byType.get(k) || 0) + 1);
  }

  const typeLines = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([t, n]) => `- ${t}: ${n}`);

  const sample = sanitized.slice(0, 8).map((o) => `- ${o.at} | ${o.type} | ${o.currency || '-'} | ${o.amount ? `${o.amount.key}=${o.amount.value}` : '-' } | id=${o.eventIdHash}`).join('\n');

  const md = [
    '# Stripe Ledger Evidence (Redacted)',
    '',
    'This summary is generated from a real local JSONL ledger. Sensitive fields were removed.',
    '',
    '## Counts by Event Type',
    ...typeLines,
    '',
    '## Sample Entries',
    sample || '- (no entries)',
    '',
  ].join('\n');

  fs.writeFileSync(outMd, md, 'utf8');
}

main();

