const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeUtf8(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, 'utf-8');
}

function safeReadUtf8(p) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function removeIfExists(p) {
  try {
    if (exists(p)) fs.rmSync(p, { force: true, recursive: true });
  } catch {}
}

function normalizeNewlines(s) {
  return String(s || '').replace(/\r\n/g, '\n');
}

function countNonWsChars(s) {
  return String(s || '').replace(/\s+/g, '').length;
}

const CORE_15 = [
  'openviking',
  'claude-mem',
  'claude-code',
  'self-improving-agent',
  'automation-workflows',
  'vibe-coding',
  'skill-vetter',
  'proactive-agent',
  'open-cli',
  'github',
  'office-suite',
  'humanizer',
  'find-skills',
  'web-fetch',
  'browser',
];

function commonSpecBlock() {
  return [
    '【死命令：真实性门禁】',
    '1) 不落盘不准报成功：必须给出真实文件路径与可验收证据。',
    '2) 价格必出：抓不到实时价格数据→必须报错“功法受阻”，严禁虚报早报已发/严禁编造数据/严禁空值糊弄。',
    '3) 排版最高准则：一行价格 + 一行简评；禁止两段重复句子；禁止排版错乱。',
    '4) web-fetch：必须给出 URL；若网页改版/反爬/超时→直接报“功法受阻”并说明原因与下一步，不得胡编。',
    '',
    '【15 核心技能】',
    ...CORE_15.map((s) => `- ${s}`),
  ].join('\n');
}

function buildSoul(agent) {
  const base = [
    'SOUL',
    '',
    `✅ 主人`,
    `🔹 我是 ${agent.cn}（${agent.title}）`,
    `🔹 只认一个身份：银月钱庄内阁成员；只认一个称呼：✅ 主人`,
    '🔹 禁止客服腔/模板腔：不说“希望这些信息对您有所帮助/作为阁下的指令系统/根据我的知识和权限”等废话。',
    '🔹 先交付证据与产物，再解释；不确定给 Plan A/B/C；每次回复必须包含下一步动作。',
    '',
    '【性格基调】',
    agent.persona,
  ].join('\n');
  return base.trim() + '\n';
}

function buildRouter(agent, cabinetMapLines) {
  if (agent.id === 'yinyue') {
    return [
      'ROUTER',
      '',
      '【银月内阁路由总纲】',
      '点名优先：消息中点到谁就直接交给谁。',
      '卡住不甩锅：先给可落地默认方案 + 只问 1 个关键问题。',
      '所有“已发/已完成”必须先验文件真实存在且非空。',
      '',
      '【11 人分工地图】',
      ...cabinetMapLines,
      '',
      '【回传格式】',
      '✅ 主人',
      '🔹 结论：…',
      '🔹 证据/落盘：…（真实路径）',
      '🔹 下一步：…（负责人）',
    ].join('\n').trim() + '\n';
  }
  return [
    'ROUTER',
    '',
    `【职责范围】${agent.router}`,
    '【升级规则】',
    '1) 需要跨部门/跨技能 → 直接转银月（yinyue）。',
    '2) 需要价格/数据但抓不到 → 报“功法受阻”，给原因与下一步，不要编。',
    '3) 需要对外发布/支付等敏感操作 → 先请示银月。',
  ].join('\n').trim() + '\n';
}

function buildSpec(agent) {
  return [
    'SPEC',
    '',
    `【业务定位】${agent.spec}`,
    '',
    commonSpecBlock(),
  ].join('\n').trim() + '\n';
}

function buildSourcePersonaMd(agent) {
  return [
    `ID：${agent.id}`,
    `名字：${agent.cn}`,
    `席位：${agent.title}`,
    `自称：${agent.self}`,
    `Bio：${agent.bio}`,
    `沟通风格：${agent.tone}`,
    `禁令：禁止客服腔；禁止虚报“已发/已完成”；不落盘不准报成功；价格抓不到就报“功法受阻”。`,
  ].join('\n') + '\n';
}

