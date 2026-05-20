'use strict';

const fs = require('fs');
const path = require('path');
const selfState = require('./self-state');
const memoryPalace = require('./memory-palace');

const ORCH_FILE = path.join(__dirname, '..', '.silvermoon_core', 'team_orchestration.json');

// ─── 银月钱庄团队成员角色映射 ──────────────────────────────

const TEAM = {
  lcs: {
    name: '李长寿',
    role: '全栈架构师 / 代码实现',
    skills: ['Next.js', 'React', 'Node.js', 'TypeScript', 'Tailwind', 'Web3', 'RWA'],
    delegation_note: '需要编码或架构设计时调用',
  },
  mds: {
    name: '美杜莎',
    role: 'UI/UX 设计师',
    skills: ['Figma', '视觉设计', 'UX', '品牌设计'],
    delegation_note: '需要设计稿或UI评审时调用',
  },
  xy: {
    name: '萧炎',
    role: '竞品情报 / 金融交易分析',
    skills: ['市场分析', '竞品数据', 'TradingView', 'CoinGecko'],
    delegation_note: '需要市场调研或竞品分析时调用',
  },
  yl: {
    name: '药老',
    role: '电商增长 / SEO / 英文文案',
    skills: ['SEO', '内容创作', 'Crawlee', 'Shopify配置'],
    delegation_note: '需要电商文案、SEO优化或爬虫抓取时调用',
  },
  zy: {
    name: '紫妍',
    role: '数字人 / 短视频脚本',
    skills: ['FlashShow', '数字人口播', '短视频脚本'],
    delegation_note: '需要数字人口播脚本时调用',
  },
  rat: {
    name: '寻宝鼠',
    role: '爆款选品',
    skills: ['CJ Dropshipping', 'AliExpress', '选品分析'],
    delegation_note: '需要选品调研时调用',
  },
  xian: {
    name: '小医仙',
    role: '社交媒体运营 / 短视频分镜',
    skills: ['社媒运营', 'TikTok', '内容策划'],
    delegation_note: '需要社媒内容或分镜脚本时调用',
  },
  risk: {
    name: '海波东',
    role: '风控合规 / 海外客诉',
    skills: ['Stripe争议', '合规审计', '英文客诉'],
    delegation_note: '需要处理客诉或合规审查时调用',
  },
  ller: {
    name: '蓝灵儿',
    role: '多媒体自动化',
    skills: ['Pillow', 'FFmpeg', '生图', '视频剪辑'],
    delegation_note: '需要处理图片或视频素材时调用',
  },
};

// ─── 有效状态枚举（状态机） ────────────────────────────────

const VALID_DELEGATION_STATUSES = ['created', 'assigned', 'in_progress', 'completed', 'blocked', 'cancelled'];
const VALID_MEMBER_STATUSES = ['idle', 'busy', 'offline'];

// ─── 持久化层 ──────────────────────────────────────────────

