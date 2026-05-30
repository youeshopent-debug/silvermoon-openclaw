(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 800 }).catch(() => false);
  if (!open) return { ok: true, dialogOpen: false, url: page.url(), title: await page.title() };
  const heading = await dlg.getByRole('heading').first().textContent().catch(() => '');
  const buttons = await dlg.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return [];
    const t = (s) => (s || '').toString().trim();
    return Array.from(el.querySelectorAll('button'))
      .map((b) => t(b.textContent))
      .filter(Boolean)
      .slice(0, 20);
  });
  return { ok: true, dialogOpen: true, dialogTitle: String(heading || '').trim(), buttons, url: page.url(), title: await page.title() };
})

