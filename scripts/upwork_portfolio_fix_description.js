(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1200 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };

  const box = dlg.getByRole('textbox', { name: /Project description/i }).first();
  await box.waitFor({ state: 'visible', timeout: 15000 });
  const cur = await box.inputValue().catch(() => '');

  const cleaned = String(cur || '')
    .replace(/\\\\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  await box.fill(cleaned);

  return { ok: true, changed: cleaned !== cur, length: cleaned.length };
})

