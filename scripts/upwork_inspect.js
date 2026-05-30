(async page => {
  const title = await page.title();
  const url = page.url();
  const editBtns = page.locator('button[aria-label*="Edit" i]');
  const editCount = await editBtns.count();
  const editLabels = await editBtns.evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label')).filter(Boolean).slice(0, 30)
  );
  const maybeTitleInputs = await page.locator('input[aria-label*="Title" i], input[name*="title" i], input[placeholder*="title" i]').count();
  const maybeTextareas = await page.locator('textarea').count();
  return { url, title, editCount, editLabels, maybeTitleInputs, maybeTextareas };
})

