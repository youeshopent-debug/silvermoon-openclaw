(async page => {
  const list = await page.locator('[data-test="job-tile-list"]').first();
  const found = await list.isVisible({ timeout: 2000 }).catch(() => false);
  if (!found) return { ok: false, reason: "job_tile_list_not_found", url: page.url(), title: await page.title() };

  const sample = await list.evaluate(() => {
    const links = Array.from(document.querySelectorAll('[data-test="job-tile-list"] a[href]'));
    return links
      .map((a) => ({
        href: a.getAttribute('href') || '',
        text: (a.textContent || '').trim().slice(0, 100),
        dt: a.getAttribute('data-test') || '',
      }))
      .filter((x) => x.text)
      .slice(0, 20);
  });

  return { ok: true, url: page.url(), title: await page.title(), sample };
})

