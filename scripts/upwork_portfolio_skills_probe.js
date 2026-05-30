(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1500 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };

  const search = dlg.locator('input[type="search"]').first();
  const vis = await search.isVisible({ timeout: 800 }).catch(() => false);
  if (!vis) return { ok: false, reason: 'no_searchbox' };

  await search.fill('Testing');
  await page.waitForTimeout(300);

  const sugg = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { options: [], listboxes: [] };
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const s = window.getComputedStyle(el);
      return s && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    };
    const listboxes = Array.from(dialog.querySelectorAll('[role="listbox"]')).filter(vis);
    const options = [];
    for (const lb of listboxes) {
      const opts = Array.from(lb.querySelectorAll('[role="option"], li, div, button')).filter(vis);
      for (const o of opts) {
        const t = (o.textContent || '').trim();
        if (t) options.push({ tag: o.tagName.toLowerCase(), role: o.getAttribute('role') || '', text: t.slice(0, 60) });
      }
    }
    return { listboxes: listboxes.length, options: options.slice(0, 20) };
  });

  return { ok: true, url: page.url(), sugg };
})

