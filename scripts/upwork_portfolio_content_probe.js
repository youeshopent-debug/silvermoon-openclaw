(async page => {
  const dlg = page.getByRole('dialog').first();
  const open = await dlg.isVisible({ timeout: 1200 }).catch(() => false);
  if (!open) return { ok: false, reason: 'no_dialog' };

  const items = await dlg.evaluate(() => {
    const root = document.querySelector('[role="dialog"]');
    if (!root) return [];
    const textareas = Array.from(root.querySelectorAll('textarea[placeholder*="image description" i]'));
    const blocks = [];
    for (const t of textareas) {
      let cur = t;
      let picked = null;
      for (let i = 0; i < 10 && cur; i++) {
        const parent = cur.parentElement;
        if (!parent) break;
        const btns = parent.querySelectorAll('button');
        if (btns && btns.length) {
          picked = parent;
          break;
        }
        cur = parent;
      }
      blocks.push(picked || t.parentElement || t);
    }

    const res = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const btns = Array.from(b.querySelectorAll('button'));
      res.push({
        index: i,
        buttons: btns.map((x) => ({
          aria: x.getAttribute('aria-label') || '',
          title: x.getAttribute('title') || '',
          text: (x.textContent || '').trim().slice(0, 30),
          disabled: x.hasAttribute('disabled'),
        })),
      });
    }
    return res;
  });

  return { ok: true, itemCount: items.length, items };
})
