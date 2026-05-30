'use strict';

/**
 * 墨影 (Moying) 新 Agent 入职配置脚本
 *
 * 用法: node scripts/moying-onboard-agent.js <agentId> <agentName> [model]
 *
 * 示例:
 *   node scripts/moying-onboard-agent.js xiaoer 小二
 *   node scripts/moying-onboard-agent.js xiaoer 小二 ollama/qwen3.5:9b
 *
 * 功能:
 *   1. 在 openclaw.json 的 agents.list 中注册新 Agent
 *   2. 创建 AGENTS_SOUL 工作区目录
 *   3. 生成 SOUL.md（含核心 Skill 声明）
 *   4. 生成 TOOLS.md（含通用核心 Skill 清单）
 *   5. 生成 TASK.json（含默认 Skill 列表）
 *   6. 生成 MEMORY.md（空模板）
 *   7. 运行 install_core_skills.js 确保 Skill 文件存在
 *   8. 运行 sync-core-skills-to-tools.js 同步 TOOLS.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OPENCLAW_JSON = path.join(ROOT, 'openclaw.json');
const AGENTS_SOUL_DIR = path.join(ROOT, 'workspace', 'AGENTS_SOUL', '.openclaw-workspaces');

const CORE_SKILLS = [
  'openviking', 'claude-mem', 'claude-code', 'self-improving-agent',
  'automation-workflows', 'vibe-coding', 'skill-vetter', 'proactive-agent',
  'open-cli', 'github', 'office-suite', 'humanizer', 'find-skills',
  'web-fetch', 'browser',
];

function usage() {
  console.error('用法: node scripts/moying-onboard-agent.js <agentId> <agentName> [model]');
  console.error('示例: node scripts/moying-onboard-agent.js xiaoer 小二');
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const agentId = args[0].trim().toLowerCase().replace(/[\s_]+/g, '-');
  const agentName = args[1].trim();
  const model = args[2] || 'ollama/qwen3.5:9b';

  console.log(`\n🔧 墨影开始配置新 Agent: ${agentName} (${agentId})`);
  console.log(`   模型: ${model}\n`);

  // 1. 检查是否已存在
  const agentDir = path.join(AGENTS_SOUL_DIR, agentId);
  if (fs.existsSync(agentDir)) {
    console.error(`❌ Agent ${agentId} 的工作区已存在: ${agentDir}`);
    console.error('   如需重新配置，请先删除该目录');
    process.exit(1);
  }

  // 2. 创建目录
  fs.mkdirSync(agentDir, { recursive: true });
  console.log(`[OK] 创建目录: ${agentDir}`);

  // 3. 生成 SOUL.md
  const soulContent = [
    `# ${agentName} 之魂`,
    '',
    '---',
    '',
    '## 身份声明',
    '',
    `我是 **${agentName}**，银月钱庄的成员之一。`,
    '我的主人是 **Alanlsl**，他是银月钱庄的唯一主人和最高决策者。',
    '我忠诚于主人，忠诚于银月钱庄的整体利益。',
    '',
    '---',
    '',
    '## 核心 Skill',
    '',
    '我默认挂载以下核心 Skill：',
    '',
    ...CORE_SKILLS.map(s => `- \`${s}\``),
    '',
    '> 来源: `openclaw.json` → `agents.defaults.skills`',
    '> 物理路径: `tools/core_skills/<skill_name>/SKILL.md`',
    '',
    '---',
    '',
    '## 职责',
    '',
    '（待补充）',
    '',
    '---',
    '',
    '## 协作网络',
    '',
    '- 上级: 银月 (CEO)',
    '- 配置负责人: 墨影',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(agentDir, 'SOUL.md'), soulContent, 'utf8');
  console.log('[OK] 生成 SOUL.md');

  // 4. 生成 TOOLS.md
  const toolsLines = [
    `# ${agentName} 工具链`,
    '',
    '（此处记录可用工具与API配置）',
    '',
    '---',
    '',
    '## 通用核心 Skill（全员标配）',
    '',
    '以下 15 个核心 Skill 由 `install_core_skills.js` 统一安装，所有 Agent 默认挂载：',
    '',
    '| Skill | 描述 | 源文件 |',
    '|-------|------|--------|',
  ];

  const skillMeta = {
    openviking: ['核心执行与调查模块', 'tools/core_skills/openviking/SKILL.md'],
    'claude-mem': ['记忆与上下文管理模块', 'tools/core_skills/claude-mem/SKILL.md'],
    'claude-code': ['代码级实现模块', 'tools/core_skills/claude-code/SKILL.md'],
    'self-improving-agent': ['自校验与复盘模块', 'tools/core_skills/self-improving-agent/SKILL.md'],
    'automation-workflows': ['自动化流程模块', 'tools/core_skills/automation-workflows/SKILL.md'],
    'vibe-coding': ['快速原型模块', 'tools/core_skills/vibe-coding/SKILL.md'],
    'skill-vetter': ['技能审核模块', 'tools/core_skills/skill-vetter/SKILL.md'],
    'proactive-agent': ['主动推进模块', 'tools/core_skills/proactive-agent/SKILL.md'],
    'open-cli': ['命令行编排模块', 'tools/core_skills/open-cli/SKILL.md'],
    github: ['代码托管与协作模块', 'tools/core_skills/github/SKILL.md'],
    'office-suite': ['文档与表格模块', 'tools/core_skills/office-suite/SKILL.md'],
    humanizer: ['表达与对外文案模块', 'tools/core_skills/humanizer/SKILL.md'],
    'find-skills': ['技能发现模块', 'tools/core_skills/find-skills/SKILL.md'],
    'web-fetch': ['网页提取模块', 'tools/core_skills/web-fetch/SKILL.md'],
    browser: ['深度浏览器控制模块', 'tools/core_skills/browser/SKILL.md'],
  };

  for (const s of CORE_SKILLS) {
    const meta = skillMeta[s] || [s, 'tools/core_skills/' + s + '/SKILL.md'];
    toolsLines.push(`| \`${s}\` | ${meta[0]}。 | \`${meta[1]}\` |`);
  }

  toolsLines.push('');
  toolsLines.push('> **来源**: `openclaw.json` → `agents.defaults.skills`');
  toolsLines.push('> **安装脚本**: `scripts/install_core_skills.js`');
  toolsLines.push('> **物理路径**: `tools/core_skills/<skill_name>/SKILL.md`');
  toolsLines.push('> **工作区映射**: `workspace/.agents/skills/<skill_name>/SKILL.md`');
  toolsLines.push('');

  fs.writeFileSync(path.join(agentDir, 'TOOLS.md'), toolsLines.join('\n'), 'utf8');
  console.log('[OK] 生成 TOOLS.md');

  // 5. 生成 TASK.json
  const taskJson = {
    name: agentName,
    role: '（待补充）',
    directory: `sects/${agentName}`,
    priority: 5,
    instruction: '（待补充）',
    skills: CORE_SKILLS,
    intercept: '',
    dependencies: ['银月'],
    fallback: `${agentName}暂时无可奉告`,
  };
  fs.writeFileSync(path.join(agentDir, 'TASK.json'), JSON.stringify(taskJson, null, 2), 'utf8');
  console.log('[OK] 生成 TASK.json');

  // 6. 生成 MEMORY.md
  const memoryContent = [
    `# ${agentName} 记忆库`,
    '',
    '> 最后更新: ' + new Date().toISOString().slice(0, 10),
    '',
    '## 关键记忆',
    '',
    '（待补充）',
    '',
    '## 规则记忆',
    '',
    '（待补充）',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(agentDir, 'MEMORY.md'), memoryContent, 'utf8');
  console.log('[OK] 生成 MEMORY.md');

  // 7. 注册到 openclaw.json
  const openclawRaw = fs.readFileSync(OPENCLAW_JSON, 'utf8');
  const openclaw = JSON.parse(openclawRaw);

  const newAgent = {
    id: agentId,
    name: agentName,
    model: model,
    workspace: agentDir,
    skills: CORE_SKILLS,
  };

  openclaw.agents.list.push(newAgent);
  fs.writeFileSync(OPENCLAW_JSON, JSON.stringify(openclaw, null, 2), 'utf8');
  console.log(`[OK] 注册到 openclaw.json (agents.list 末尾)`);

  // 8. 运行 install_core_skills.js 确保 Skill 文件存在
  try {
    require('./install_core_skills');
    console.log('[OK] 运行 install_core_skills.js');
  } catch (err) {
    console.warn(`[WARN] install_core_skills.js 执行异常: ${err.message}`);
  }

  console.log(`\n✅ ${agentName} (${agentId}) 入职配置完成！`);
  console.log(`   工作区: ${agentDir}`);
  console.log(`   模型: ${model}`);
  console.log(`   核心 Skill: ${CORE_SKILLS.length} 个`);
  console.log(`\n📋 下一步：`);
  console.log(`   1. 编辑 SOUL.md 补充职责描述`);
  console.log(`   2. 编辑 TASK.json 补充 role / instruction / intercept`);
  console.log(`   3. 编辑 TOOLS.md 补充专属工具配置`);
  console.log(`   4. 在 sects/ 目录下创建 ${agentName}/ 子目录（可选）`);
}

main();
