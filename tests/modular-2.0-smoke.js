/**
 * modular-2.0-smoke.js — OpenClaw 2.0 模块化重构冒烟测试
 * 纯 Node.js 运行，不依赖任何测试框架
 * 用法: node tests/modular-2.0-smoke.js
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label} — expected "${expected}", got "${actual}"`);
  }
}

function assertMatch(actual, regex, label) {
  if (regex.test(actual)) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label} — "${actual}" does not match ${regex}`);
  }
}

// ─── 1. conversation.js ─────────────────────────────────────

console.log('\n📦 [conversation.js] 对话分级测试');

const { classifyComplexity, getLlmParams, isDuplicate } = require('../lib/conversation');

// Level 0: 问候
let r = classifyComplexity('在吗');
assertEqual(r.level, 0, 'Level 0: "在吗"');
assert(r.quickReply, 'Level 0: quickReply 存在');

r = classifyComplexity('hi');
assertEqual(r.level, 0, 'Level 0: "hi"');

r = classifyComplexity('晚安');
assertEqual(r.level, 0, 'Level 0: "晚安"');

r = classifyComplexity('ok');
assertEqual(r.level, 0, 'Level 0: "ok"');

// Level 1: 简单查询
r = classifyComplexity('今天天气怎么样');
assertEqual(r.level, 1, 'Level 1: "今天天气怎么样"');

r = classifyComplexity('现在几点');
assertEqual(r.level, 1, 'Level 1: "现在几点"');

// Level 2: 一般对话
r = classifyComplexity('帮我分析一下最近的比特币走势，我觉得有点看不懂');
assertEqual(r.level, 2, 'Level 2: 含分析关键词');

// Level 3: 深度任务
r = classifyComplexity('帮我分析并设计一个数据库架构方案，需要对比几种方案');
assertEqual(r.level, 3, 'Level 3: 深度任务（分析+设计+架构+方案）');

r = classifyComplexity('写一个完整的项目重构方案，包括架构设计、数据库规划和部署策略');
assertEqual(r.level, 3, 'Level 3: 深度任务（重构+架构+数据库+部署）');

// getLlmParams
let p = getLlmParams(0);
assertEqual(p.maxTokens, 64, 'Level 0 maxTokens=64');
assertEqual(p.retrieveContext, false, 'Level 0 retrieveContext=false');

p = getLlmParams(3);
assertEqual(p.maxTokens, 1024, 'Level 3 maxTokens=1024');
assertEqual(p.retrieveContext, true, 'Level 3 retrieveContext=true');

// isDuplicate
assertEqual(isDuplicate('test-channel', 'hello'), false, 'isDuplicate: 首次发送不重复');
assertEqual(isDuplicate('test-channel', 'hello'), true, 'isDuplicate: 5秒内重复发送检测');
assertEqual(isDuplicate('test-channel', 'world'), false, 'isDuplicate: 不同内容不重复');

// ─── 2. workflow.js ─────────────────────────────────────────

console.log('\n📦 [workflow.js] 工作流编排测试');

const workflow = require('../lib/workflow');

// 创建工作流
const steps = [
  { id: 'fetch', label: '获取数据' },
  { id: 'analyze', label: '分析趋势' },
  { id: 'report', label: '生成报告' },
];
const wf = workflow.createWorkflow('test-channel', steps, 'zh', { title: '行情分析' });
assert(wf, 'createWorkflow 返回对象');
assertEqual(wf.steps.length, 3, 'workflow 有 3 个步骤');
assertEqual(wf.steps[0].status, '⬜', '初始状态为 ⬜');

// 更新步骤
workflow.updateStep('test-channel', 'fetch', 'running', '正在获取...');
assertEqual(wf.steps[0].status, '🔄', '更新为 🔄');
assertEqual(wf.steps[0].detail, '正在获取...', 'detail 正确');

workflow.updateStep('test-channel', 'fetch', 'done', '获取完成');
assertEqual(wf.steps[0].status, '✅', '更新为 ✅');

// 渲染进度
const progress = workflow.renderProgress('test-channel');
assert(progress, 'renderProgress 返回内容');
assert(progress.includes('行情分析'), '进度包含标题');
assert(progress.includes('✅'), '进度包含完成标记');

// 任务模板
const devSteps = workflow.getTaskTemplate('development', 'zh');
assertEqual(devSteps.length, 4, '开发模板有 4 步');
assertEqual(devSteps[0].label, '制定方案', '开发模板第一步');

const finSteps = workflow.getTaskTemplate('finance', 'en');
assertEqual(finSteps.length, 3, '金融模板有 3 步');
assertEqual(finSteps[0].label, 'Fetch Data', '金融模板英文');

// ─── 3. sanitizer.js ────────────────────────────────────────

console.log('\n📦 [sanitizer.js] 后处理管道测试');

const { sanitize, basicClean, stripBotTemplateLines, dedupeConsecutive, enforceNoBusyPlaceholders, smartTruncate } = require('../lib/sanitizer');

// basicClean
assertEqual(basicClean('  hello\r\nworld  \n\n\n'), 'hello\nworld', 'basicClean 标准化换行');

// stripBotTemplateLines
let cleaned = stripBotTemplateLines('你好！我是AI助手。\n我听到你的反馈了。\n这是实际内容。');
assertEqual(cleaned, '这是实际内容。', 'stripBotTemplateLines 移除模板行');

// dedupeConsecutive
assertEqual(dedupeConsecutive('a\nb\nb\nc'), 'a\nb\nc', 'dedupeConsecutive 去重连续行');

// enforceNoBusyPlaceholders
let busy = enforceNoBusyPlaceholders('请稍等，我正在查找。');
assert(busy.includes('我不会用'), 'enforceNoBusyPlaceholders 拦截空话');

busy = enforceNoBusyPlaceholders('请稍等，我正在查找：https://example.com');
assertEqual(busy, '请稍等，我正在查找：https://example.com', '有证据时不拦截');

// smartTruncate
let long = '```js\nconsole.log("hello");\n' + 'a'.repeat(2000);
let truncated = smartTruncate(long, { charLimit: 100 });
assert(truncated.endsWith('```'), 'smartTruncate 闭合代码块');

// sanitize 空输入
assertEqual(sanitize(''), '主人，银月内阁暂时无可奉告。', 'sanitize 空输入返回默认');

// sanitize 正常输入
let normal = sanitize('这是一条正常的回复内容。');
assert(normal.includes('这是一条正常的回复内容'), 'sanitize 保留正常内容');

// sanitize 1500 字符限制
let longText = 'a'.repeat(2000);
let short = sanitize(longText);
assert(short.length <= 1500, `sanitize 限制 1500 字符 (实际 ${short.length})`);

// ─── 4. 模块加载完整性 ──────────────────────────────────────

console.log('\n📦 [模块加载] 11 个核心模块完整性测试');

const modules = [
  { name: 'intent.js', path: '../lib/intent' },
  { name: 'memory.js', path: '../lib/memory' },
  { name: 'prompt-builder.js', path: '../lib/prompt-builder' },
  { name: 'sanitizer.js', path: '../lib/sanitizer' },
  { name: 'tool-router.js', path: '../lib/tool-router' },
  { name: 'agents.js', path: '../lib/agents' },
  { name: 'cron.js', path: '../lib/cron' },
  { name: 'weather.js', path: '../lib/weather' },
  { name: 'conversation.js', path: '../lib/conversation' },
  { name: 'workflow.js', path: '../lib/workflow' },
];

for (const m of modules) {
  try {
    const mod = require(m.path);
    assert(mod, `${m.name} 加载成功`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${m.name} 加载失败: ${e.message}`);
  }
}

// ─── 汇总 ───────────────────────────────────────────────────

console.log(`\n${'='.repeat(40)}`);
console.log(`总测试: ${passed + failed}`);
console.log(`通过:   ${passed}`);
console.log(`失败:   ${failed}`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
