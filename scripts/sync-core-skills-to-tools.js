'use strict';

const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'workspace', 'AGENTS_SOUL', '.openclaw-workspaces');

const CORE_SKILLS = [
  { name: 'openviking', desc: '核心执行与调查模块。需要强执行、强落地、强排障时调用。', file: 'tools/core_skills/openviking/SKILL.md' },
  { name: 'claude-mem', desc: '记忆与上下文管理模块。需要固化规则/提炼可复用信息时调用。', file: 'tools/core_skills/claude-mem/SKILL.md' },
  { name: 'claude-code', desc: '代码级实现模块。需要写代码/改配置/加测试时调用。', file: 'tools/core_skills/claude-code/SKILL.md' },
  { name: 'self-improving-agent', desc: '自校验与复盘模块。需要持续优化流程与质量门禁时调用。', file: 'tools/core_skills/self-improving-agent/SKILL.md' },
  { name: 'automation-workflows', desc: '自动化流程模块。需要把重复操作自动化为脚本/流程时调用。', file: 'tools/core_skills/automation-workflows/SKILL.md' },
  { name: 'vibe-coding', desc: '快速原型模块。需要快速出可用原型/迭代方案时调用。', file: 'tools/core_skills/vibe-coding/SKILL.md' },
  { name: 'skill-vetter', desc: '技能审核模块。需要筛选/批准/禁用某类技能默认挂载时调用。', file: 'tools/core_skills/skill-vetter/SKILL.md' },
  { name: 'proactive-agent', desc: '主动推进模块。任务不完整但需要补齐缺口并推进时调用。', file: 'tools/core_skills/proactive-agent/SKILL.md' },
  { name: 'open-cli', desc: '命令行编排模块。需要可靠地执行本地命令并收集证据时调用。', file: 'tools/core_skills/open-cli/SKILL.md' },
  { name: 'github', desc: '代码托管与协作模块。需要 PR/分支/版本管理策略时调用。', file: 'tools/core_skills/github/SKILL.md' },
  { name: 'office-suite', desc: '文档与表格模块。需要处理 PDF/Excel/文档归档时调用。', file: 'tools/core_skills/office-suite/SKILL.md' },
  { name: 'humanizer', desc: '表达与对外文案模块。需要把技术内容写得像人、可对外交付时调用。', file: 'tools/core_skills/humanizer/SKILL.md' },
  { name: 'find-skills', desc: '技能发现模块。需要搜索/定位可用技能或判断是否存在对应能力时调用。', file: 'tools/core_skills/find-skills/SKILL.md' },
  { name: 'web-fetch', desc: '网页提取模块。需要抓取网页内容并转为可分析文本时调用。', file: 'tools/core_skills/web-fetch/SKILL.md' },
  { name: 'browser', desc: '深度浏览器控制模块。需要自动化网页操作/表单/抓取时调用。', file: 'tools/core_skills/browser/SKILL.md' },
];

const AGENT_NAMES = {
  yinyue: '银月',
  medusa: '美杜莎',
  lichangshou: '李长寿',
  xiaoyan: '萧炎',
  yaolao: '药老',
  moying: '墨影',
  ziling: '紫灵',
  yafei: '雅妃',
  hanli: '韩立',
  xiaoyixian: '小医仙',
  ziyan: '紫研',
};

function buildCoreSkillsSection() {
  const lines = [
    '## 通用核心 Skill（全员标配）',
    '',
    '以下 15 个核心 Skill 由 `install_core_skills.js` 统一安装，所有 Agent 默认挂载：',
    '',
    '| Skill | 描述 | 源文件 |',
    '|-------|------|--------|',
  ];

  for (const s of CORE_SKILLS) {
    lines.push(`| \`${s.name}\` | ${s.desc} | \`${s.file}\` |`);
  }

  lines.push('');
  lines.push('> **来源**: `openclaw.json` → `agents.defaults.skills`');
  lines.push('> **安装脚本**: `scripts/install_core_skills.js`');
  lines.push('> **物理路径**: `tools/core_skills/<skill_name>/SKILL.md`');
  lines.push('> **工作区映射**: `workspace/.agents/skills/<skill_name>/SKILL.md`');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const entries = fs.readdirSync(AGENTS_DIR, { withFileTypes: true });
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const agentId = entry.name;
    const toolsPath = path.join(AGENTS_DIR, agentId, 'TOOLS.md');
    const agentName = AGENT_NAMES[agentId] || agentId;

    if (!fs.existsSync(toolsPath)) {
      console.log(`[SKIP] ${agentId} (${agentName}) — TOOLS.md 不存在`);
      skipped++;
      continue;
    }

    const existing = fs.readFileSync(toolsPath, 'utf8');

    if (existing.includes('通用核心 Skill（全员标配）')) {
      console.log(`[SKIP] ${agentId} (${agentName}) — 核心 Skill 已存在`);
      skipped++;
      continue;
    }

    const coreSection = buildCoreSkillsSection();
    const newContent = existing.trimEnd() + '\n\n---\n\n' + coreSection;

    fs.writeFileSync(toolsPath, newContent, 'utf8');
    console.log(`[OK] ${agentId} (${agentName}) — 已补充核心 Skill 清单`);
    updated++;
  }

  console.log(`\n完成: ${updated} 个 Agent 已更新, ${skipped} 个跳过`);
}

main();
