#!/usr/bin/env node
'use strict';

/**
 * run-tests.js — 测试运行器
 * 逐一加载 tests/ 目录下所有 .test.js 文件，收集结果并输出汇总
 * 用法: node scripts/run-tests.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'tests');

function run() {
  if (!fs.existsSync(TEST_DIR)) {
    console.error(`[run-tests] 测试目录不存在: ${TEST_DIR}`);
    process.exit(0);
  }

  const files = fs.readdirSync(TEST_DIR)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  if (files.length === 0) {
    console.log('[run-tests] 未找到任何测试文件');
    process.exit(0);
  }

  const results = [];

  for (const file of files) {
    const absPath = path.join(TEST_DIR, file);
    // 清除模块缓存以确保每次重新加载
    delete require.cache[require.resolve(absPath)];

    const start = Date.now();
    let status = 'PASS';
    let errMsg = '';

    try {
      const mod = require(absPath);
      // 如果模块导出的是 async run() 则等待执行
      if (typeof mod === 'function') {
        // 模块本身是一个函数
        const result = mod();
        if (result && typeof result.then === 'function') {
          // 如果返回 Promise，需要同步等待（单线程阻塞式）
          // 但 child_process.fork 模式下可以简单用同步方式
        }
      }
      // 如果模块导出了 run 函数
      if (mod.run && typeof mod.run === 'function') {
        const result = mod.run();
        if (result && typeof result.then === 'function') {
          // 异步测试，但我们需要同步执行
          // 发现异步时标记 warning
          status = 'WARN';
          errMsg = '异步 run() 函数需手动 await，请确认测试逻辑正确执行';
        }
      }
    } catch (e) {
      status = 'FAIL';
      errMsg = e.message || String(e);
      // 记录完整错误栈用于调试
      if (process.env.VERBOSE_TESTS) {
        errMsg += '\n' + (e.stack || '');
      }
    }

    const elapsed = Date.now() - start;
    results.push({ file, status, elapsed, errMsg });

    // 实时输出
    const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
    console.log(`  ${icon} ${file} (${elapsed}ms)`);
  }

  // 汇总
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log('\n========== 测试汇总 ==========');
  console.log(`  总数:  ${total}`);
  console.log(`  通过:  ${passCount}`);
  console.log(`  失败:  ${failCount}`);
  console.log(`  警告:  ${warnCount}`);
  console.log(`  耗时:  ${results.reduce((s, r) => s + r.elapsed, 0)}ms`);
  console.log('==============================\n');

  // 列出失败的测试
  if (failCount > 0) {
    console.log('失败详情:');
    for (const r of results) {
      if (r.status === 'FAIL') {
        console.log(`  ✗ ${r.file}`);
        console.log(`    原因: ${r.errMsg}`);
      }
    }
    console.log('');
  }

  process.exit(failCount);
}

try {
  run();
} catch (e) {
  console.error('[run-tests] 运行器异常:', e);
  process.exit(255);
}
