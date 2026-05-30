(async page => {
  const out = { ok: false, url: page.url(), title: await page.title() };
  await page.bringToFront();

  const btn = page.locator('button[aria-label="Add portfolio"], a[aria-label="Add portfolio"]').first();
  const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) return { ...out, ok: false, reason: "add_portfolio_not_found" };

  await btn.click();
  await page.waitForTimeout(1200);

  const dlg = page.getByRole('dialog').first();
  const dlgOpen = await dlg.isVisible({ timeout: 3000 }).catch(() => false);
  const heading = dlgOpen ? await dlg.getByRole('heading').first().textContent().catch(() => '') : '';

  return {
    ok: Boolean(dlgOpen),
    url: page.url(),
    dialogOpen: Boolean(dlgOpen),
    dialogTitle: String(heading || '').trim(),
  };
})

