'use strict';
/**
 * launch-chrome.cjs
 * 启动 Chrome（可见窗口，Profile 3 独立配置）。
 *
 * ⚠️ 重要设计决策 ⚠️
 * 本脚本启动的 Chrome 实例供【用户直接使用】，因此：
 *   - 默认不携带 --remote-debugging-port，避免自动化模式阻碍键盘输入
 *   - 使用 cp.spawn 直接启动（而非 WScript.Shell COM），确保窗口正常获得焦点
 *   - Profile 3 独立配置，不影响用户 Default 配置的浏览数据
 *   - 传入 --cdp 参数时额外启用远程调试端口（可见窗口 + CDP 共存）
 *
 * 若 OpenClaw 需要 CDP 自动化（截图/操控），应在 SOUL.md 中引导银月：
 *   在 `launch-chrome.cjs` 启动的浏览器窗口中手动完成操作，或
 *   另行启动 headless CDP 实例（见 --cdp 参数）。
 *
 * 策略：
 *   1. 所有参数直接传递，杜绝自动化模式
 *   2. 若已有 Chrome Profile 3 进程运行，直接复用
 *   3. --start-maximized 确保窗口最大化，焦点正常
 */
const cp = require('child_process');
const path = require('path');
const fs = require('fs');

// ── 启动前清理僵尸 Chrome 自动化进程 ──
// 通过 wmic 查找命令含有 --remote-debugging-port 的 Chrome 进程，
// 这些是之前可能残留的 headless/自动化模式实例，会占用 CPU 且无可见窗口。
// 若传入 skipPort 参数，会跳过正在使用该端口的 Chrome 进程（防止误杀当前 CDP 会话）。
function cleanupZombieChrome(skipPort) {
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      `wmic process where "name='chrome.exe' and CommandLine like '%remote-debugging-port%'" get ProcessId`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const pids = output.split(/\r?\n/).map(l => l.trim()).filter(l => /^\d+$/.test(l));
    for (const pid of pids) {
      // 如果指定了跳过端口，检查该进程是否正在使用该端口
      if (skipPort) {
        try {
          const netOutput = execSync(
            `netstat -ano | findstr :${skipPort}`,
            { encoding: 'utf8', timeout: 3000 }
          );
          // 该 PID 正在使用跳过端口 → 这是当前活跃的 CDP 会话，不能杀
          if (netOutput.includes(pid)) {
            console.log(`🛡️ 跳过活跃 CDP 端口 ${skipPort} (PID: ${pid})，防止误杀当前会话`);
            continue;
          }
        } catch { /* netstat 不可用时照常清理 */ }
      }
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', timeout: 3000 });
        console.log(`🧹 已清理僵尸 Chrome 进程 (PID: ${pid})`);
      } catch {
        // 进程可能已被清理，静默跳过
      }
    }
  } catch (e) {
    // wmic 不可用或没有匹配进程时静默跳过
  }
}

// ── `--url` 参数解析：银月通过此参数指定打开的目标网页 ──
const urlArgIndex = process.argv.indexOf('--url');
const targetUrl = urlArgIndex !== -1 ? process.argv[urlArgIndex + 1] : null;

// ── `--cdp` 参数：启用 Chrome DevTools Protocol，用于 turix_cua 自动化 ──
// 开启后 Chrome 同时可见窗口 + CDP 可用，用户可手动输入，自动化脚本也可操控
const cdpMode = process.argv.includes('--cdp');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA_DIR = path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data');
const PROFILE_DIR = 'Profile 3';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * 通过 wmic 查询 Chrome 进程命令行，判断 Profile 3 是否已有实例在运行。
 * 相比文件锁检测（SingletonLock/SingletonSocket），wmic 更可靠：
 *   - 不受 `forceCleanProfileLock` 误删影响
 *   - 不会被僵尸锁文件欺骗
 *   - 直接查询操作系统进程表，100% 准确
 */
function isProfileRunningViaWmic() {
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      `wmic process where "name='chrome.exe' and CommandLine like '%Profile 3%'" get ProcessId`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const pids = output.split(/\r?\n/).map(l => l.trim()).filter(l => /^\d+$/.test(l));
    return pids.length > 0;
  } catch {
    // wmic 不可用或查询失败 → 降级到文件锁检测
    const lockFiles = [
      path.join(USER_DATA_DIR, PROFILE_DIR, 'SingletonLock'),
      path.join(USER_DATA_DIR, PROFILE_DIR, 'SingletonSocket'),
    ];
    return lockFiles.some(f => { try { return fs.existsSync(f); } catch { return false; } });
  }
}

/**
 * 保证清理残留锁文件，但只在确认 Chrome 进程已死时才执行。
 * 避免误删正在运行的 Chrome 实例的锁文件，导致后续 isProfileRunningViaWmic 误判。
 */
