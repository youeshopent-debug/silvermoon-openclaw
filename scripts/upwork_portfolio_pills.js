(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1200 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };
  const labels = await dlg.locator('button[aria-label^="Remove"]').allTextContents().catch(() => []);
  const aria = await dlg.locator('button[aria-label^="Remove"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label')).filter(Boolean)
  ).catch(() => []);
  return { ok: true, removeButtons: labels.map((s) => s.trim()).filter(Boolean), removeAria: aria };
})

