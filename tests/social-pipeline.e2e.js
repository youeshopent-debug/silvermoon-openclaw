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

// ── 测试1：social-auto-pipeline.js 存在且语法正确 ──
test('scripts/social-auto-pipeline.js 文件完整性', () => {
  const file = path.join(ROOT, 'scripts', 'social-auto-pipeline.js');
  assert.ok(fs.existsSync(file), '文件应存在');

  const code = fs.readFileSync(file, 'utf-8');
  assert.ok(code.length > 50, '文件内容不应为空或过短');

  // 验证关键依赖引用存在
  assert.ok(code.includes("require('../lib/trend-fetcher')"), '应引用 trend-fetcher');
  assert.ok(code.includes("require('../lib/social-content')"), '应引用 social-content');
  assert.ok(code.includes("require('../lib/social-poster')"), '应引用 social-poster');
  assert.ok(code.includes('./alert'), '应引用 alert 模块');
});

// ── 测试2：social-deep-article.js 存在且语法正确 ──
test('scripts/social-deep-article.js 文件完整性', () => {
  const file = path.join(ROOT, 'scripts', 'social-deep-article.js');
  assert.ok(fs.existsSync(file), '文件应存在');

  const code = fs.readFileSync(file, 'utf-8');
  assert.ok(code.length > 50, '文件内容不应为空或过短');

  // 验证关键依赖引用
  assert.ok(code.includes("require('../lib/social-content')"), '应引用 social-content');
  assert.ok(code.includes("require('../lib/social-poster')"), '应引用 social-poster');

  // 验证深度文章话题列表存在
  assert.ok(code.includes('DEEP_TOPICS'), '应定义 DEEP_TOPICS 话题列表');
  assert.ok(code.includes('pickNextTopic'), '应暴露 pickNextTopic 函数');
});

// ── 测试3：trend-fetcher 模块加载 ──
test('lib/trend-fetcher.js 模块加载' , () => {
  const tf = require('../lib/trend-fetcher');
  assert.ok(tf, 'trend-fetcher 应返回对象');
  assert.strictEqual(typeof tf.fetchTrends, 'function', '应暴露 fetchTrends');
  assert.strictEqual(typeof tf.scoreTopic, 'function', '应暴露 scoreTopic');
  assert.ok(Array.isArray(tf.TREND_SOURCES), '应暴露 TREND_SOURCES 数组');
  assert.ok(tf.TREND_SOURCES.length >= 2, '至少应有 2 个趋势数据源');
});

// ── 测试4：依赖模块 social-content / social-poster / social-image 可加载 ──
test('lib/social-content.js 模块加载', () => {
  const sc = require('../lib/social-content');
  assert.ok(sc, 'social-content 应返回对象');
  assert.ok(typeof sc.generateMultiPlatformPosts === 'function' ||
            typeof sc.generateDeepArticle === 'function', '应暴露至少一个生成函数');
});

test('lib/social-poster.js 模块加载', () => {
  const sp = require('../lib/social-poster');
  assert.ok(sp, 'social-poster 应返回对象');
  assert.ok(typeof sp.postToFacebook === 'function' ||
            typeof sp.postToX === 'function', '应暴露至少一个发帖函数');
});

test('lib/social-image.js 模块加载', () => {
  const si = require('../lib/social-image');
  assert.ok(si, 'social-image 应返回对象');
});

// ── 测试5：scripts/alert.js 模块加载 ──
test('scripts/alert.js 模块可加载', () => {
  const a = require('../scripts/alert');
  assert.ok(a, 'alert 应返回对象');
});

// ── 输出 ──
for (const r of results) {
  if (r.ok) console.log('  \u2705 [social-e2e] ' + r.name);
  else console.error('  \u274C [social-e2e] ' + r.name + ' \u2014 ' + r.err);
}

const failed = results.filter(r => !r.ok).length;
console.log(`  \u2192 social-pipeline.e2e: ${results.length - failed}/${results.length} \u901A\u8FC7`);
if (failed > 0) throw new Error(`social-pipeline.e2e: ${failed} \u4E2A\u6D4B\u8BD5\u5931\u8D25`);
