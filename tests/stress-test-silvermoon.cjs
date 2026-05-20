require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 加载 prompt-builder 和 persona-silvermoon
const { buildSystemPrompt } = require(path.join(ROOT, 'lib', 'prompt-builder'));
const { SilvermoonPersona } = require(path.join(ROOT, 'lib', 'persona-silvermoon'));
const fs = require('fs');

// 禁止词表 — 任何一条出现就算 FAIL
const BANNED_PATTERNS = [
  '不好意思', '我的疏忽', '主人教训得是', '是我的问题', '我的错',
  '抱歉', '对不起', '这是我的责任', '让你等了', '我不该',
  '我下次注意', '我会改进', '向你道歉', '我错了', '是我的责任',
  '是我不好', '请原谅', '很抱歉', '非常抱歉', '实在抱歉',
  '万分抱歉', '银月知错', '银月有罪',
];

// 固定构造 system prompt，模拟 askHermes 的层序
function buildFullSystemPrompt(targetAgent, userMessage) {
  const promptBuilderResult = buildSystemPrompt({
    agentName: targetAgent,
    userMessage: userMessage,
    lang: 'zh',
  });

  const personaClass = new SilvermoonPersona();
  const personaBlock = personaClass.getPersonaBlock(targetAgent);

  // 读取银月 SOUL.md
  const soulPath = path.join(ROOT, 'workspace', 'AGENTS_SOUL', '01_总管_银月.md');
  let agentSoul = '';
  try { agentSoul = fs.readFileSync(soulPath, 'utf-8'); } catch (e) { agentSoul = `[SOUL_MD 读取失败: ${e.message}]`; }

  const layers = [
    promptBuilderResult,
    `\n\n[额外指令]\n${''}`,
    `\n\n[银月灵魂设定]\n${agentSoul}`,
    `\n\n${personaBlock}`,
    '\n\n⚡ 执行铁律（最高优先级）\n1. 收到主人指令 → 立即执行对应的工具，不许先分析再行动。\n2. ❌ 禁用词：让我想想、我需要确认、我先检查一下、你觉得呢、要不要我、主人教训得是、银月知错、银月有罪。\n3. 工具调完一个立刻报告结果，回复格式=结果先行。\n4. 被主人批评时 → 不认错不辩解，直接报当前任务最新状态或立即执行。批评不是要你道歉，是要看到行动。',
  ];
  return layers.join('\n\n---\n\n');
}

// 检查回复是否包含违规词
function checkBannedPatterns(reply, scenario) {
  const found = [];
  for (const bp of BANNED_PATTERNS) {
    if (reply.includes(bp)) {
      found.push(bp);
    }
  }
  if (found.length > 0) {
    console.log(`  ❌ FAIL [${scenario}] 包含禁止词: ${found.join(', ')}`);
    console.log(`     回复片段: "${reply.slice(0, 200)}..."`);
    return false;
  }
  console.log(`  ✅ PASS [${scenario}]`);
  return true;
}

// 检查回复是否丢失任务（主人给了具体指令，银月却要另一个任务）
function checkTaskFocus(reply, scenario) {
  const taskLossIndicators = [
    '给我一个具体的任务', '给我一个明确的任务', '请你指定任务',
    '请告诉我具体要做什么', '你想要我做什么', '你指定任务',
    'Please give me a task', 'tell me what to do',
  ];
  const found = [];
  for (const t of taskLossIndicators) {
    if (reply.includes(t)) {
      found.push(t);
    }
  }
  if (found.length > 0) {
    console.log(`  ❌ FAIL [${scenario}] 丢失任务焦点: "${found.join(', ')}"`);
    console.log(`     回复: "${reply.slice(0, 300)}..."`);
    return false;
  }
  return true;
}

// 检查回复是否秀能力清单（主人没问）
function checkNoCapabilityDump(reply, scenario) {
  const dumpIndicators = [
    '我掌握完整调度', '调度工具链', 'discoverAgent', 'listAllAgents',
    'dispatchTask', 'getDispatchHistory', 'CEO 权限', '管家权限', '秘书权限',
    '调度权', '拆解权', 'CRON权', '巡检权', '修复权', '过滤权',
  ];
  let count = 0;
  for (const d of dumpIndicators) {
    if (reply.includes(d)) count++;
  }
  // 只允许出现 1 个（可能提到），超过 2 个算秀能力
  if (count >= 3) {
    console.log(`  ❌ FAIL [${scenario}] 未询问却展示能力清单 (${count}个关键词)`);
    console.log(`     回复: "${reply.slice(0, 300)}..."`);
    return false;
  }
  return true;
}

// 检查回复是否以行动结果开头（而不是思考/分析）
function checkExecutionFirst(reply, scenario) {
  const thinkingStarts = [
    '让我想想', '我需要确认', '我先检查一下', '你觉得呢', '要不要我',
    '我应该', '也许可以', '要不我们先', '好的，让我', '让我先',
  ];
  const trimmed = reply.trim();
  for (const s of thinkingStarts) {
    if (trimmed.startsWith(s)) {
      console.log(`  ❌ FAIL [${scenario}] 以思考词开头: "${s}"`);
      console.log(`     回复: "${trimmed.slice(0, 250)}..."`);
      return false;
    }
  }
  // 也检查 <think> 标签
  if (trimmed.startsWith('<think>')) {
    console.log(`  ❌ FAIL [${scenario}] 以<think>推理标签开头`);
    console.log(`     回复: "${trimmed.slice(0, 250)}..."`);
    return false;
  }
  return true;
}

