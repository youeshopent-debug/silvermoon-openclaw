(async page => {
  const fs = require('fs');
  const path = require('path');

  const root = process.cwd();
  const inPath = path.join(
    root,
    'workspace',
    'dropbox',
    '银月',
    'Upwork',
    'portfolio',
    'webhook-ledger',
    'evidence',
    'stripe_events_redacted.jsonl'
  );
  const outPath = path.join(
    root,
    'workspace',
    'dropbox',
    '银月',
    'Upwork',
    'portfolio',
    'webhook-ledger',
    'evidence',
    'stripe_ledger.png'
  );

  const t = fs.readFileSync(inPath, 'utf8').trim().split(/\r?\n/).slice(0, 14).join('\n');
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const html = [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    '<style>',
    'body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:24px}',
    'h1{font-size:18px;margin:0 0 12px}',
    'pre{font-size:12px;line-height:1.45;background:#0b0b0c;color:#e6e6e6;padding:16px;border-radius:10px;white-space:pre-wrap}',
    '</style>',
    '</head><body>',
    '<h1>Stripe Ledger Evidence (Redacted)</h1>',
    `<pre>${esc(t || '(empty)')}</pre>`,
    '</body></html>',
  ].join('');

  await page.setViewportSize({ width: 1200, height: 720 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: outPath, fullPage: true });

  return { ok: true, out: outPath };
})

