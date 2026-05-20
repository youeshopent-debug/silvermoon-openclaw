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

// ── 测试1：核心 lib 模块加载 ──
test('lib/cron.js 模块可加载且暴露关键接口', () => {
  const cron = require('../lib/cron');
  assert.ok(cron, 'cron 模块应返回对象');
  assert.strictEqual(typeof cron.register, 'function', '应暴露 register 函数');
  assert.strictEqual(typeof cron.startAll, 'function', '应暴露 startAll 函数');
  assert.strictEqual(typeof cron.registerByPath, 'function', '应暴露 registerByPath 函数');
  assert.strictEqual(typeof cron.registerPresets, 'function', '应暴露 registerPresets 函数');
});

test('lib/sanitizer.js 模块可加载', () => {
  const s = require('../lib/sanitizer');
  assert.ok(s, 'sanitizer 模块应返回对象');
  assert.strictEqual(typeof s.sanitize, 'function', '应暴露 sanitize 函数');
  assert.strictEqual(typeof s.basicClean, 'function', '应暴露 basicClean 函数');
});

test('lib/text-chunk.js 模块可加载且 splitTextToChunks 行为正确', () => {
  const { splitTextToChunks } = require('../lib/text-chunk');
  assert.strictEqual(typeof splitTextToChunks, 'function', '应暴露 splitTextToChunks');
  const chunks = splitTextToChunks('a\nb\nc', 3);
  assert.deepStrictEqual(chunks, ['a\nb', 'c']);
});

test('lib/env-parse.js 模块可加载', () => {
  const env = require('../lib/env-parse');
  assert.ok(env, 'env-parse 模块应返回对象');
});

// ── 测试2：CRON 引擎注册功能 ──
test('cron.register 能注册同步或异步 handler 且不抛异常', () => {
  const cron = require('../lib/cron');
  let ran = false;
  cron.register({ name: '_test_gateway_ok', handler: () => { ran = true; }, schedule: '9999-01-01T00:00:00' });
  assert.ok(true, '注册无异常抛出');
});

// ── 测试3：工具链模块加载 ──
test('lib/agent-tools.js 模块可加载', () => {
  const t = require('../lib/agent-tools');
  assert.ok(t, 'agent-tools 模块应返回对象');
});

test('lib/config.js 模块可加载', () => {
  const c = require('../lib/config');
  assert.ok(c, 'config 模块应返回对象');
  assert.ok(c.paths, 'config 应暴露 paths 属性');
  assert.ok(c.paths.cron, 'config.paths 应包含 cron 路径');
});

test('lib/shared-memory-bridge.js 模块可加载', () => {
  const b = require('../lib/shared-memory-bridge');
  assert.ok(b, 'shared-memory-bridge 模块应返回对象');
});

// ── 输出 ──
for (const r of results) {
  if (r.ok) console.log('  \u2705 [gateway] ' + r.name);
  else console.error('  \u274C [gateway] ' + r.name + ' \u2014 ' + r.err);
}

const failed = results.filter(r => !r.ok).length;
console.log(`  \u2192 gateway-integration: ${results.length - failed}/${results.length} \u901A\u8FC7`);
if (failed > 0) throw new Error(`gateway-integration: ${failed} \u4E2A\u6D4B\u8BD5\u5931\u8D25`);
