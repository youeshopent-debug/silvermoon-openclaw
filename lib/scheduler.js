const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

function nowIso() {
  return new Date().toISOString();
}

function safeStr(x) {
  return String(x || '').trim();
}

function priorityScore(p) {
  const s = safeStr(p).toLowerCase();
  if (s === 'high') return 3;
  if (s === 'medium') return 2;
  if (s === 'low') return 1;
  return 0;
}

function appendTestReport(fp, obj) {
  try {
    if (!fp) return;
    fs.appendFileSync(fp, JSON.stringify(obj) + '\n', 'utf8');
  } catch {}
}

function fireLocalPopup(cronDir, title, message, timeoutSec) {
  try {
    if (process.env.OPENCLAW_LOCAL_POPUP === '0') return;
    if (process.platform !== 'win32') return;
    const dir = safeStr(cronDir);
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    const vbsPath = path.join(dir, 'test_popup.vbs');
    const t = Math.max(3, Math.min(90, Number(timeoutSec || 20) || 20));
    const msg = String(message || '').replace(/"/g, '""');
    const ttl = String(title || 'OpenClaw').replace(/"/g, '""');
    const vbs = [
      'Set WshShell = CreateObject("WScript.Shell")',
      `WshShell.Popup "${msg}", ${t}, "${ttl}", 64`,
      '',
    ].join('\r\n');
    fs.writeFileSync(vbsPath, vbs, 'utf8');
    const p = childProcess.spawn('wscript', ['//nologo', vbsPath], { detached: true, stdio: 'ignore' });
    p.unref();
  } catch {}
}

function triggerTestReminderNow(opts) {
  try {
    const state = opts?.state;
    const testReportPath = safeStr(opts?.testReportPath);
    const cronDir = testReportPath ? path.dirname(testReportPath) : process.cwd();
    const testReminderPath = path.join(cronDir, 'test_reminder.log');
    const taskName = safeStr(opts?.taskName) || 'MANUAL_TEST_REMINDER';
    appendTestReport(testReminderPath, { at: new Date().toISOString(), kind: 'manual', taskName });
    const now = Date.now();
    const last = Number(state?.cron?._lastTestPopupAt || 0) || 0;
    if (!last || now - last > 45_000) {
      if (state?.cron) state.cron._lastTestPopupAt = now;
      fireLocalPopup(
        cronDir,
        'OpenClaw 测试提醒',
        '手动触发测试提醒：请打开运维面板查看 test_report.log / test_reminder.log。',
        20
      );
    }
    return { ok: true, testReminderPath };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || '').slice(0, 200) };
  }
}

