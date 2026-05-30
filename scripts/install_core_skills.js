const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeUtf8(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, 'utf-8');
}

function normSkillName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function buildSkillMd(params) {
  const name = params.name;
  const title = params.title;
  const desc = params.description;
  const body = params.body;
  const version = params.version || '1.0.0';
  return `---\nname: "${name}"\nsource: local\nversion: "${version}"\ndescription: "${desc}"\n---\n\n# ${title}\n\n${body}\n`;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const protectedRoot = path.join(root, 'tools', 'core_skills');
  const workspaceSkillsRoot = path.join(root, 'workspace', '.agents', 'skills');

  const core = [
    {
      name: 'openviking',
      title: 'OPENVIKING',
      description: '核心执行与调查模块。需要强执行、强落地、强排障时调用。',
      body: '当任务要求"立刻执行/强制修复/彻底排障"时使用。\n\n## 调查方法论\n\n1. **定界** — 确认症状、影响范围、最近变更\n2. **根因** — 逐层排除：配置→网络→依赖→权限→代码逻辑\n3. **证据链** — 每步结论必须有日志/返回值/截图佐证\n4. **止血** — 先恢复服务再修根因，Plan B 随时待命\n\n## 执行铁律\n\n- 改前备份，改后验证，验证未通过自动回滚\n- 每次操作输出：`[动作] → [结果] → [证据]`\n- 不确定时执行 `openviking investigate <issue>` 做结构化调查',
      version: '1.0.0',
    },
    { name: 'claude-mem', title: 'CLAUDE-MEM', description: '记忆与上下文管理模块。需要固化规则/提炼可复用信息时调用。', body: '用于把稳定规则与项目知识沉淀为可检索记忆，避免重复劳动。', version: '1.0.0' },
    { name: 'claude-code', title: 'CLAUDE CODE', description: '代码级实现模块。需要写代码/改配置/加测试时调用。', body: '用于实现与改动；要求：最小改动、可验证、无秘钥硬编码。', version: '1.0.0' },
    { name: 'self-improving-agent', title: 'SELF-IMPROVING-AGENT', description: '自校验与复盘模块。需要持续优化流程与质量门禁时调用。', body: '用于建立检查清单、失败回放与质量门禁，减少回归。', version: '1.0.0' },
    { name: 'automation-workflows', title: 'AUTOMATION-WORKFLOWS', description: '自动化流程模块。需要把重复操作自动化为脚本/流程时调用。', body: '用于脚本化与流水线化，强调幂等与可回滚。', version: '1.0.0' },
    { name: 'vibe-coding', title: 'VIBE CODING', description: '快速原型模块。需要快速出可用原型/迭代方案时调用。', body: '用于快速试验与原型，但必须保留验证与回退路径。', version: '1.0.0' },
    { name: 'skill-vetter', title: 'SKILL-VETTER', description: '技能审核模块。需要筛选/批准/禁用某类技能默认挂载时调用。', body: '用于技能白名单/黑名单与默认挂载策略审计。', version: '1.0.0' },
    { name: 'proactive-agent', title: 'PROACTIVE-AGENT', description: '主动推进模块。任务不完整但需要补齐缺口并推进时调用。', body: '用于补全隐含需求、列风险与下一步动作，避免停滞。', version: '1.0.0' },
    { name: 'open-cli', title: 'OPEN CLI', description: '命令行编排模块。需要可靠地执行本地命令并收集证据时调用。', body: '用于执行命令并记录输出；避免破坏性命令；先验证再宣称完成。', version: '1.0.0' },
    { name: 'github', title: 'GITHUB', description: '代码托管与协作模块。需要 PR/分支/版本管理策略时调用。', body: '用于分支策略、PR 检查、发布流程与回滚策略。', version: '1.0.0' },
    { name: 'office-suite', title: 'OFFICE-SUITE', description: '文档与表格模块。需要处理 PDF/Excel/文档归档时调用。', body: '用于表格/文档处理与结构化输出。', version: '1.0.0' },
    { name: 'humanizer', title: 'HUMANIZER', description: '表达与对外文案模块。需要把技术内容写得像人、可对外交付时调用。', body: '用于对外文案、客户交付与语气一致性。', version: '1.0.0' },
    { name: 'find-skills', title: 'FIND-SKILLS', description: '技能发现模块。需要搜索/定位可用技能或判断是否存在对应能力时调用。', body: '用于盘点现有技能、发现缺失能力、给出安装/启用建议。', version: '1.0.0' },
    { name: 'web-fetch', title: 'WEB_FETCH', description: '网页提取模块。需要抓取网页内容并转为可分析文本时调用。', body: '用于拉取网页并提取正文；优先安全与可复现。', version: '1.0.0' },
    { name: 'browser', title: 'BROWSER', description: '深度浏览器控制模块。需要自动化网页操作/表单/抓取时调用。', body: '用于浏览器自动化；需要明确目标页面与动作；避免泄露敏感信息。', version: '1.0.0' },
  ];

  ensureDir(protectedRoot);
  ensureDir(workspaceSkillsRoot);

  for (const s of core) {
    const name = normSkillName(s.name);
    const skillMd = buildSkillMd({
      name,
      title: s.title,
      description: s.description,
      body: s.body,
    });

    const p1 = path.join(protectedRoot, name, 'SKILL.md');
    const p2 = path.join(workspaceSkillsRoot, name, 'SKILL.md');
    writeUtf8(p1, skillMd);
    writeUtf8(p2, skillMd);
  }

  console.log('core_skills_installed=' + core.length);
  console.log('protected_root=' + protectedRoot);
  console.log('workspace_skills_root=' + workspaceSkillsRoot);
}

main();
