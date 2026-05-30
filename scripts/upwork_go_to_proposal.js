(async page => {
  const out = { ok: false, step: "start", url: page.url(), title: await page.title() };

  const ensureLoggedIn = async () => {
    if (/account-security\/login/.test(page.url())) throw new Error("need_login");
  };

  const closeBlockingDialogs = async () => {
    const close = page.getByRole("button", { name: /close the dialog|close/i }).first();
    if (await close.isVisible({ timeout: 400 }).catch(() => false)) await close.click().catch(() => {});
  };

  await page.bringToFront();
  await closeBlockingDialogs();

  out.step = "goto_best_matches";
  await page.goto("https://www.upwork.com/nx/find-work/best-matches", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);
  await ensureLoggedIn();

  out.step = "open_first_job";
  const list = page.locator('[data-test="job-tile-list"]').first();
  await list.waitFor({ state: "visible", timeout: 20000 });
  const jobLink = list.locator('a[href^="/jobs/"]').first();
  await jobLink.waitFor({ state: "visible", timeout: 20000 });
  const href = await jobLink.getAttribute("href");
  if (!href) throw new Error("missing_job_href");
  const jobUrl = href.startsWith("http") ? href : "https://www.upwork.com" + href;
  await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  await ensureLoggedIn();

  out.step = "find_apply_button";
  const applyBtn = page.getByRole("button", { name: /submit a proposal|apply now|apply/i }).first();
  const applyLink = page.getByRole("link", { name: /submit a proposal|apply now|apply/i }).first();
  if (await applyBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await applyBtn.click();
  } else if (await applyLink.isVisible({ timeout: 1500 }).catch(() => false)) {
    await applyLink.click();
  } else {
    out.ok = false;
    out.step = "need_manual_apply_click";
    out.url = page.url();
    out.title = await page.title();
    return out;
  }

  await page.waitForTimeout(1500);
  await ensureLoggedIn();

  out.step = "detect_proposal_form";
  const hasCover = await page.locator('textarea, [contenteditable="true"]').first().isVisible({ timeout: 1500 }).catch(() => false);
  out.ok = Boolean(hasCover);
  out.url = page.url();
  out.title = await page.title();
  out.hasProposalForm = Boolean(hasCover);
  return out;
})