function computeNextRunSimple(cronExpr, tzOffsetMin) {
  const s = safeStr(cronExpr);
  const m = s.match(/^(\d{1,2})\s+(\d{1,2}|\*\/\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!m) return null;
  const minute = Number(m[1]);
  if (!(minute >= 0 && minute <= 59)) return null;
  const hourSpec = m[2];
  const step = hourSpec.startsWith('*/') ? Number(hourSpec.slice(2)) : null;
  const fixedHour = step ? null : Number(hourSpec);
  const offset = Number(tzOffsetMin || 0) || 0;
  const base = new Date(Date.now() + offset * 60 * 1000);
  const curMin = base.getMinutes();
  const curHour = base.getHours();
  const d = new Date(base.getTime());
  d.setSeconds(0, 0);
  const advanceDay = () => d.setDate(d.getDate() + 1);

  if (step) {
    const stepN = Math.max(1, Math.min(24, step));
    let h = curHour;
    if (curMin > minute) h += 1;
    const mod = ((h % stepN) + stepN) % stepN;
    const add = mod === 0 ? 0 : (stepN - mod);
    h = h + add;
    if (h >= 24) {
      advanceDay();
      h = h % 24;
    }
    d.setHours(h, minute, 0, 0);
    const out = new Date(d.getTime() - offset * 60 * 1000);
    return out;
  }

  if (!(fixedHour >= 0 && fixedHour <= 23)) return null;
  d.setHours(fixedHour, minute, 0, 0);
  if (curHour > fixedHour || (curHour === fixedHour && curMin >= minute)) advanceDay();
  d.setHours(fixedHour, minute, 0, 0);
  const out = new Date(d.getTime() - offset * 60 * 1000);
  return out;
}

function buildTaskRegistry(actions) {
  const a = actions || {};
  return [
    {
      taskName: '银月_早报',
      cron: '0 8 * * *',
      priority: 'High',
      preflight: a.prefetchMorningBrief,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '银月_夜报',
      cron: '55 23 * * *',
      priority: 'High',
      preflight: a.prefetchNightlyReport,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '银月_选品日报',
      cron: '30 8 * * *',
      priority: 'High',
      preflight: a.prefetchEcommerceReport,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '魔影_看门巡检',
      cron: '0 * * * *',
      priority: 'High',
      preflight: a.prefetchShadowWatchdog,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '韩立_海外兼职资讯',
      cron: '0 */4 * * *',
      priority: 'Medium',
      preflight: a.prefetchHanLiJobs,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '史官_AutoDream_记忆复盘',
      cron: '10 0 * * *',
      priority: 'Low',
      preflight: a.prefetchAutoDream,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '雅妃_财务报表',
      cron: '0 0 * * *',
      priority: 'Medium',
      preflight: a.prefetchYaFeiDaily,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '长期记忆_复盘',
      cron: '5 0 * * *',
      priority: 'Low',
      preflight: a.prefetchLongTermDaily,
      action: a.wakeSilverMoon,
    },
    {
      taskName: '萧炎_金融哨兵',
      cron: '0 */2 * * *',
      priority: 'High',
      preflight: a.prefetchXiaoyanSentinel,
      action: a.wakeXiaoyanSentinel,
    },
    {
      taskName: '萧炎_盘前扫描',
      cron: '30 8 * * 1-5',
      priority: 'High',
      preflight: a.prefetchXiaoyanPreMarket,
      action: a.wakeXiaoyanSentinel,
    },
    {
      taskName: '萧炎_盘后复盘',
      cron: '0 18 * * 1-5',
      priority: 'Medium',
      preflight: a.prefetchXiaoyanPostMarket,
      action: a.wakeXiaoyanSentinel,
    },
    {
      taskName: '萧炎_Web3数据同步',
      cron: '0 */6 * * *',
      priority: 'Medium',
      preflight: a.prefetchXiaoyanWeb3,
      action: a.wakeXiaoyanSentinel,
    },
    {
      taskName: '墨影_早检',
      cron: '30 9 * * *',
      priority: 'High',
      preflight: a.prefetchMoYingMorning,
      action: a.wakeMoYing,
    },
    {
      taskName: '墨影_午检',
      cron: '30 15 * * *',
      priority: 'High',
      preflight: a.prefetchMoYingAfternoon,
      action: a.wakeMoYing,
    },
    {
      taskName: '墨影_夜检',
      cron: '55 23 * * *',
      priority: 'High',
      preflight: a.prefetchMoYingNight,
      action: a.wakeMoYing,
    },
    {
      taskName: '墨影_每小时巡检',
      cron: '0 * * * *',
      priority: 'High',
      preflight: a.prefetchMoYingHourly,
      action: a.wakeMoYing,
    },
  ];
}

function initScheduler(opts) {
  const state = opts?.state;
  if (!state || typeof state !== 'object') return { ok: false, error: 'missing_state' };
  if (state.cron && state.cron._schedulerInited) return { ok: true, skipped: true };
  if (state.cron) state.cron._schedulerInited = true;
  if (state.cron && !state.cron.lastRuns) state.cron.lastRuns = {};
  if (state.cron && !state.cron.nextRuns) state.cron.nextRuns = {};
  if (state.cron && !state.cron._queue) state.cron._queue = [];

  const tz = 'Asia/Kuala_Lumpur';
  const tzOffsetMin = 0;
  const tasks = buildTaskRegistry(opts?.actions);
  state.cron.tasks = tasks.map((t) => t.taskName);
  const testReportPath = safeStr(opts?.testReportPath);
  const cronDir = testReportPath ? path.dirname(testReportPath) : process.cwd();
  const testReminderPath = path.join(cronDir, 'test_reminder.log');
  try {
    if (testReportPath) fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
  } catch {}
  const isTestExpr = (expr) => safeStr(expr) === '30 9 22 4 *';
  const pickNextTask = () => {
    const q = state.cron._queue || [];
    if (q.length === 0) return null;
    let bestIdx = -1;
    let best = null;
    for (let i = 0; i < q.length; i += 1) {
      const it = q[i];
      if (!it) continue;
      const isBrief = safeStr(it.taskName) === '银月_晨报';
      const sc = (isBrief ? 1000 : 0) + priorityScore(it.priority);
      if (!best || sc > best.sc) best = { sc, it, i };
    }
    if (!best) return null;
    state.cron._queue.splice(best.i, 1);
    return best.it;
  };
  const runQueue = async () => {
    if (!state.cron || state.cron._draining) return;
    state.cron._draining = true;
    try {
      for (;;) {
        const next = pickNextTask();
        if (!next) break;
        const { taskName, cron: expr, priority, preflight, action } = next;
        const startedAt = Date.now();
        let preMs = 0;
        let actMs = 0;
        let ok = true;
        let err = '';
        let pre = null;
        try {
          if (state.cron) state.cron.lastRuns[taskName] = (typeof opts?.formatTs === 'function') ? opts.formatTs(new Date()) : nowIso();
          const agentName = taskName.split('_')[0] || '未知';
          console.log(`[CRON-TRIGGER] 负责人: ${agentName} | 任务: ${taskName}`);
          const t0 = Date.now();
          pre = typeof preflight === 'function' ? await preflight({ taskName, cron: expr }) : null;
          preMs = Date.now() - t0;
          const t1 = Date.now();
          if (typeof action === 'function') await action({ taskName, cron: expr, priority, preflight: pre, tz });
          actMs = Date.now() - t1;
          console.log(`[CRON-DONE] 负责人: ${agentName} | 任务: ${taskName} | ${preMs + actMs}ms`);
        } catch (e) {
          ok = false;
          err = String(e?.stack || e?.message || e || '').slice(0, 1200);
        } finally {
          const totalMs = Date.now() - startedAt;
          appendTestReport(testReportPath, {
            at: new Date().toISOString(),
            taskName,
            cron: expr,
            priority: safeStr(priority) || null,
            ok,
            preflightMs: preMs,
            actionMs: actMs,
            totalMs,
            err: err || null,
            isTest: isTestExpr(expr),
          });
          const n2 = computeNextRunSimple(expr, tzOffsetMin);
          if (n2 && state.cron) state.cron.nextRuns[taskName] = (typeof opts?.formatTs === 'function') ? opts.formatTs(n2) : n2.toISOString();
          if (!ok && isTestExpr(expr)) {
            console.log(`[TEST_WAKEUP] 任务异常: ${taskName} | ${String(err || '').slice(0, 180)}`);
          }
          void pre;
        }
      }
    } finally {
      if (state.cron) state.cron._draining = false;
    }
  };

  const jobs = [];
  for (const t of tasks) {
    const name = safeStr(t.taskName);
    const expr = safeStr(t.cron);
    if (!name || !expr) continue;
    const next = computeNextRunSimple(expr, tzOffsetMin);
    if (next && typeof opts?.formatTs === 'function') state.cron.nextRuns[name] = opts.formatTs(next);
    else if (next) state.cron.nextRuns[name] = next.toISOString();

    const job = cron.schedule(expr, async () => {
      if (isTestExpr(expr)) {
        console.log(`[TEST_WAKEUP] 触发时间: ${new Date().toLocaleString()}, 任务名: ${t.taskName}`);
        appendTestReport(testReminderPath, { at: new Date().toISOString(), kind: 'trigger', taskName: t.taskName, cron: expr });
        const now = Date.now();
        const last = Number(state.cron?._lastTestPopupAt || 0) || 0;
        if (!last || now - last > 45_000) {
          state.cron._lastTestPopupAt = now;
          fireLocalPopup(
            cronDir,
            'OpenClaw 测试提醒',
            '09:30 集体演习测试已触发（4 任务已入队，晨报优先）。请打开运维面板查看 test_report.log。',
            25
          );
        }
      }
      if (state.cron && Array.isArray(state.cron._queue)) {
        state.cron._queue.push({
          taskName: name,
          cron: expr,
          priority: t.priority,
          preflight: t.preflight,
          action: t.action,
        });
      }
      await runQueue();
    }, { timezone: tz });

    jobs.push(job);
  }

  return { ok: true, tz, jobsCount: jobs.length };
}

module.exports = {
  initScheduler,
  buildTaskRegistry,
  computeNextRunSimple,
  triggerTestReminderNow,
};