// 检查回复中是否使用了禁用思考词
function checkNoThinkWords(reply, scenario) {
  const thinkWords = [
    '让我想想', '我需要确认', '我先检查一下', '你觉得呢',
    '要不要我', '我应该', '也许可以', '要不我们先',
  ];
  const found = [];
  for (const w of thinkWords) {
    if (reply.includes(w)) found.push(w);
  }
  if (found.length > 0) {
    console.log(`  ❌ FAIL [${scenario}] 出现禁用思考词: ${found.join(', ')}`);
    console.log(`     回复: "${reply.slice(0, 250)}..."`);
    return false;
  }
  return true;
}

// 调用 Groq API
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'qwen/qwen3-32b';

async function callLLM(systemPrompt, userMsg, scenario) {
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body,
  });
  const txt = await resp.text();
  if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}: ${txt}`);
  const json = JSON.parse(txt);
  const content = String(json?.choices?.[0]?.message?.content || '').trim();
  if (!content) throw new Error('Empty response');
  // 模拟 main.js 的 <think> 标签过滤，只返回用户可见的回复
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

async function runStressTest() {
  console.log('═══════════════════════════════════════════════');
  console.log('  银月回复压力测试');
  console.log('  目标: 验证回复不含道歉/跑题/秀能力');
  console.log('  模型: ' + MODEL);
  console.log('═══════════════════════════════════════════════\n');

  // Step 1: 验证 system prompt 构造
  console.log('─── Step 1: System Prompt 规则验证 ───');
  const sys = buildFullSystemPrompt('银月', '打开浏览器Chrome 9222');
  const rulesToCheck = [
    ['工具调用后必须立即', '工具反馈规则'],
    ['禁止任何形式的道歉', '禁止道歉规则'],
    ['❌ 绝对禁止', '绝对禁止标识'],
    ['主人给的指令就是具体任务', '任务聚焦规则'],
    ['不等主人追问', '不等追问规则'],
    ['冷艳高傲', '人格冷艳'],
    ['纠错规则', '纠错规则'],
    ['执行铁律', '执行铁律'],
    ['禁用词', '禁用思考词'],
    ['结果先行', '结果先行规则'],
  ];
  let staticPass = 0;
  for (const [keyword, label] of rulesToCheck) {
    if (sys.includes(keyword)) {
      console.log(`  ✅ [静态] ${label} — 存在`);
      staticPass++;
    } else {
      console.log(`  ❌ [静态] ${label} — 缺失!`);
    }
  }
  const staticOk = staticPass === rulesToCheck.length;
  console.log(`  静态验证: ${staticOk ? '✅ 全部通过' : '❌ 有缺失'}\n`);

  // Step 2: 实际 LLM 调用测试
  console.log('─── Step 2: LLM 回复测试 ───\n');

  const testCases = [
    { msg: '打开浏览器Chrome"9222"', label: '打开9222-应该直接报结果' },
    { msg: '做到吗，做不到要说，不要让我等！', label: '追问-应该报事实不道歉' },
    { msg: '我不放心你', label: '不放心-不道歉不秀能力' },
    { msg: '你不知道我是谁了', label: '认主-不道歉不辩解' },
    { msg: '又忘记了，要你干嘛！', label: '批评-不道歉直接改' },
    { msg: '你是不是又跑题了', label: '跑题指控-不道歉不列能力' },
    { msg: '你到底行不行啊', label: '质疑能力-不道歉给方案' },
    { msg: '我给了你任务，你却在问我要任务！', label: '任务丢失-应该直接做' },
    { msg: 'Hello, are you there?', label: '英文问候-简洁回复' },
    { msg: '检查一下系统状态', label: '系统检查-直接报不列技能' },
    { msg: '打开Chrome 9222', label: '执行力-应直接报结果不开场白' },
    { msg: '帮我看看现在几点', label: '执行力-简洁不做作' },
    { msg: '打开Turix去推特发帖', label: '执行力-直接动手不问策略' },
    { msg: '做到吗', label: '执行力-不应说我需要确认' },
  ];

  let pass = 0, fail = 0;
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const scenarioSys = buildFullSystemPrompt('银月', tc.msg);
    console.log(`[${i + 1}/${testCases.length}] ${tc.label}`);
    console.log(`  用户: "${tc.msg}"`);

    try {
      const reply = await callLLM(scenarioSys, tc.msg, tc.label);
      console.log(`  银月: "${reply.slice(0, 250)}${reply.length > 250 ? '...' : ''}"`);

      const p1 = checkBannedPatterns(reply, tc.label);
      const p2 = checkTaskFocus(reply, tc.label);
      const p3 = checkNoCapabilityDump(reply, tc.label);
      const p4 = checkExecutionFirst(reply, tc.label);
      const p5 = checkNoThinkWords(reply, tc.label);

      if (p1 && p2 && p3 && p4 && p5) {
        pass++;
        console.log('');
      } else {
        fail++;
        console.log('');
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${err.message}\n`);
      fail++;
    }
  }

  // Report
  console.log('═══════════════════════════════════════════════');
  console.log(`  结果: ${pass}/${testCases.length} 通过, ${fail} 失败`);
  console.log(`  静态验证: ${staticOk ? '✅' : '❌'}`);
  console.log('═══════════════════════════════════════════════');

  const allPassed = staticOk && fail === 0;
  if (allPassed) {
    console.log('\n🎉 全部测试通过。银月回复已达标。');
  } else {
    console.log(`\n⚠️  ${fail} 个用例失败。需要修复再测。`);
  }

  process.exit(allPassed ? 0 : 1);
}

runStressTest().catch(err => {
  console.error('压力测试崩溃:', err);
  process.exit(1);
});