function forceCleanProfileLockSafe() {
  // 先确认 Chrome 进程真的死了
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      `wmic process where "name='chrome.exe' and CommandLine like '%Profile 3%'" get ProcessId`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const pids = output.split(/\r?\n/).map(l => l.trim()).filter(l => /^\d+$/.test(l));
    if (pids.length > 0) {
      console.log(`🛡️ Profile 3 的 Chrome 进程仍在运行 (PID: ${pids.join(',')})，跳过锁文件清理`);
      return false; // Chrome 还在运行，不清理锁文件
    }
  } catch { /* wmic 不可用，仍尝试清理 */ }

  // Chrome 进程已死 → 安全清理锁文件
  const lockFiles = [
    path.join(USER_DATA_DIR, PROFILE_DIR, 'SingletonLock'),
    path.join(USER_DATA_DIR, PROFILE_DIR, 'SingletonSocket'),
  ];
  let cleaned = false;
  for (const f of lockFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        console.log(`🧹 已清除残留锁文件: ${f}`);
        cleaned = true;
      }
    } catch (e) {
      console.warn(`⚠️ 无法清除锁文件 ${f}: ${e.message}`);
    }
  }
  return cleaned;
}

async function main() {
  // ── 启动前清理残余 Chrome 自动化进程（防止僵尸进程占用 CPU/风扇狂转） ──
  // CDP 模式下跳过 9222 端口，防止误杀当前正在使用的 CDP 会话
  cleanupZombieChrome(cdpMode ? 9222 : null);

  // ── 用 wmic 检查 Profile 3 是否已有 Chrome 进程在运行 ──
  const profileRunning = isProfileRunningViaWmic();
  if (profileRunning) {
    console.log(`✅ Profile 3 的 Chrome 已在运行（wmic 确认），复用现有窗口`);
    // 即使已运行，如果传入了 --url，尝试在新标签页打开
    if (targetUrl) {
      console.log(`🌐 尝试在新标签页打开: ${targetUrl}`);
      const args = [
        `--user-data-dir=${USER_DATA_DIR}`,
        `--profile-directory=${PROFILE_DIR}`,
        `--new-window=${targetUrl}`,
      ];
      const proc = cp.spawn(CHROME_PATH, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      proc.unref();
    }
    process.exit(0);
  }

  // ── Chrome 进程确认已死 → 安全清理残留锁文件 ──
  forceCleanProfileLockSafe();

  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`❌ 找不到 Chrome: ${CHROME_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(USER_DATA_DIR, PROFILE_DIR))) {
    console.error(`❌ 找不到 Profile 3: ${path.join(USER_DATA_DIR, PROFILE_DIR)}`);
    process.exit(1);
  }

  // ── 构建启动参数 ──
  // 默认不传入 --remote-debugging-port，确保 Chrome 不进入自动化模式，
  // 用户可以在窗口中正常打字、搜索、浏览。
  // 若传入 --cdp 参数，则启用远程调试端口（可见窗口 + CDP 共存）。
  const args = [
    `--user-data-dir=${USER_DATA_DIR}`,
    `--profile-directory=${PROFILE_DIR}`,
    // ── 可见窗口：最大化启动，用户可直接使用 ──
    '--start-maximized',
    // ── CDP 模式：可见窗口 + 远程调试端口（turix_cua 自动化所需） ──
    ...(cdpMode ? ['--remote-debugging-port=9222'] : []),
    // ── 抑制一切弹窗和向导 ──
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-features=TranslateUI,ChromeWhatsNewUI,ChromeTipsInMainMenu,DiceFix',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  // ── 如果指定了 --url，在新标签页中打开 ──
  if (targetUrl) {
    args.push(`--new-window=${targetUrl}`);
    console.log(`🌐 目标 URL: ${targetUrl}`);
  }

  console.log(`🚀 启动 Chrome (Profile 3, 可见窗口${cdpMode ? '+CDP' : ''}, 全键盘可用)...`);

  // ── 使用 cp.spawn 直接启动（不使用 COM 对象） ──
  // spawn 比 WScript.Shell 更可靠：子进程直接绑定到窗口工作站，焦点正常
  const proc = cp.spawn(CHROME_PATH, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,   // 窗口必须可见
  });
  proc.unref();

  // 等待几秒确保窗口创建完成（CDP 模式下多等一会让调试端口就绪）
  await sleep(cdpMode ? 5000 : 3000);
  console.log(`✅ Chrome 已启动，Profile 3 可见窗口已打开`);

  // 如果进程意外退出，给出提示但不阻塞
  proc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.log(`⚠️ Chrome 进程退出（exit code=${code}），用户可能已关闭浏览器`);
    }
  });
}

main().catch(e => {
  console.error(`❌ 启动失败: ${e.message}`);
  process.exit(1);
});
