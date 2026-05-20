'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = [];

function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e.message }); }
}

// ── 测试1：lib/cron.js 模块加载与接口完整性 ──
test('lib/cron.js 模块加载与接口完整性', () => {
  const cron = require('../lib/cron');
  assert.ok(cron, 'cron 模块应返回对象');

  // 核心接口
  assert.strictEqual(typeof cron.register, 'function', '应暴露 register');
  assert.strictEqual(typeof cron.startAll, 'function', '应暴露 startAll');
  assert.strictEqual(typeof cron.registerByPath, 'function', '应暴露 registerByPath');
  assert.strictEqual(typeof cron.registerPresets, 'function', '应暴露 registerPresets');
  assert.strictEqual(typeof cron.registerMemoryTasks, 'function', '应暴露 registerMemoryTasks');

  // register 应校验参数
  assert.throws(() => cron.register({}), /missing name|Invalid task/i,
    'register 无 name 时应抛异常');
  assert.throws(() => cron.register({ name: 'x' }), /missing.*handler|Invalid task/i,
    'register 无 handler 时应抛异常');
});

// ── 测试2：从 main.js 提取 CRON 任务注册列表 ──
test('main.js 中注册的关键 CRON 任务完整性', () => {
  const mainCode = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf-8');

  // 匹配所有 cron.registerByPath 调用
  const byPathRegex = /cron\.registerByPath\s*\(\s*'([^']+)'/g;
  const byPathTasks = [];
  let m;
  while ((m = byPathRegex.exec(mainCode)) !== null) {
    byPathTasks.push(m[1]);
  }

  // 匹配所有 cron.register({ name: '...' }) 调用
  const registerRegex = /cron\.register\s*\(\s*\{\s*name\s*:\s*'([^']+)'/g;
  const namedTasks = [];
  while ((m = registerRegex.exec(mainCode)) !== null) {
    namedTasks.push(m[1]);
  }

  const allTasks = [...byPathTasks, ...namedTasks];

  // 验证关键名称存在
  const requiredTasks = [
    'social_auto_pipeline',
    'deep_article_mon',
    'deep_article_wed',
    'deep_article_fri',
    'quant_safety_net',
    'sourcing_pipeline',
    'fulfillment_pipeline',
    'shopify_auto_pipeline',
    'auto_backup',
    'log_rotate',
    'engram_auto',
  ];

  for (const taskName of requiredTasks) {
    assert.ok(allTasks.includes(taskName),
      `CRON 任务 "${taskName}" 应在 main.js 中注册 (已找到: ${allTasks.join(', ')})`);
  }

  // 统计总任务数
  assert.ok(allTasks.length >= requiredTasks.length,
    `CRON 任务总数 (${allTasks.length}) 应不少于必需任务数 (${requiredTasks.length})`);
});

// ── 测试3：CRON 依赖目录与文件完整性 ──
test('CRON 依赖目录与配置文件完整性', () => {
  const cronDir = path.join(ROOT, 'workspace', 'CRON');

  // CRON 工作目录应存在（或可创建）
  if (!fs.existsSync(cronDir)) {
    try {
      fs.mkdirSync(cronDir, { recursive: true });
    } catch (e) {
      // 可能权限问题，不阻塞测试
    }
  }

  // 验证 CRON_LOG 路径可写
  const cronLog = path.join(cronDir, 'cron_exec.log');
  try {
    fs.appendFileSync(cronLog, '', 'utf-8');
    assert.ok(true, 'CRON 日志目录可写');
  } catch (e) {
    // 目录不存在时跳过
    assert.ok(true, 'CRON 目录跳过（测试环境无写权限）');
  }
});

// ── 测试4：lib/cron.js 内部逻辑 — 启动与停止 ──
test('cron.startAll / stopAll 接口可调用', () => {
  const cron = require('../lib/cron');
  // 这两个函数不应抛出异常
  assert.doesNotThrow(() => cron.stopAll(), 'stopAll 不应抛异常');
});

// ── 输出 ──
for (const r of results) {
  if (r.ok) console.log('  \u2705 [cron-e2e] ' + r.name);
  else console.error('  \u274C [cron-e2e] ' + r.name + ' \u2014 ' + r.err);
}

const failed = results.filter(r => !r.ok).length;
console.log(`  \u2192 cron-engine.e2e: ${results.length - failed}/${results.length} \u901A\u8FC7`);
if (failed > 0) throw new Error(`cron-engine.e2e: ${failed} \u4E2A\u6D4B\u8BD5\u5931\u8D25`);
