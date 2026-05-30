(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1200 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };

  const result = await dlg.evaluate(() => {
    const root = document.querySelector('[role="dialog"]');
    if (!root) return { ok: false, reason: 'no_root' };
    const areas = Array.from(root.querySelectorAll('textarea[placeholder*="image description" i]'));
    if (areas.length < 2) return { ok: false, reason: 'not_enough_items', count: areas.length };

    const findContainerWithButtons = (el) => {
      let cur = el;
      for (let i = 0; i < 10 && cur; i++) {
        const p = cur.parentElement;
        if (!p) break;
        const btns = p.querySelectorAll('button');
        if (btns && btns.length >= 3) return p;
        cur = p;
      }
      return null;
    };

    const c0 = findContainerWithButtons(areas[0]);
    const c1 = findContainerWithButtons(areas[1]);
    if (!c1) return { ok: false, reason: 'no_container' };

    const btns = Array.from(c1.querySelectorAll('button'));
    if (btns.length < 3) return { ok: false, reason: 'not_enough_buttons', buttons: btns.length };

    const delBtn = btns[2];
    const disabled = delBtn.hasAttribute('disabled');
    if (disabled) return { ok: false, reason: 'delete_disabled' };

    delBtn.click();
    return { ok: true, clicked: true, assumedDeleteIndex: 2 };
  });

  await page.waitForTimeout(600);
  const afterCount = await dlg.locator('textarea[placeholder*="image description" i]').count().catch(() => -1);
  return { ...result, afterCount };
})

