(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1500 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog', url: page.url(), title: await page.title() };

  const heading = await dlg.getByRole('heading').first().textContent().catch(() => '');
  const inputs = await dlg.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return [];
    const pick = (n) => (n || '').toString().trim();
    const nodes = Array.from(el.querySelectorAll('input, textarea, [contenteditable="true"]'));
    return nodes.slice(0, 40).map((x) => ({
      tag: x.tagName.toLowerCase(),
      type: x.getAttribute('type') || '',
      name: x.getAttribute('name') || '',
      id: x.getAttribute('id') || '',
      placeholder: pick(x.getAttribute('placeholder')),
      aria: pick(x.getAttribute('aria-label')),
    }));
  });

  const buttons = await dlg.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return [];
    const nodes = Array.from(el.querySelectorAll('button'));
    const t = (s) => (s || '').toString().trim();
    return nodes
      .map((b) => t(b.textContent))
      .filter(Boolean)
      .slice(0, 30);
  });

  return { ok: true, dialogTitle: String(heading || '').trim(), inputs, buttons, url: page.url() };
})

