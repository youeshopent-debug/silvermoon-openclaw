(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1500 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };

  const search = dlg.locator('input[type="search"]').first();
  const vis = await search.isVisible({ timeout: 1500 }).catch(() => false);
  if (!vis) return { ok: false, reason: 'no_search' };

  const addOne = async (term) => {
    await search.fill(term);
    await page.waitForTimeout(250);
    const list = dlg.locator('[role="listbox"]').first();
    const exact = list.locator('[role="option"]').filter({ hasText: new RegExp(`^${term}$`, 'i') }).first();
    if (await exact.isVisible({ timeout: 800 }).catch(() => false)) {
      await exact.click();
      return { term, selected: term };
    }
    const first = list.locator('[role="option"]').first();
    if (await first.isVisible({ timeout: 800 }).catch(() => false)) {
      const t = await first.textContent().catch(() => '');
      await first.click();
      return { term, selected: String(t || '').trim() };
    }
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    return { term, selected: 'keyboard' };
  };

  const r1 = await addOne('Automation');
  await page.waitForTimeout(250);
  const r2 = await addOne('Webhooks');
  await page.waitForTimeout(250);
  const r3 = await addOne('API Integration');
  await page.waitForTimeout(250);

  const errors = await dlg.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return [];
    const nodes = Array.from(el.querySelectorAll('.air3-form-message, .air3-form-message__text, [data-test*="error"]'));
    return nodes.map(n => (n.textContent || '').trim()).filter(Boolean).slice(0, 10);
  });

  return { ok: true, r1, r2, r3, errors };
})
