const fs = require('fs');
const path = require('path');

const WORKSPACES_DIR = path.join(__dirname, '..', 'workspace', 'AGENTS_SOUL', '.openclaw-workspaces');
const SECTS_DIR = path.join(__dirname, '..', 'sects');

const AGENT_MAP = {
  yinyue: '银月',
  lichangshou: '李长寿',
  hanli: '韩立',
  yaolao: '药老',
  medusa: '美杜莎',
  moying: '墨影',
  xiaoyan: '萧炎',
  yafei: '雅妃',
  xiaoyixian: '小医仙',
  ziling: '紫灵',
  ziyan: '紫研',
};

const MISSING_FILES = ['MEMORY.md', 'AGENTS.md', 'IDENTITY.md', 'TASKS.md', 'HEARTBEAT.md', 'TOOLS.md', 'BOOTSTRAP.md', 'focus.md', 'inbox.md', 'routines.md'];

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultContent, 'utf8');
    console.log(`  [CREATED] ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

function syncWorkspace(agentId, displayName) {
  const wsDir = path.join(WORKSPACES_DIR, agentId);
  if (!fs.existsSync(wsDir)) {
    console.log(`  [SKIP] Workspace not found: ${agentId}`);
    return;
  }

  console.log(`\n=== ${displayName} (${agentId}) ===`);

  const sectsDir = path.join(SECTS_DIR, displayName);
  const sectsSoulPath = path.join(sectsDir, 'SOUL.md');
  const wsSoulPath = path.join(wsDir, 'SOUL.md');

  if (fs.existsSync(sectsSoulPath)) {
    const sectsContent = fs.readFileSync(sectsSoulPath, 'utf8');
    fs.writeFileSync(wsSoulPath, sectsContent, 'utf8');
    console.log('  [SYNCED] SOUL.md from sects/');
  }

  ensureFile(path.join(wsDir, 'MEMORY.md'), `# ${displayName} 记忆库\n\n## 长期记忆\n\n（此处记录 ${displayName} 的长期记忆与经验总结）\n`);
  ensureFile(path.join(wsDir, 'AGENTS.md'), `# ${displayName} 员工档案\n\n- **ID**: ${agentId}\n- **名称**: ${displayName}\n- **席位**: 待定\n- **状态**: 活跃\n`);
  ensureFile(path.join(wsDir, 'IDENTITY.md'), `# ${displayName} 身份证明\n\n**ID**: ${agentId}\n**名称**: ${displayName}\n**所属**: 银月钱庄\n`);
  ensureFile(path.join(wsDir, 'TASKS.md'), `# ${displayName} 任务列表\n\n（此处记录当前任务与进度）\n`);
  ensureFile(path.join(wsDir, 'HEARTBEAT.md'), `# ${displayName} 心跳日志\n\n（此处记录运行状态与心跳信息）\n`);
  ensureFile(path.join(wsDir, 'TOOLS.md'), `# ${displayName} 工具链\n\n（此处记录可用工具与API配置）\n`);
  ensureFile(path.join(wsDir, 'BOOTSTRAP.md'), `# ${displayName} 启动引导\n\n（此处记录启动流程与依赖检查）\n`);
  ensureFile(path.join(wsDir, 'focus.md'), `# ${displayName} 当前焦点\n\n（此处记录当前工作重点）\n`);
  ensureFile(path.join(wsDir, 'inbox.md'), `# ${displayName} 收件箱\n\n（此处记录待处理事项）\n`);
  ensureFile(path.join(wsDir, 'routines.md'), `# ${displayName} 日常流程\n\n（此处记录例行任务与定时操作）\n`);
}

console.log('========================================');
console.log('  银月钱庄 - Agent 工作区文件同步脚本');
console.log('========================================');

for (const [agentId, displayName] of Object.entries(AGENT_MAP)) {
  syncWorkspace(agentId, displayName);
}

console.log('\n========================================');
console.log('  同步完成！');
console.log('========================================');
