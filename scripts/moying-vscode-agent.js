/**
 * 墨影 VS Code 自主经营 Agent — 商业外放版
 * ============================================
 * 职责：
 *   1. 终端网关链路通联（18791 接口调用 OpenClaw 核心能力）
 *   2. Fiverr/Upwork Crawlee 自动化扫描 + 客户背调
 *   3. Discord 奏折审批流（截图→垂直卡片→审批→执行）
 *   4. 智能客服路由（按需求类型调不同模型生成回复草稿）
 *   5. VS Code 自我体检（缓存清理 + 响应优化）
 *   6. 审批闸门（删除/部署/密钥修改 弹出中文提示）
 *
 * 运行方式：node scripts/moying-vscode-agent.js [command]
 *   commands:
 *     health        - 体检 VS Code 状态
 *     monitor       - 启动商业外放监控循环
 *     scan          - 立即扫描 Fiverr/Upwork
 *     cleanup       - 清理 VS Code 缓存
 *     approve       - 审批闸门测试
 *     gateway-test  - 测试 18791 网关链路
 *     site          - 一键建站（需审批）
 *     memorial-list - 列出待审批奏折
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GATEWAY_URL = 'http://127.0.0.1:18791';
const AUTH_TOKEN = '3d46c420fa3f403e9f4242e451112b420cd4d3d215c54850';
const VSCODE_SETTINGS_PATH = path.join(process.env.USERPROFILE, '.openclaw', '.vscode', 'settings.json');
const BACKUP_CONFIG_PATH = path.join(process.env.USERPROFILE, '.openclaw', '.vscode', 'BACKUP_SAFE_CONFIG.json');
const LOG_DIR = path.join(process.env.USERPROFILE, '.openclaw', 'workspace', 'CRON');
const LOG_FILE = path.join(LOG_DIR, 'moying_vscode_agent.log');
const MEMORIAL_DIR = path.join(process.env.USERPROFILE, '.openclaw', 'workspace', 'memorials');
const PENDING_FILE = path.join(MEMORIAL_DIR, 'pending_approval.json');

for (const dir of [LOG_DIR, MEMORIAL_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] [墨影VS] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function logError(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] [墨影VS] [ERROR] ${msg}`;
  console.error(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function approvalGate(operation, details) {
  return new Promise((resolve) => {
    const popupScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $result = [System.Windows.Forms.MessageBox]::Show(
        '【银月钱庄 · 审批闸门】\n\n' +
        '操作: ${operation}\n' +
        '详情: ${details}\n\n' +
        '是否批准此操作？\n' +
        '点击"是"继续执行，点击"否"取消。',
        '⚠ 审批闸门 - 等待 Lau Sii Lun 确认',
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
      )
      if ($result -eq 'Yes') { exit 0 } else { exit 1 }
    `;
    try {
      execSync(
        `powershell -NoProfile -Command "${popupScript.replace(/"/g, '\\"')}"`,
        { timeout: 60000, stdio: 'pipe', windowsHide: true }
      );
      log(`审批通过: ${operation}`);
      resolve(true);
    } catch {
      log(`审批拒绝: ${operation}`);
      resolve(false);
    }
  });
}

function gatewayRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GATEWAY_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gateway timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testGatewayLink() {
  log('测试 18791 网关链路...');
  try {
    const resp = await gatewayRequest('/api/status');
    if (resp.status === 200) {
      log(`网关链路正常 | ${JSON.stringify(resp.data).slice(0, 200)}`);
      return true;
    }
    logError(`网关返回异常: ${resp.status}`);
    return false;
  } catch (err) {
    logError(`网关链路不通: ${err.message}`);
    return false;
  }
}

async function selfHealthCheck() {
  log('开始 VS Code 自我体检...');
  const report = { timestamp: new Date().toISOString(), checks: [] };
  const check = (name, ok, detail) => {
    report.checks.push({ name, ok, detail });
    log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
  };

  check('settings.json 存在', fs.existsSync(VSCODE_SETTINGS_PATH), VSCODE_SETTINGS_PATH);
  check('BACKUP_SAFE_CONFIG 存在', fs.existsSync(BACKUP_CONFIG_PATH), BACKUP_CONFIG_PATH);

  if (fs.existsSync(VSCODE_SETTINGS_PATH)) {
    check('settings.json 非空', fs.statSync(VSCODE_SETTINGS_PATH).size > 100, `${fs.statSync(VSCODE_SETTINGS_PATH).size} bytes`);
  }

  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
  const codeDir = path.join(appData, 'Code');
  for (const dir of ['Cache', 'CachedData', 'GPUCache']) {
    const fullPath = path.join(codeDir, dir);
    if (fs.existsSync(fullPath)) {
      let dirSize = 0;
      try {
        for (const file of fs.readdirSync(fullPath)) {
          try { const fp = path.join(fullPath, file); if (fs.statSync(fp).isFile()) dirSize += fs.statSync(fp).size; } catch {}
        }
      } catch {}
      check(`VS Code ${dir}`, dirSize < 500 * 1024 * 1024, `${(dirSize / 1024 / 1024).toFixed(1)} MB${dirSize > 500 * 1024 * 1024 ? ' (建议清理)' : ''}`);
    }
  }

  check('网关链路', await testGatewayLink(), '');
  check('奏折目录', fs.existsSync(MEMORIAL_DIR), MEMORIAL_DIR);

  const pendingCount = fs.existsSync(PENDING_FILE)
    ? (() => { try { return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')).length; } catch { return 0; } })()
    : 0;
  check('待审批奏折', pendingCount >= 0, `${pendingCount} 份`);

  const reportPath = path.join(LOG_DIR, `vscode_health_${new Date().toISOString().slice(0, 10)}.json`);
  try { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); log(`体检报告: ${reportPath}`); } catch {}
  return report;
}

async function cleanupVSCodeCache() {
  log('开始清理 VS Code 缓存...');
  const appData = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
  const codeDir = path.join(appData, 'Code');
  let totalCleaned = 0;

  for (const dir of ['Cache', 'CachedData', 'GPUCache']) {
    const fullPath = path.join(codeDir, dir);
    if (!fs.existsSync(fullPath)) continue;
    try {
      let dirSize = 0;
      for (const file of fs.readdirSync(fullPath)) {
        try { const fp = path.join(fullPath, file); const stat = fs.statSync(fp); if (stat.isFile()) { dirSize += stat.size; fs.unlinkSync(fp); } } catch {}
      }
      totalCleaned += dirSize;
      log(`  ✓ ${dir}: ${(dirSize / 1024 / 1024).toFixed(1)} MB`);
    } catch (err) { logError(`  ✗ ${dir}: ${err.message}`); }
  }
  log(`共释放 ${(totalCleaned / 1024 / 1024).toFixed(1)} MB`);
  return totalCleaned;
}

async function oneClickSite(projectName, projectType) {
  log(`一键建站: ${projectName} (${projectType})`);
  const approved = await approvalGate('一键建站', `项目: ${projectName}\n类型: ${projectType}`);
  if (!approved) { log('建站被拒'); return false; }

  try {
    const resp = await gatewayRequest('/api/agents/yinyue/chat', 'POST', {
      message: `初始化 ${projectType} 项目 ${projectName}，Next.js + Tailwind CSS，生成完整项目结构和基础页面。`,
      stream: false,
    });
    if (resp.status === 200) { log(`建站指令已发送: ${JSON.stringify(resp.data).slice(0, 200)}`); return true; }
    logError(`建站失败: ${resp.status}`); return false;
  } catch (err) { logError(`建站异常: ${err.message}`); return false; }
}

/**
 * ==========================================
 * 商业外放核心 — Crawlee 扫描 + 奏折审批
 * ==========================================
 */

