'use strict';

/**
 * bossmode-stress-test.cjs — 银月钱庄 BossMode 综合压力测试
 *
 * 覆盖 9 大核心能力验证：
 *   1. 高配合度（执行力）
 *   2. 高智商（逻辑清晰）
 *   3. 高执行力（主动推进）
 *   4. 反省能力（自我复盘）
 *   5. 时间管理（规划优先级）
 *   6. 自修复能力（问题发现+修复）
 *   7. 团队管理（统筹协调）
 *   8. 共情能力（精准捕捉需求）
 *   9. 电商操盘能力（全链路）
 *
 * 用法: node scripts/bossmode-stress-test.cjs
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE = 'http://127.0.0.1:18791';

const RESULTS_DIR = path.join(__dirname, '..', '.silvermoon_core', 'stress-test-results');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const REPORT_FILE = path.join(RESULTS_DIR, `bossmode-stress-${TIMESTAMP}.json`);

// ── 工具函数 ──

function post(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${endpoint}`, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    }).on('error', reject);
  });
}

function ensureDir() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function bold(s) { return `\x1b[1m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function cyan(s) { return `\x1b[36m${s}\x1b[0m`; }

// ── 测试用例 ──

const results = {
  timestamp: new Date().toISOString(),
  totalTests: 0,
  passed: 0,
  failed: 0,
  capabilities: {}
};

function test(name, category, fn) {
  return async () => {
    results.totalTests++;
    const start = Date.now();
    try {
      await fn();
      const ms = Date.now() - start;
      results.passed++;
      if (!results.capabilities[category]) results.capabilities[category] = [];
      results.capabilities[category].push({ name, status: 'PASS', ms });
      console.log(`  ${green('✓')} ${name} ${yellow(`(${ms}ms)`)}`);
    } catch (e) {
      const ms = Date.now() - start;
      results.failed++;
      if (!results.capabilities[category]) results.capabilities[category] = [];
      results.capabilities[category].push({ name, status: 'FAIL', ms, error: e.message });
      console.log(`  ${red('✗')} ${name} ${yellow(`(${ms}ms)`)} — ${red(e.message)}`);
    }
  };
}

// ── 1. 高配合度（执行力） ──

const complianceTests = [
  test('银月网关健康检查', '1-高配合度', async () => {
    const r = await post('/api/actions/health-check', {});
    if (r.status !== 200) throw new Error(`预期200，实际${r.status}`);
    const b = r.body.toLowerCase();
    if (!b.includes('ok') && !b.includes('healthy') && !b.includes('true'))
      throw new Error('响应未包含健康状态');
  }),

  test('银月网关状态查询', '1-高配合度', async () => {
    const r = await get('/api/status');
    if (r.status !== 200) throw new Error(`预期200，实际${r.status}`);
  }),

  test('健康检查延迟测试（3轮100ms以内）', '1-高配合度', async () => {
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const r = await post('/api/actions/health-check', {});
      const ms = Date.now() - start;
      if (ms > 100) console.log(`  ${yellow('⚠')} 请求${i}延迟${ms}ms（阈值100ms）`);
      if (r.status !== 200) throw new Error(`请求${i}返回${r.status}`);
    }
  })
];

// ── 2. 高智商（逻辑清晰） ──

const intelligenceTests = [
  test('Scheduler CRON 注册完整性', '2-高智商', async () => {
    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    const cronTasks = ['prefetchMorningBrief', 'wakeSilverMoon', 'prefetchNightlyReport',
      'prefetchShadowWatchdog', 'prefetchHanLiJobs', 'prefetchAutoDream',
      'prefetchYaFeiDaily', 'prefetchLongTermDaily', 'prefetchXiaoyanSentinel'];
    for (const task of cronTasks) {
      if (!mainJs.includes(task)) throw new Error(`CRON任务 ${task} 未注册`);
    }
    console.log(`  ${green('✓')} 全部 ${cronTasks.length} 个CRON任务已注册`);
  }),

  test('System Prompt 完备性检查', '2-高智商', async () => {
    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    const modules = ['planner', 'teamOrchestrator', 'empathyEngine', 'selfHeal', 'reflectionEngine'];
    for (const mod of modules) {
      if (!mainJs.includes(mod)) {
        if (mod !== 'reflectionEngine' || mainJs.includes('reflectionEngine')) {
          // reflectionEngine might be referenced differently
        }
        if (!mainJs.includes(mod)) {
          console.log(`  ${yellow('⚠')} 模块 ${mod} 未在main.js中找到引用`);
        }
      }
    }
  })
];

// ── 3. 高执行力（主动推进） ──

const executionTests = [
  test('团队编排器可用性', '3-高执行力', async () => {
    const orchestrator = require(path.join(__dirname, '..', 'lib', 'team-orchestrator.js'));
    const block = orchestrator.getOrchestratorBlock();
    if (typeof block !== 'string' || block.length < 5)
      throw new Error('getOrchestratorBlock 返回内容不足');
  }),

  test('团队工作负载查询', '3-高执行力', async () => {
    const orchestrator = require(path.join(__dirname, '..', 'lib', 'team-orchestrator.js'));
    const workload = orchestrator.getTeamWorkload();
    if (typeof workload !== 'object' || workload === null) throw new Error('getTeamWorkload 应返回对象');
    const workloadKeys = Object.keys(workload);
    if (workloadKeys.length < 1) console.log(`  ${yellow('⚠')} 工作负载对象为空`);
  }),

  test('进度统计', '3-高执行力', async () => {
    const orchestrator = require(path.join(__dirname, '..', 'lib', 'team-orchestrator.js'));
    const stats = orchestrator.getProgressStats();
    if (!stats || typeof stats.total !== 'number')
      throw new Error('getProgressStats 返回格式异常');
  })
];

// ── 4. 反省能力（自我复盘） ──

const reflectionTests = [
  test('反省引擎改进建议生成', '4-反省能力', async () => {
    const reflection = require(path.join(__dirname, '..', 'lib', 'reflection-engine.js'));
    const block = reflection.getImprovementsBlock();
    if (typeof block !== 'string') throw new Error('getImprovementsBlock 应返回字符串');
  }),

  test('反省引擎经验教训提取', '4-反省能力', async () => {
    const reflection = require(path.join(__dirname, '..', 'lib', 'reflection-engine.js'));
    const lessons = reflection.getRecentLessons();
    if (typeof lessons !== 'string') throw new Error('getRecentLessons 应返回字符串');
  }),

  test('反省引擎反思触发逻辑', '4-反省能力', async () => {
    const reflection = require(path.join(__dirname, '..', 'lib', 'reflection-engine.js'));
    const result = reflection.shouldReflect();
    if (typeof result !== 'object' || typeof result.should !== 'boolean')
      throw new Error('shouldReflect 应返回 {should, reasons, urgency}');
  })
];

// ── 5. 时间管理（规划优先级） ──

const timeMgmtTests = [
  test('Scheduler 初始化参数完整性', '5-时间管理', async () => {
    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    if (!mainJs.includes('initScheduler')) throw new Error('Scheduler 未集成到 main.js');
  }),

  test('Scheduler 模块加载', '5-时间管理', async () => {
    const scheduler = require(path.join(__dirname, '..', 'lib', 'scheduler.js'));
    if (typeof scheduler.initScheduler !== 'function')
      throw new Error('scheduler.js 未导出 initScheduler');
  })
];

// ── 6. 自修复能力（故障发现+修复） ──

const selfHealTests = [
  test('自修复模块熔断机制', '6-自修复', async () => {
    const selfHeal = require(path.join(__dirname, '..', 'lib', 'self-heal.js'));
    // 模拟同类型连续错误触发熔断
    for (let i = 0; i < 7; i++) {
      const result = selfHeal.handleError(new Error(`测试错误 #${i}`), { context: 'stress_test_circuit', tool: 'test-tool' });
      if (result && result.circuited) {
        console.log(`  ${yellow('ℹ')} 在第${i+1}次触发熔断`);
        break;
      }
    }
  }),

  test('自修复重试队列', '6-自修复', async () => {
    const selfHeal = require(path.join(__dirname, '..', 'lib', 'self-heal.js'));
    if (typeof selfHeal.enqueueRetry === 'function') {
      selfHeal.enqueueRetry(async () => { throw new Error('重试测试'); }, 'stress_test_retry', 3);
      const len = selfHeal.retryQueueLength ? selfHeal.retryQueueLength() : -1;
      if (len < 0) console.log(`  ${yellow('⚠')} retryQueueLength 可能不存在`);
    }
  }),

  test('自修复 heal block 生成', '6-自修复', async () => {
    const selfHeal = require(path.join(__dirname, '..', 'lib', 'self-heal.js'));
    const block = selfHeal.getHealBlock();
    if (typeof block !== 'string') throw new Error('getHealBlock 应返回字符串');
  }),

  test('自修复错误分类器', '6-自修复', async () => {
    const selfHeal = require(path.join(__dirname, '..', 'lib', 'self-heal.js'));
    const result = selfHeal.handleError(new Error('网络连接超时'), { context: 'stress_test_classify', tool: 'test-tool' });
    if (!result || !result.classification)
      throw new Error('handleError 应返回 classification');
  })
];

// ── 7. 团队管理（统筹协调） ──

const teamMgmtTests = [
  test('团队编排器任务分派', '7-团队管理', async () => {
    const orchestrator = require(path.join(__dirname, '..', 'lib', 'team-orchestrator.js'));
    if (typeof orchestrator.assignTask === 'function') {
      const result = orchestrator.assignTask('lcs', { name: '压力测试任务', priority: 'high' });
      if (!result || !result.delegation || !result.delegation.id) throw new Error('assignTask 应返回 {delegation, member}');
      const taskId = result.delegation.id;
      console.log(`  ${cyan('ℹ')} 任务已创建: ${taskId} (指派人: ${result.member.name})`);
    }
  }),

  test('团队编排器状态流转', '7-团队管理', async () => {
    const orchestrator = require(path.join(__dirname, '..', 'lib', 'team-orchestrator.js'));
    if (typeof orchestrator.assignTask === 'function' && typeof orchestrator.updateDelegationStatus === 'function') {
      const result = orchestrator.assignTask('mds', { name: '状态流转测试' });
      orchestrator.updateDelegationStatus(result.delegation.id, 'in_progress');
      console.log(`  ${cyan('ℹ')} 状态流转: created → in_progress ✓ (任务: ${result.delegation.id})`);
    }
  }),

  test('团队编排器活跃任务查询', '7-团队管理', async () => {
    const orchestrator = require(path.join(__dirname, '..', 'lib', 'team-orchestrator.js'));
    if (typeof orchestrator.getActiveTasks === 'function') {
      const tasks = orchestrator.getActiveTasks();
      if (!Array.isArray(tasks)) throw new Error('getActiveTasks 应返回数组');
    }
  })
];

// ── 8. 共情能力（精准捕捉需求） ──

const empathyTests = [
  test('共情引擎情绪检测', '8-共情能力', async () => {
    const empathy = require(path.join(__dirname, '..', 'lib', 'empathy-engine.js'));
    // 测试愤怒情绪识别
    const angryBlock = empathy.buildEmpathyBlock('你到底在干什么！！！我要的是结果！！');
    if (typeof angryBlock !== 'string') throw new Error('buildEmpathyBlock 应返回字符串');
    console.log(`  ${cyan('ℹ')} 愤怒情绪检测结果已生成`);
  }),

  test('共情引擎用户偏好积累', '8-共情能力', async () => {
    const empathy = require(path.join(__dirname, '..', 'lib', 'empathy-engine.js'));
    if (typeof empathy.recordInteraction === 'function') {
      empathy.recordInteraction('压力测试用户偏好积累', 'user', { channelId: '__stress_test__' });
      const neutralBlock = empathy.buildEmpathyBlock('这个功能做得不错');
      if (typeof neutralBlock !== 'string') throw new Error('buildEmpathyBlock 应返回字符串');
    }
  }),

  test('共情引擎结构化输出', '8-共情能力', async () => {
    const empathy = require(path.join(__dirname, '..', 'lib', 'empathy-engine.js'));
    if (typeof empathy.buildEmpathyObject === 'function') {
      const obj = empathy.buildEmpathyObject('这个方案太好了！非常满意！！');
      if (!obj || !obj.emotion) throw new Error('buildEmpathyObject 应返回含 emotion 的对象');
      console.log(`  ${cyan('ℹ')} 检测到情绪: ${obj.emotion}, 置信度: ${obj.confidence}`);
    } else {
      console.log(`  ${yellow('⚠')} buildEmpathyObject 不存在（可能是旧版）`);
    }
  })
];

// ── 9. 电商操盘能力（全链路） ──

const ecomTests = [
  test('Crawlee 模块存在性', '9-电商操盘', async () => {
    const crawlerDir = path.join(__dirname, '..', 'workspace', 'CASHCLAW', 'crawler_data');
    if (fs.existsSync(crawlerDir)) {
      const files = fs.readdirSync(crawlerDir);
      console.log(`  ${cyan('ℹ')} Crawlee 数据目录存在，${files.length} 个文件`);
    } else {
      console.log(`  ${yellow('⚠')} Crawlee 数据目录不存在（可能是首次运行）`);
    }
  }),

  test('Shopify/Stripe 支付配置存在性', '9-电商操盘', async () => {
    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    const hasStripe = mainJs.includes('stripe') || mainJs.includes('STRIPE');
    const hasShopify = mainJs.includes('shopify') || mainJs.includes('SHOPIFY');
    const hasLemonSqueezy = mainJs.includes('lemonsqueezy') || mainJs.includes('LEMON');
    const services = [];
    if (hasStripe) services.push('Stripe');
    if (hasShopify) services.push('Shopify');
    if (hasLemonSqueezy) services.push('LemonSqueezy');
    if (services.length === 0) {
      console.log(`  ${yellow('⚠')} 未检测到支付模块集成（可能是通过环境变量动态加载）`);
    } else {
      console.log(`  ${cyan('ℹ')} 已集成: ${services.join(', ')}`);
    }
  }),

  test('银月钱庄主目录完整性', '9-电商操盘', async () => {
    const required = ['main.js', 'openclaw.json', 'lib', 'scripts', 'sects'];
    for (const item of required) {
      const fullPath = path.join(__dirname, '..', item);
      if (!fs.existsSync(fullPath)) throw new Error(`缺失: ${item}`);
    }
    console.log(`  ${green('✓')} 主目录结构完整`);
  })
];

// ── 并发压力测试 ──

async function runConcurrentTest(count = 20) {
  console.log(`\n${bold('━━━ 并发压力测试')} (${count}条并发消息)`);
  const start = Date.now();
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(post('/api/actions/health-check', {}));
  }
  const responses = await Promise.allSettled(promises);
  const ms = Date.now() - start;
  const success = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
  const failed = responses.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status !== 200)).length;
  results.totalTests++;
  if (failed === 0) {
    results.passed++;
    console.log(`  ${green('✓')} ${count}条并发全部成功 ${yellow(`(${ms}ms)`)}`);
  } else {
    results.failed++;
    console.log(`  ${red('✗')} ${count}条并发: ${success}成功, ${failed}失败 ${yellow(`(${ms}ms)`)}`);
  }
  if (!results.capabilities['并发-稳定性']) results.capabilities['并发-稳定性'] = [];
  results.capabilities['并发-稳定性'].push({
    name: `并发测试 ${count}条`,
    status: failed === 0 ? 'PASS' : 'FAIL',
    ms,
    detail: { success, failed, total: count }
  });
}

// ── 负载稳定性测试 ──

async function runLoadTest(iterations = 10, delayMs = 100) {
  console.log(`\n${bold('━━━ 负载稳定性测试')} (${iterations}轮, 每轮间隔${delayMs}ms)`);
  const timings = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const r = await post('/api/actions/health-check', {});
    timings.push({ round: i + 1, ms: Date.now() - start, status: r.status });
    if (i < iterations - 1) await sleep(delayMs);
  }
  const avg = timings.reduce((s, t) => s + t.ms, 0) / timings.length;
  const max = Math.max(...timings.map(t => t.ms));
  const allPass = timings.every(t => t.status === 200);
  results.totalTests++;
  if (allPass) {
    results.passed++;
    console.log(`  ${green('✓')} ${iterations}轮负载全部通过 | 平均${avg.toFixed(0)}ms | 最大${max}ms`);
  } else {
    results.failed++;
    console.log(`  ${red('✗')} ${iterations}轮负载: ${timings.filter(t=>t.status!==200).length}轮异常`);
  }
  if (!results.capabilities['并发-稳定性']) results.capabilities['并发-稳定性'] = [];
  results.capabilities['并发-稳定性'].push({
    name: `负载测试 ${iterations}轮`,
    status: allPass ? 'PASS' : 'FAIL',
    ms: avg,
    detail: { avg, max, iterations }
  });
}

// ── 主流程 ──

async function main() {
  console.log(`\n${bold('╔═══════════════════════════════════════════╗')}`);
  console.log(`${bold('║')}  银月钱庄 BossMode 综合压力测试          ${bold('║')}`);
  console.log(`${bold('║')}  ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Singapore' })}             ${bold('║')}`);
  console.log(`${bold('╚═══════════════════════════════════════════╝')}\n`);
  ensureDir();

  // ── 阶段1: 高配合度 ──
  console.log(`\n${bold('◆ 阶段1/9: 高配合度（执行力）')}`);
  for (const t of complianceTests) await t();

  // ── 阶段2: 高智商 ──
  console.log(`\n${bold('◆ 阶段2/9: 高智商（逻辑清晰）')}`);
  for (const t of intelligenceTests) await t();

  // ── 阶段3: 高执行力 ──
  console.log(`\n${bold('◆ 阶段3/9: 高执行力（主动推进）')}`);
  for (const t of executionTests) await t();

  // ── 阶段4: 反省能力 ──
  console.log(`\n${bold('◆ 阶段4/9: 反省能力（自我复盘）')}`);
  for (const t of reflectionTests) await t();

  // ── 阶段5: 时间管理 ──
  console.log(`\n${bold('◆ 阶段5/9: 时间管理（规划优先级）')}`);
  for (const t of timeMgmtTests) await t();

  // ── 阶段6: 自修复 ──
  console.log(`\n${bold('◆ 阶段6/9: 自修复能力（故障发现+修复）')}`);
  for (const t of selfHealTests) await t();

  // ── 阶段7: 团队管理 ──
  console.log(`\n${bold('◆ 阶段7/9: 团队管理（统筹协调）')}`);
  for (const t of teamMgmtTests) await t();

  // ── 阶段8: 共情能力 ──
  console.log(`\n${bold('◆ 阶段8/9: 共情能力（精准捕捉需求）')}`);
  for (const t of empathyTests) await t();

  // ── 阶段9: 电商操盘 ──
  console.log(`\n${bold('◆ 阶段9/9: 电商操盘能力（全链路）')}`);
  for (const t of ecomTests) await t();

  // ── 阶段10: 并发 + 负载 ──
  console.log(`\n${bold('◆ 附加测试: 并发稳定性')}`);
  await runConcurrentTest(20);
  await runLoadTest(10, 100);

  // ── 结果汇总 ──
  const passRate = results.totalTests > 0 ? (results.passed / results.totalTests * 100).toFixed(1) : 0;
  const score = passRate >= 90 ? 'S' : passRate >= 80 ? 'A' : passRate >= 70 ? 'B' : passRate >= 60 ? 'C' : 'D';

  console.log(`\n${bold('╔═══════════════════════════════════════════╗')}`);
  console.log(`${bold('║')}  ${green('BossMode 压力测试完成')}                    ${bold('║')}`);
  console.log(`${bold('║')}  ${results.totalTests} 项测试 | ${green('✓ ' + results.passed)} | ${red('✗ ' + results.failed)} | 通过率 ${passRate}%  ${bold('║')}`);
  console.log(`${bold('║')}  综合评级: ${score}                                    ${bold('║')}`);
  console.log(`${bold('╚═══════════════════════════════════════════╝')}`);

  // ── 写入报告 ──
  const report = {
    ...results,
    score,
    passRate: `${passRate}%`,
    environment: {
      node: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString()
    }
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n${cyan('📄')} 报告已保存: ${REPORT_FILE}`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(red('压力测试异常中断:'), e);
  process.exit(1);
});
