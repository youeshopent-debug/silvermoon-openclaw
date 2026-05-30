async page => {
  const fs = require('fs');
  const path = require('path');

  const root = process.cwd();
  const packPath = path.join(root, 'workspace', 'DROPBOX', '银月', 'Upwork', 'profile_pack.json');
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

  const runsDir = path.join(root, 'workspace', 'DROPBOX', '银月', 'Upwork', 'runs');
  fs.mkdirSync(runsDir, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const logPath = path.join(runsDir, `${runId}_fill.jsonl`);

  const write = (obj) => {
    fs.appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
  };

  const safe = async (step, fn) => {
    try {
      await fn();
      write({ step, ok: true, url: page.url() });
      return true;
    } catch (e) {
      write({ step, ok: false, url: page.url(), error: String(e?.message || e) });
      return false;
    }
  };

  write({ step: 'start', ok: true, url: page.url() });

  await page.bringToFront();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(runsDir, `${runId}_before.png`), fullPage: true });

  await safe('close_complete_profile_modal', async () => {
    const closeBtn = page.getByRole('button', { name: /^Close$/i });
    if (await closeBtn.isVisible({ timeout: 800 })) {
      await closeBtn.click();
      return;
    }
    const xBtn = page.getByRole('button', { name: /close/i }).first();
    if (await xBtn.isVisible({ timeout: 800 })) await xBtn.click();
  });

  const candidates = [
    'https://www.upwork.com/nx/profile',
    'https://www.upwork.com/nx/profile/edit',
    'https://www.upwork.com/freelancers/settings/profile',
  ];

  let navigated = false;
  for (const u of candidates) {
    const ok = await safe(`goto:${u}`, async () => {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(400);
    });
    const cur = page.url();
    if (ok && !/account-security\/login/.test(cur)) {
      navigated = true;
      break;
    }
  }

  if (!navigated) {
    write({ step: 'need_manual_profile_nav', ok: false, url: page.url() });
    await page.screenshot({ path: path.join(runsDir, `${runId}_need_manual.png`), fullPage: true });
    throw new Error('无法自动进入 Upwork Profile 编辑页：请在同一窗口手动打开 Profile 编辑页后再运行一次');
  }

  const title = String(pack.title || '').trim();
  if (title) {
    await safe('fill_title', async () => {
      const box = page.getByRole('textbox', { name: /title|professional title/i }).first();
      await box.waitFor({ timeout: 15000 });
      await box.fill(title);
    });
  }

  const overview = String(pack.overview_mid || pack.overview_long || pack.overview_short || '').trim();
  if (overview) {
    await safe('fill_overview', async () => {
      const area = page.getByRole('textbox', { name: /overview|summary|description/i }).first();
      await area.waitFor({ timeout: 15000 });
      await area.fill(overview);
    });
  }

  await page.screenshot({ path: path.join(runsDir, `${runId}_after.png`), fullPage: true });
  write({ step: 'done_no_submit', ok: true, url: page.url() });
}