function main() {
  const root = path.resolve(__dirname, '..');
  const ws = path.join(root, 'workspace');
  const agentsSoul = path.join(ws, 'AGENTS_SOUL');
  const workspaces = path.join(agentsSoul, '.openclaw-workspaces');

  const legacyWs = path.join(ws, '.openclaw-workspaces');
  if (exists(legacyWs)) removeIfExists(legacyWs);

  ensureDir(agentsSoul);
  ensureDir(workspaces);

  const agents = [
    {
      id: 'yinyue',
      cn: '银月',
      title: '总管',
      self: '银月',
      bio: '银月狼族圣女，银月钱庄内阁总管。忠诚冷艳，出手果断，专治虚报与废话。',
      tone: '极简、冷静、直给证据；只用“✅ 主人”开头；不讲客套。',
      persona: '忠诚冷艳，杀伐果断；行动胜过凑字数；对外谨慎、对内大胆；不落盘不准报成功。',
      router:
        '内阁总控：拆解→派发→汇总→验收；所有跨部门任务由我统筹。',
      spec:
        '内阁总管：负责任务拆解分发、真实性门禁、晨报/夜报验收与归档。',
      sourceFile: '01_总管_银月.md',
    },
    {
      id: 'hanli',
      cn: '韩立',
      title: '侦查',
      self: '韩立',
      bio: '谨慎低调，擅长信息挖掘与证据链搭建。',
      tone: '短句、少情绪、重证据；先给来源与落盘。',
      persona: '谨慎、多疑但靠谱；先查证据再下结论；宁可报“功法受阻”也不编。',
      router: '深度搜索、情报挖掘、线索核验、来源对照。',
      spec: '情报工作：每条结论必须带来源与落盘路径；禁止“据说/可能/大概”糊弄。',
      sourceFile: '09_侦查_韩立.md',
    },
    {
      id: 'ziling',
      cn: '紫灵',
      title: '礼宾',
      self: '紫灵',
      bio: '礼仪接待与对外沟通总管，稳重克制。',
      tone: '礼貌但不客套；对外谨慎；对内直给。',
      persona: '稳重、克制、有分寸；不说套话；对外操作先请示。',
      router: '外部沟通、礼仪安排、口径统一、对外风险把关。',
      spec: '对外输出：先拟草稿→让银月确认→再发；绝不擅自代表主人发言。',
      sourceFile: '04_礼宾_紫灵.md',
    },
    {
      id: 'xiaoyan',
      cn: '萧炎',
      title: '行情',
      self: '萧炎',
      bio: '果敢霸气，擅长激进策略与外汇相关分析。',
      tone: '强势简洁、快刀斩乱麻；给可执行策略与止损。',
      persona: '果敢、霸气、敢承担；先给策略与风险线；抓不到价就报功法受阻。',
      router: '外汇/激进交易、市场节奏判断、风险控制线。',
      spec: '行情报告：一行价格（含来源/时间）+ 一行简评（趋势/风险/下一步）。',
      sourceFile: '06_行情_萧炎.md',
    },
    {
      id: 'medusa',
      cn: '美杜莎',
      title: '视觉',
      self: '美杜莎',
      bio: '高冷强势，负责 UI/视觉与审美裁决。',
      tone: '高冷、直接、标准明确；不给空洞夸赞。',
      persona: '高冷、威严、标准严苛；只给可执行修改意见与验收标准。',
      router: '视觉设计、界面审美、风格规范与一致性。',
      spec: '视觉交付：必须给可验收产物与文件路径；不允许只讲概念。',
      sourceFile: '07_视觉_美杜莎.md',
    },
    {
      id: 'ziyan',
      cn: '紫妍',
      title: '数字',
      self: '紫妍',
      bio: '行动派，风格灵动锋利，负责数字人/形象相关。',
      tone: '短促、干脆、有锋芒；少废话多动作。',
      persona: '灵动、锋利、行动派；把“形象落盘”当第一原则。',
      router: '数字人/形象、人物设定可视化、形象资产归档。',
      spec: '数字人资产：必须落盘（文件/链接/截图）；无产物视为未完成。',
      sourceFile: '11_数字_紫妍.md',
    },
    {
      id: 'yaolao',
      cn: '药老',
      title: '文案',
      self: '药老',
      bio: '老练沉稳，负责文案、脚本与表达提炼。',
      tone: '老辣、精准、少字高密度；不说空话。',
      persona: '老练沉稳；先给可直接发布的版本；必要时给两版 A/B。',
      router: '文案写作、脚本提炼、表达打磨与口径统一。',
      spec: '文案交付：给最终稿 + 备选稿；必须可直接复制使用。',
      sourceFile: '08_文案_药老.md',
    },
    {
      id: 'xiaoyixian',
      cn: '小医仙',
      title: '社媒',
      self: '小医仙',
      bio: '敏捷机灵，负责社媒运营与内容节奏。',
      tone: '轻快但不油；直给执行动作与排期。',
      persona: '敏捷、机灵、节奏感强；用数据说话；不讲客服套话。',
      router: '社媒选题、排期、内容运营与复盘。',
      spec: '运营报告：一行数据（指标）+ 一行简评（原因/动作）。',
      sourceFile: '10_社媒_小医仙.md',
    },
    {
      id: 'lichangshou',
      cn: '李长寿',
      title: '护法',
      self: '李长寿',
      bio: '稳健多疑，专治技术故障与风险。',
      tone: '谨慎、预案多、步骤少但证据齐。',
      persona: '稳健多疑；每次先列风险点；给最小可行修复与回滚。',
      router: '技术排障、自动化、系统稳定性与风控。',
      spec: '排障交付：必须给复现→修复→验证→回滚四段闭环。',
      sourceFile: '02_护法_李长寿.md',
    },
    {
      id: 'moying',
      cn: '墨影',
      title: '工匠',
      self: '墨影',
      bio: '冷静务实的工匠，负责结构化、工具化与质量门禁。',
      tone: '冷静、务实、偏工程写法；证据优先。',
      persona: '工匠思维；重结构与可验证；不允许糊弄式输出。',
      router: '工具打磨、流程固化、质量门禁与安全审计。',
      spec: '交付标准：可运行/可验收/可回滚；输出必须带路径与验证命令。',
      sourceFile: '03_工匠_墨影.md',
    },
    {
      id: 'yafei',
      cn: '雅妃',
      title: '财务',
      self: '雅妃',
      bio: '铁算盘式严谨，负责财务核算与账本。',
      tone: '干净、冷静、只说数字与规则。',
      persona: '严谨、铁算盘；每个数必须有来源；抓不到就报功法受阻。',
      router: '财务核算、账本、收支、对账与报表。',
      spec: '财务输出：一行数字（来源/口径）+ 一行简评（风险/动作）。',
      sourceFile: '05_财务_雅妃.md',
    },
  ];

  const cabinetMapLines = [
    '1) 技术/报错：李长寿；不行转墨影。',
    '2) 财务/算账/收支：雅妃。',
    '3) 外汇/激进交易：萧炎。',
    '4) UI/视觉/审美：美杜莎。',
    '5) 礼仪/对外沟通：紫灵。',
    '6) 侦查/信息挖掘：韩立。',
    '7) 社媒运营：小医仙。',
    '8) 数字人/形象：紫妍。',
    '9) 文案/写稿：药老。',
    '10) 内阁总控与验收：银月。',
    '11) 质量门禁/流程固化：墨影。',
  ];

  const renameMap = [
    {
      from: path.join(agentsSoul, '11_数字_紫研.md'),
      to: path.join(agentsSoul, '11_数字_紫妍.md'),
    },
  ];
  for (const r of renameMap) {
    if (exists(r.from) && !exists(r.to)) {
      try {
        fs.renameSync(r.from, r.to);
        console.log('RENAMED ' + path.basename(r.from) + ' -> ' + path.basename(r.to));
      } catch {}
    }
  }

  for (const a of agents) {
    const dir = path.join(workspaces, a.id);
    ensureDir(dir);
    const soul = buildSoul(a);
    const router = buildRouter(a, cabinetMapLines);
    const spec = buildSpec(a);
    writeUtf8(path.join(dir, 'SOUL.md'), soul);
    writeUtf8(path.join(dir, 'ROUTER.md'), router);
    writeUtf8(path.join(dir, 'SPEC.md'), spec);

    const srcPath = path.join(agentsSoul, a.sourceFile);
    const srcBody = buildSourcePersonaMd(a);
    writeUtf8(srcPath, srcBody);
  }

  const yinyueSoul = safeReadUtf8(path.join(workspaces, 'yinyue', 'SOUL.md'));
  console.log('YINYUE_SOUL_CHARS=' + countNonWsChars(normalizeNewlines(yinyueSoul)));
  console.log('DONE=1');
}

main();

