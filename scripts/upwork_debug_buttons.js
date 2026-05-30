(async page => {
  const out = { url: page.url(), title: await page.title() };
  const items = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const s = window.getComputedStyle(el);
      return s && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
    };
    const btns = Array.from(document.querySelectorAll('button, a[role="button"]'));
    return btns
      .filter(isVisible)
      .map((b) => (b.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 60);
  });
  return { ...out, buttons: items };
})

