const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  const p = String(prefix || 'id');
  const r = crypto.randomBytes(6).toString('hex');
  return `${p}_${Date.now()}_${r}`;
}

function requestJson(baseUrl, pathname, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(pathname, baseUrl);
    } catch (e) {
      reject(e);
      return;
    }
    const data = Buffer.from(JSON.stringify(body || {}), 'utf-8');
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      u,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': String(data.length),
          'x-openclaw-worker-token': String(process.env.OPENCLAW_LAPTOP_WORKER_TOKEN || '').trim(),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {}
          resolve({ status: res.statusCode || 0, json: parsed, raw });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(Math.max(1000, Number(timeoutMs || 0) || 0), () => {
      try {
        req.destroy(new Error('timeout'));
      } catch {}
    });
    req.write(data);
    req.end();
  });
}

async function waitApproval(baseUrl, approvalId, workerId) {
  while (true) {
    const r = await requestJson(baseUrl, '/api/laptop/approval/poll', { approvalId, workerId, waitMs: 25_000 }, 35_000);
    if (r.status === 401) throw new Error('unauthorized: bad token');
    const approved = Boolean(r.json?.approved);
    if (approved) return true;
    await sleepMs(600);
  }
}

async function ensurePortfolioDialog(page) {
  const dialog = page.getByRole('dialog');
  try {
    await dialog.waitFor({ state: 'visible', timeout: 12_000 });
    return dialog;
  } catch {}
  const plus = page.getByRole('button', { name: /^add/i }).first();
  await plus.click({ timeout: 10_000 });
  await dialog.waitFor({ state: 'visible', timeout: 12_000 });
  return dialog;
}

async function openAddPortfolio(page, profileUrl) {
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const addBtn =
    page.getByRole('button', { name: /^add/i }).first()
      || page.getByRole('button', { name: /add.*portfolio/i }).first();
  try {
    await addBtn.click({ timeout: 12_000 });
  } catch {
    const plus = page.locator('button').filter({ hasText: '+' }).first();
    await plus.click({ timeout: 12_000 });
  }
  return await ensurePortfolioDialog(page);
}

async function fillPortfolioForm(dialog, payload) {
  await dialog.getByLabel(/project title/i).fill(String(payload.title || ''), { timeout: 12_000 });
  const role = dialog.getByLabel(/your role/i);
  if (role) {
    try {
      await role.fill(String(payload.role || ''), { timeout: 12_000 });
    } catch {}
  }
  await dialog.getByLabel(/project description/i).fill(String(payload.description || ''), { timeout: 12_000 });

  const skillInput = dialog.getByPlaceholder(/type to add skills/i);
  const skills = Array.isArray(payload.skills) ? payload.skills : [];
  for (const s of skills.slice(0, 5)) {
    const v = String(s || '').trim();
    if (!v) continue;
    await skillInput.fill(v, { timeout: 12_000 });
    await skillInput.press('Enter');
  }

  await dialog.getByRole('button', { name: /next:\s*preview/i }).click({ timeout: 12_000 });
}

async function goThumbnail(dialogOrPage) {
  const btn = dialogOrPage.getByRole('button', { name: /next:\s*thumbnail/i });
  await btn.click({ timeout: 12_000 });
}

async function uploadThumbnail(page, imagePath) {
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 12_000 });
  const input = dialog.locator('input[type="file"]').first();
  await input.setInputFiles(imagePath);
  return dialog;
}

async function waitSaveDraftEnabled(dialog) {
  const btn = dialog.getByRole('button', { name: /save as draft/i });
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const disabled = await btn.isDisabled().catch(() => true);
      if (!disabled) return btn;
    } catch {}
    await sleepMs(600);
  }
  return btn;
}

function resolveUpworkPayload(kind) {
  const k = String(kind || 'discord').toLowerCase();
  const base = {
    title: 'Finance Automation Gateway for Discord and Stripe',
    role: 'Lead Architect and Full-Stack Automation Engineer',
    description:
      'Built a finance-focused automation gateway connecting Discord operations with Stripe payment events. Designed an event-driven Node.js workflow with clear modules for ingestion, validation, persistence, and notification. Implemented a reliability-first rule: critical payment status is written to local durable storage before outbound delivery to prevent data loss during outages. Added timeout control, environment-aware proxy and fallback routing, and structured error logging. Introduced channel-based alert routing and digest summaries to reduce noise while preserving visibility. Improved stability, response speed, and operational efficiency.',
    skills: ['Node.js', 'Stripe API Integration', 'Discord Bot Development', 'Backend Architecture', 'Error Handling & Monitoring'],
  };
  if (k === 'webhook') {
    return {
      ...base,
      title: 'Webhook Pipeline: Verify, Dedupe, Ledger, Alerts',
      role: 'Backend Integration Engineer and Reliability Engineer',
    };
  }
  return base;
}

