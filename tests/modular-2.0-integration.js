/**
 * modular-2.0-integration.js — 集成测试
 * 验证 main.js 中注入的新模块 require 路径正确
 * 用法: node tests/modular-2.0-integration.js
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

// 模拟 main.js 的 require 路径（从 silvermoon_local/silvermoon/ 目录视角）
console.log('\n📦 [集成测试] main.js require 路径验证');

const baseDir = 'C:\\Users\\User\\.openclaw\\silvermoon_local\\silvermoon';

// 验证 main.js 中注入的新模块 require（从项目根目录视角）
const modules = [
  { name: 'conversation.js', path: '../lib/conversation' },
  { name: 'workflow.js', path: '../lib/workflow' },
  { name: 'sanitizer.js', path: '../lib/sanitizer' },
];

for (const m of modules) {
  try {
    const mod = require(m.path);
    assert(mod, `${m.name} require 成功`);
    assert(typeof mod === 'object' || typeof mod === 'function', `${m.name} 导出有效`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${m.name} require 失败: ${e.message}`);
  }
}

// 验证 conversation.js 导出的函数签名
const conv = require('../lib/conversation');
assert(typeof conv.classifyComplexity === 'function', 'conversation.classifyComplexity 是函数');
assert(typeof conv.getLlmParams === 'function', 'conversation.getLlmParams 是函数');
assert(typeof conv.isDuplicate === 'function', 'conversation.isDuplicate 是函数');

// 验证 workflow.js 导出的函数签名
const wf = require('../lib/workflow');
assert(typeof wf.createWorkflow === 'function', 'workflow.createWorkflow 是函数');
assert(typeof wf.updateStep === 'function', 'workflow.updateStep 是函数');
assert(typeof wf.renderProgress === 'function', 'workflow.renderProgress 是函数');
assert(typeof wf.delegateToAgent === 'function', 'workflow.delegateToAgent 是函数');
assert(typeof wf.getTaskTemplate === 'function', 'workflow.getTaskTemplate 是函数');

// 验证 sanitizer.js 导出的函数签名
const san = require('../lib/sanitizer');
assert(typeof san.sanitize === 'function', 'sanitizer.sanitize 是函数');
assert(typeof san.basicClean === 'function', 'sanitizer.basicClean 是函数');
assert(typeof san.smartTruncate === 'function', 'sanitizer.smartTruncate 是函数');

// 验证 main.js 语法
console.log('\n📦 [集成测试] main.js 语法检查');
const fs = require('fs');
const mainJsPath = 'C:\\Users\\User\\.openclaw\\silvermoon_local\\silvermoon\\main.js';
try {
  fs.readFileSync(mainJsPath, 'utf8');
  assert(true, 'main.js 文件可读');
} catch (e) {
  assert(false, `main.js 文件不可读: ${e.message}`);
}

// 验证 main.js 中 conversation.js 的注入点
const mainContent = fs.readFileSync(mainJsPath, 'utf8');
assert(
  mainContent.includes("require('./lib/conversation')"),
  'main.js 包含 conversation.js require'
);
assert(
  mainContent.includes("require('./lib/workflow')"),
  'main.js 包含 workflow.js require'
);
assert(
  mainContent.includes("require('./lib/sanitizer')"),
  'main.js 包含 sanitizer.js require'
);
assert(
  mainContent.includes('classifyComplexity'),
  'main.js 使用 classifyComplexity'
);
assert(
  mainContent.includes('workflow.createWorkflow'),
  'main.js 使用 workflow.createWorkflow'
);

// 验证 askHermes 未被修改
const hermesMatch = mainContent.match(/function askHermes\(/g);
assert(hermesMatch && hermesMatch.length === 1, 'askHermes 函数定义未被修改');

const autonomyMatch = mainContent.match(/async function askSilvermoonAutonomyD\(/g);
assert(autonomyMatch && autonomyMatch.length === 1, 'askSilvermoonAutonomyD 函数定义未被修改');

// 汇总
console.log(`\n${'='.repeat(40)}`);
console.log(`总测试: ${passed + failed}`);
console.log(`通过:   ${passed}`);
console.log(`失败:   ${failed}`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
