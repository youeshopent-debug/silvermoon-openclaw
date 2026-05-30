(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1200 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };

  const search = dlg.locator('input[type="search"], input[role="combobox"], input').first();
  const hasSearch = await search.isVisible({ timeout: 1200 }).catch(() => false);
  if (!hasSearch) return { ok: false, reason: 'no_searchbox' };

  const terms = ['Security Engineering', 'Web Development', 'REST API', 'Stripe'];
  const results = [];

  for (const term of terms) {
    await search.fill(term);
    await page.waitForTimeout(250);
    const list = dlg.locator('[role="listbox"]').first();
    const opt = list.locator('[role="option"]').first();
    const optVis = await opt.isVisible({ timeout: 900 }).catch(() => false);
    if (optVis) {
      const picked = String((await opt.textContent().catch(() => '')) || '').trim();
      await opt.click();
      results.push({ term, picked });
    } else {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      results.push({ term, picked: 'keyboard' });
    }
    await page.waitForTimeout(250);
  }

  const aria = await dlg
    .locator('button[aria-label^="Remove"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter(Boolean))
    .catch(() => []);

  return { ok: true, results, tags: aria };
})