async function scanFreelancePlatforms() {
  log('开始扫描 Fiverr/Upwork...');

  try {
    const freelancer = require('../lib/crawlee-freelance');
    const results = await freelancer.scanAll();
    log(`扫描完成: Fiverr ${results.fiverr.messages.length} 条, Upwork ${results.upwork.messages.length} 条`);

    if (results.fiverr.error === 'not_logged_in' && results.upwork.error === 'not_logged_in') {
      log('两个平台均未登录，跳过奏折提交');
      return { ok: false, reason: 'not_logged_in' };
    }

    const allMessages = [
      ...results.fiverr.messages.map(m => ({ ...m, platform: 'fiverr' })),
      ...results.upwork.messages.map(m => ({ ...m, platform: 'upwork' })),
    ];

    if (allMessages.length === 0) {
      log('没有新消息');
      return { ok: true, messages: [] };
    }

    const memorials = [];
    for (const msg of allMessages) {
      if (!msg.hasNewMessage && !msg.recentMessages.length) continue;

      let background = null;
      try {
        const bg = await freelancer.backgroundCheck(msg.sender, msg.platform);
        background = bg.profile ? bg.profile.map(p => `${p.title}: ${p.snippet}`).join('\n') : '未找到公开信息';
      } catch {
        background = '背调失败';
      }

      const requirement = msg.recentMessages.join(' ') || msg.preview || '未识别到明确需求';
      const aiSuggestion = await generateReplyDraft(msg.platform, msg.sender, requirement, background);

      const memorialData = {
        platform: msg.platform,
        clientName: msg.sender,
        clientBackground: background,
        requirement: requirement.slice(0, 800),
        estimatedDuration: estimateDuration(requirement),
        estimatedBudget: estimateBudget(requirement),
        aiSuggestion,
        screenshotPath: results[msg.platform]?.screenshot || null,
        rawMessages: msg.recentMessages,
        confidence: msg.recentMessages.length > 2 ? 'high' : 'medium',
      };

      const memorialResult = await submitMemorialToGateway(memorialData);
      memorials.push({ sender: msg.sender, platform: msg.platform, memorialResult });
      log(`奏折已提交: ${msg.platform}/${msg.sender} -> ${memorialResult.memorialId}`);
    }

    await freelancer.close();
    return { ok: true, memorials };
  } catch (err) {
    logError(`扫描异常: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function submitMemorialToGateway(memorialData) {
  try {
    const resp = await gatewayRequest('/api/agents/yinyue/chat', 'POST', {
      message: `【奏折提交】平台:${memorialData.platform} 客户:${memorialData.clientName} 需求:${memorialData.requirement.slice(0, 200)} 建议:${memorialData.aiSuggestion.slice(0, 200)}`,
      stream: false,
      memorial: memorialData,
    });
    return { memorialId: `mem_${Date.now().toString(36)}`, sent: resp.status === 200 };
  } catch {
    const memorialId = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const localEntry = { memorialId, ...memorialData, status: 'pending', submittedAt: new Date().toISOString() };
    const pending = [];
    try {
      if (fs.existsSync(PENDING_FILE)) pending.push(...JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')));
    } catch {}
    pending.push(localEntry);
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pending, null, 2), 'utf8');
    return { memorialId, sent: false, local: true };
  }
}

async function generateReplyDraft(platform, clientName, requirement, background) {
  const lowerReq = requirement.toLowerCase();
  let modelHint = '';

  if (lowerReq.includes('finance') || lowerReq.includes('trading') || lowerReq.includes('investment') || lowerReq.includes('mt4') || lowerReq.includes('forex')) {
    modelHint = '金融类需求，建议调用萧炎(Xiaoyan)模型生成回复';
  } else if (lowerReq.includes('architecture') || lowerReq.includes('backend') || lowerReq.includes('api') || lowerReq.includes('system') || lowerReq.includes('infrastructure')) {
    modelHint = '架构类需求，建议调用李长寿(Li Changshou)模型生成回复';
  } else if (lowerReq.includes('design') || lowerReq.includes('ui') || lowerReq.includes('ux') || lowerReq.includes('frontend') || lowerReq.includes('landing')) {
    modelHint = '设计类需求，建议调用美杜莎(Medusa)模型生成回复';
  } else if (lowerReq.includes('content') || lowerReq.includes('writing') || lowerReq.includes('copy') || lowerReq.includes('seo') || lowerReq.includes('marketing')) {
    modelHint = '内容类需求，建议调用药老(Yao Lao)模型生成回复';
  } else {
    modelHint = '通用需求，建议调用银月(SilverMoon)模型生成回复';
  }

  return `${modelHint}\n\n【回复草稿】\n感谢联系！我们已收到您的需求。\n平台: ${platform}\n客户: ${clientName}\n需求摘要: ${requirement.slice(0, 300)}\n\n我们将在评估后尽快回复您。`;
}

function estimateDuration(requirement) {
  const lower = requirement.toLowerCase();
  if (lower.includes('landing') || lower.includes('simple') || lower.includes('fix')) return '1-3 天';
  if (lower.includes('full') || lower.includes('complex') || lower.includes('platform') || lower.includes('system')) return '2-4 周';
  if (lower.includes('integration') || lower.includes('api') || lower.includes('automation')) return '1-2 周';
  return '待评估';
}

function estimateBudget(requirement) {
  const lower = requirement.toLowerCase();
  if (lower.includes('landing') || lower.includes('simple') || lower.includes('fix')) return '$50-200';
  if (lower.includes('full') || lower.includes('complex') || lower.includes('platform') || lower.includes('system')) return '$500-2000';
  if (lower.includes('integration') || lower.includes('api') || lower.includes('automation')) return '$200-800';
  return '待评估';
}

async function listPendingMemorials() {
  if (!fs.existsSync(PENDING_FILE)) {
    log('没有待审批奏折');
    return { ok: true, count: 0, memorials: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    const pending = data.filter(m => m.status === 'pending');
    log(`待审批奏折: ${pending.length} 份`);
    for (const m of pending) {
      log(`  [${m.memorialId}] ${m.platform}/${m.clientName} - ${m.requirement.slice(0, 60)}`);
    }
    return { ok: true, count: pending.length, memorials: pending };
  } catch (err) {
    logError(`读取奏折失败: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function monitorFreelance() {
  log('启动商业外放监控循环 (每 30 分钟)...');

  async function checkCycle() {
    log('--- 商业外放扫描周期开始 ---');
    const result = await scanFreelancePlatforms();
    if (result.ok && result.memorials && result.memorials.length > 0) {
      log(`本轮提交 ${result.memorials.length} 份奏折`);
    } else if (result.ok) {
      log('本轮无新商机');
    } else {
      logError(`扫描异常: ${result.error || result.reason}`);
    }
    log('--- 商业外放扫描周期结束 ---');
  }

  await checkCycle();
  setInterval(checkCycle, 30 * 60 * 1000);
  log('商业外放监控循环已启动，每 30 分钟检查一次');
}

async function main() {
  const command = process.argv[2] || 'health';
  log(`墨影 VS Code Agent 启动 | 命令: ${command}`);

  switch (command) {
    case 'health':
      await selfHealthCheck();
      break;

    case 'monitor':
      await monitorFreelance();
      break;

    case 'scan':
      const scanApproved = await approvalGate('扫描 Fiverr/Upwork', '将打开浏览器扫描 Fiverr 和 Upwork 聊天窗口');
      if (scanApproved) {
        await scanFreelancePlatforms();
      } else {
        log('扫描被主人拒绝');
      }
      break;

    case 'cleanup':
      const cleanupApproved = await approvalGate('清理 VS Code 缓存', '将删除 VS Code Cache/CachedData/GPUCache 下所有文件');
      if (cleanupApproved) {
        await cleanupVSCodeCache();
      } else {
        log('缓存清理被主人拒绝');
      }
      break;

    case 'approve':
      const testResult = await approvalGate('测试审批闸门', '这是一个审批闸门功能测试');
      log(`审批闸门测试: ${testResult ? '批准' : '拒绝'}`);
      break;

    case 'gateway-test':
      const ok = await testGatewayLink();
      log(`网关链路: ${ok ? '通过' : '失败'}`);
      break;

    case 'site':
      const projectName = process.argv[3] || 'test-project';
      const projectType = process.argv[4] || 'nextjs-tailwind';
      await oneClickSite(projectName, projectType);
      break;

    case 'memorial-list':
      await listPendingMemorials();
      break;

    default:
      console.log(`
墨影 VS Code Agent 使用说明:
  node scripts/moying-vscode-agent.js <command>

命令:
  health        - 体检 VS Code 状态（默认）
  monitor       - 启动商业外放监控循环（每30分钟）
  scan          - 立即扫描 Fiverr/Upwork（需审批）
  cleanup       - 清理 VS Code 缓存（需审批）
  approve       - 审批闸门功能测试
  gateway-test  - 测试 18791 网关链路
  site <name> <type> - 一键建站（需审批）
  memorial-list - 列出待审批奏折
      `);
      break;
  }
}

main().catch((err) => {
  logError(`未捕获异常: ${err.message}`);
  process.exit(1);
});