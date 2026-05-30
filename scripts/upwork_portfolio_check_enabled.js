(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1500 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog', url: page.url(), title: await page.title() };

  const save = dlg.getByRole('button', { name: /Save as draft/i });
  const next = dlg.getByRole('button', { name: /Next: Preview/i });
  const saveEnabled = await save.isEnabled().catch(() => false);
  const nextEnabled = await next.isEnabled().catch(() => false);

  const errors = await dlg.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return [];
    const nodes = Array.from(el.querySelectorAll('[aria-live], .air3-form-message, .air3-form-message__text, [data-test*="error"]'));
    const t = (s) => (s || '').toString().trim();
    return nodes.map((n) => t(n.textContent)).filter(Boolean).slice(0, 20);
  });

  return { ok: true, url: page.url(), saveEnabled, nextEnabled, errors };
})