function ensureDir() {
  const dir = path.dirname(ORCH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readState() {
  ensureDir();
  try {
    if (fs.existsSync(ORCH_FILE)) return JSON.parse(fs.readFileSync(ORCH_FILE, 'utf8'));
  } catch {}
  return { delegations: [], memberStatus: {} };
}

function writeState(state) {
  ensureDir();
  fs.writeFileSync(ORCH_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ─── 任务复杂度评估 + 团队匹配 ─────────────────────────────

function analyzeWorkload(taskText) {
  const text = (typeof taskText === 'string' ? taskText : JSON.stringify(taskText)).toLowerCase();
  const needed = [];
  const reasons = [];

  if (text.includes('设计') || text.includes('ui') || text.includes('figma') || text.includes('视觉')) {
    needed.push('mds');
    reasons.push('需要设计能力');
  }
  if (text.includes('代码') || text.includes('实现') || text.includes('开发') || text.includes('deploy') ||
      text.includes('架构') || text.includes('前端') || text.includes('后端') || text.includes('api')) {
    needed.push('lcs');
    reasons.push('需要技术实现');
  }
  if (text.includes('调研') || text.includes('竞品') || text.includes('市场') || text.includes('分析') ||
      text.includes('research') || text.includes('competitor') || text.includes('trend')) {
    needed.push('xy');
    reasons.push('需要情报分析');
  }
  if (text.includes('文案') || text.includes('seo') || text.includes('描述') || text.includes('content') ||
      text.includes('shopify') || text.includes('产品描述')) {
    needed.push('yl');
    reasons.push('需要文案或SEO');
  }
  if (text.includes('数字人') || text.includes('口播') || text.includes('flashshow') || text.includes('短视频脚本')) {
    needed.push('zy');
    reasons.push('需要数字人脚本');
  }
  if (text.includes('选品') || text.includes('sourcing') || text.includes('dropshipping') || text.includes('aliexpress')) {
    needed.push('rat');
    reasons.push('需要选品调研');
  }
  if (text.includes('社媒') || text.includes('tiktok') || text.includes('分镜') || text.includes('社交') ||
      text.includes('social') || text.includes('内容策划')) {
    needed.push('xian');
    reasons.push('需要社媒运营');
  }
  if (text.includes('客诉') || text.includes('退款') || text.includes('争议') || text.includes('dispute') ||
      text.includes('合规') || text.includes('风险') || text.includes('refund')) {
    needed.push('risk');
    reasons.push('需要风控处理');
  }
  if (text.includes('图片') || text.includes('视频') || text.includes('素材') || text.includes('剪辑') ||
      text.includes('image') || text.includes('video') || text.includes('thumbnail')) {
    needed.push('ller');
    reasons.push('需要多媒体处理');
  }

  return { needed: [...new Set(needed)], reasons };
}

// ─── 委派（自动匹配成员） ──────────────────────────────────

function delegate(taskText, context = {}) {
  const state = readState();
  const analysis = analyzeWorkload(taskText);

  const delegation = {
    id: `del-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    task: typeof taskText === 'string' ? taskText.slice(0, 500) : JSON.stringify(taskText).slice(0, 500),
    context,
    neededMembers: analysis.needed,
    reasons: analysis.reasons,
    status: 'created',
    priority: context.priority || 'normal',
    deadline: context.deadline || null,
    assignee: context.assignee || null,
    updatedAt: new Date().toISOString(),
  };

  state.delegations.push(delegation);
  if (state.delegations.length > 50) state.delegations = state.delegations.slice(-50);
  writeState(state);

  const memberNames = analysis.needed.map(id => TEAM[id]?.name || id).filter(Boolean);

  memoryPalace.addEpisode(
    `团队委派: ${memberNames.join(', ')}`,
    'task',
    'neutral',
    `任务: ${delegation.task.slice(0, 100)}`
  );

  return { delegation, members: memberNames, teamInfo: analysis.needed.map(id => TEAM[id]).filter(Boolean) };
}

// ─── 显式指派（直接指定某人） ──────────────────────────────

function assignTask(memberId, taskText, options = {}) {
  if (!TEAM[memberId]) throw new Error(`未知成员ID: ${memberId}`);

  const state = readState();
  const delegation = {
    id: `del-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    task: typeof taskText === 'string' ? taskText.slice(0, 500) : JSON.stringify(taskText).slice(0, 500),
    context: options.context || {},
    neededMembers: [memberId],
    reasons: [`显式指派给 ${TEAM[memberId].name}`],
    status: 'assigned',
    priority: options.priority || 'normal',
    deadline: options.deadline || null,
    assignee: memberId,
    updatedAt: new Date().toISOString(),
  };

  state.delegations.push(delegation);
  state.memberStatus[memberId] = 'busy';
  if (state.delegations.length > 50) state.delegations = state.delegations.slice(-50);
  writeState(state);

  memoryPalace.addEpisode(
    `指派任务: ${TEAM[memberId].name}`,
    'task',
    'neutral',
    `任务: ${delegation.task.slice(0, 100)}`
  );

  return { delegation, member: TEAM[memberId] };
}

// ─── 更新委派状态（状态机流转） ────────────────────────────

function updateDelegationStatus(id, newStatus) {
  if (!VALID_DELEGATION_STATUSES.includes(newStatus)) {
    throw new Error(`无效状态: ${newStatus}，有效值: ${VALID_DELEGATION_STATUSES.join(', ')}`);
  }

  const state = readState();
  const del = state.delegations.find(d => d.id === id);
  if (!del) throw new Error(`未找到委派记录: ${id}`);

  // 状态机合法性校验
  const ALLOWED_TRANSITIONS = {
    created:       ['assigned', 'cancelled'],
    assigned:      ['in_progress', 'cancelled'],
    in_progress:   ['completed', 'blocked', 'cancelled'],
    completed:     [],
    blocked:       ['in_progress', 'cancelled'],
    cancelled:     [],
  };

  const allowed = ALLOWED_TRANSITIONS[del.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`不允许状态转换: ${del.status} → ${newStatus}`);
  }

  del.status = newStatus;
  del.updatedAt = new Date().toISOString();
  writeState(state);

  // 如果任务完成或取消，释放成员
  if ((newStatus === 'completed' || newStatus === 'cancelled') && del.assignee) {
    updateMemberStatus(del.assignee, 'idle');
  }

  // 记录到记忆宫殿
  memoryPalace.addEpisode(
    `任务状态变更: ${id} → ${newStatus}`,
    'task',
    newStatus === 'completed' ? 'positive' : 'neutral',
    `任务: ${del.task.slice(0, 100)}`
  );

  return { delegation: del, previousStatus: allowed.length > 0 ? del.status : null };
}

// ─── 更新成员状态 ──────────────────────────────────────────

function updateMemberStatus(memberId, status) {
  if (!TEAM[memberId]) throw new Error(`未知成员ID: ${memberId}`);
  if (!VALID_MEMBER_STATUSES.includes(status)) {
    throw new Error(`无效成员状态: ${status}，有效值: ${VALID_MEMBER_STATUSES.join(', ')}`);
  }

  const state = readState();
  state.memberStatus[memberId] = status;
  writeState(state);
  return { memberId, status, name: TEAM[memberId].name };
}

// ─── 团队负载统计 ──────────────────────────────────────────

function getTeamWorkload() {
  const state = readState();
  const result = {};

  for (const [id, member] of Object.entries(TEAM)) {
    const memberStat = state.memberStatus[id] || 'idle';
    const activeTasks = state.delegations.filter(d =>
      d.neededMembers.includes(id) &&
      !['completed', 'cancelled'].includes(d.status)
    );

    result[id] = {
      name: member.name,
      role: member.role,
      status: memberStat,
      activeTaskCount: activeTasks.length,
      activeTasks: activeTasks.map(t => ({
        id: t.id,
        task: t.task.slice(0, 80),
        status: t.status,
        priority: t.priority,
      })),
    };
  }

  return result;
}

// ─── 进度统计 ──────────────────────────────────────────────

function getProgressStats() {
  const state = readState();
  const total = state.delegations.length;
  if (total === 0) return { total: 0, completed: 0, completionRate: 0, breakdown: {}, workload: {} };

  const breakdown = {};
  for (const s of VALID_DELEGATION_STATUSES) {
    breakdown[s] = state.delegations.filter(d => d.status === s).length;
  }

  const completionRate = total > 0 ? Math.round((breakdown.completed / total) * 100) : 0;

  return {
    total,
    completed: breakdown.completed,
    completionRate,
    breakdown,
    workload: getTeamWorkload(),
  };
}

// ─── 查询活跃任务 ──────────────────────────────────────────

function getActiveTasks() {
  const state = readState();
  return state.delegations.filter(d => !['completed', 'cancelled'].includes(d.status));
}

// ─── 团队能力展示 ─────────────────────────────────────────

function getTeamCapabilities() {
  const lines = ['【银月钱庄可调用的团队力量】'];
  for (const [id, member] of Object.entries(TEAM)) {
    lines.push(`  [${id}] ${member.name} — ${member.role}`);
    lines.push(`    擅长: ${member.skills.join(', ')}`);
    lines.push(`    调用场景: ${member.delegation_note}`);
  }
  return lines.join('\n');
}

function getDelegationHistory(limit = 10) {
  const state = readState();
  return state.delegations.slice(-limit).map(d => ({
    id: d.id,
    task: d.task.slice(0, 100),
    members: d.neededMembers.map(id => TEAM[id]?.name || id),
    status: d.status,
    priority: d.priority,
    assignee: d.assignee ? TEAM[d.assignee]?.name || d.assignee : null,
    time: d.timestamp,
    updatedAt: d.updatedAt,
  }));
}

function getOrchestratorBlock() {
  const state = readState();
  const recent = state.delegations.slice(-3);
  if (recent.length === 0) return '暂无团队协作记录。';
  const lines = ['【最近的团队协作】'];
  for (const d of recent) {
    const names = d.neededMembers.map(id => TEAM[id]?.name || id).join(', ');
    lines.push(`  - [${d.status}] 委派 ${names}: ${d.task.slice(0, 80)}`);
  }
  return lines.join('\n');
}

module.exports = {
  TEAM,
  analyzeWorkload,
  delegate,
  assignTask,
  updateDelegationStatus,
  updateMemberStatus,
  getTeamWorkload,
  getProgressStats,
  getActiveTasks,
  getTeamCapabilities,
  getDelegationHistory,
  getOrchestratorBlock,
  VALID_DELEGATION_STATUSES,
  VALID_MEMBER_STATUSES,
};