function resolveThumbnailPath(repoRoot, kind) {
  const k = String(kind || 'discord').toLowerCase();
  const prefer = k === 'webhook' ? 'stripe_ledger.png' : 'ops_control.png';
  const p1 = path.join(repoRoot, 'landing', 'public', 'assets', prefer);
  return p1;
}

async function runUpworkPortfolio(baseUrl, workerId, taskId, kind) {
  const repoRoot = process.cwd();
  const profileUrl = String(process.env.OPENCLAW_UPWORK_PROFILE_URL || 'https://www.upwork.com/freelancers/~01c1ade1ca83c8e544').trim();
  const profileDir = path.join(repoRoot, 'user_data', 'chrome-upwork-cdp');
  const approvalId = newId('approve');
  const cronDir = path.join(repoRoot, 'workspace', 'CRON');

  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const page = ctx.pages()[0] || (await ctx.newPage());
    const dialog = await openAddPortfolio(page, profileUrl);
    await fillPortfolioForm(dialog, resolveUpworkPayload(kind));
    await goThumbnail(page);
    const thumbDialog = await uploadThumbnail(page, resolveThumbnailPath(repoRoot, kind));
    const saveBtn = await waitSaveDraftEnabled(thumbDialog);

    const shotBuf = await thumbDialog.screenshot({ type: 'jpeg', quality: 70 });
    await requestJson(
      baseUrl,
      '/api/laptop/report',
      {
        taskId,
        workerId,
        ok: true,
        phase: 'await_approval',
        approvalId,
        summary: '已进入最后一步（Save as draft）前挂起，等待 👍 放行',
        screenshotBase64: shotBuf.toString('base64'),
        artifacts: { kind },
      },
      60_000,
    );
    try {
      fs.mkdirSync(cronDir, { recursive: true });
      fs.writeFileSync(
        path.join(cronDir, 'laptop_last_approval.json'),
        JSON.stringify({ at: nowIso(), approvalId, taskId, workerId, kind, baseUrl }, null, 2),
        'utf-8',
      );
    } catch {}
    try {
      process.stderr.write(`[laptop-worker] awaiting approval: approvalId=${approvalId} taskId=${taskId}\n`);
    } catch {}

    await waitApproval(baseUrl, approvalId, workerId);
    await saveBtn.click({ timeout: 12_000 });

    const finalShot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false }).catch(() => null);
    await requestJson(
      baseUrl,
      '/api/laptop/report',
      {
        taskId,
        workerId,
        ok: true,
        phase: 'done',
        approvalId,
        summary: '已放行并完成保存草稿（未发布）',
        screenshotBase64: finalShot ? finalShot.toString('base64') : '',
        artifacts: { kind },
      },
      60_000,
    );
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e || '').slice(0, 1600);
    await requestJson(
      baseUrl,
      '/api/laptop/report',
      { taskId, workerId, ok: false, phase: 'error', summary: msg, artifacts: { kind } },
      60_000,
    ).catch(() => null);
    return { ok: false, error: msg };
  } finally {
    try {
      await ctx.close();
    } catch {}
  }
}

async function runTask(baseUrl, workerId, task) {
  const type = String(task?.type || '').trim();
  const taskId = String(task?.id || '').trim();
  if (type === 'upwork_portfolio_fill') {
    const kind = String(task?.args?.kind || 'discord').toLowerCase();
    return await runUpworkPortfolio(baseUrl, workerId, taskId, kind);
  }
  await requestJson(
    baseUrl,
    '/api/laptop/report',
    { taskId, workerId, ok: false, phase: 'error', summary: `未知任务类型：${type}`, artifacts: {} },
    60_000,
  ).catch(() => null);
  return { ok: false, error: 'unknown_task' };
}

async function runLaptopWorker() {
  const baseUrl = String(process.env.OPENCLAW_CONTROL_BASE_URL || '').trim();
  const token = String(process.env.OPENCLAW_LAPTOP_WORKER_TOKEN || '').trim();
  const workerId = String(process.env.OPENCLAW_LAPTOP_WORKER_ID || '').trim() || 'worker';
  if (!baseUrl) throw new Error('Missing OPENCLAW_CONTROL_BASE_URL');
  if (!token) throw new Error('Missing OPENCLAW_LAPTOP_WORKER_TOKEN');

  let backoffMs = 1000;
  while (true) {
    try {
      const pull = await requestJson(baseUrl, '/api/laptop/pull', { workerId, waitMs: 25_000 }, 35_000);
      if (pull.status === 401) throw new Error('unauthorized: bad token');
      const task = pull.json?.task || null;
      if (!task) {
        backoffMs = 1000;
        await sleepMs(900);
        continue;
      }
      await runTask(baseUrl, workerId, task);
      backoffMs = 1000;
    } catch (e) {
      const msg = String(e?.message || e || '');
      process.stderr.write(`[laptop-worker] ${nowIso()} error: ${msg}\n`);
      await sleepMs(backoffMs);
      backoffMs = Math.min(30_000, Math.floor(backoffMs * 1.7) + 200);
    }
  }
}

module.exports = { runLaptopWorker };
