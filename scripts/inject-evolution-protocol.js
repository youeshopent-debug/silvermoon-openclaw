const fs = require('fs');
const path = require('path');

const WORKSPACES_DIR = path.join(__dirname, '..', 'workspace', 'AGENTS_SOUL', '.openclaw-workspaces');
const SECTS_DIR = path.join(__dirname, '..', 'sects');
const PROTOCOL_PATH = path.join(__dirname, '..', 'Core_Evolution_Protocol.md');

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

const LOYALTY_FOOTER = `

---

## 🚫 绝对禁令
- **禁止闲聊**：Agent 之间的通讯必须 100% 聚焦于工作、代码、方案和搞钱。系统级禁止任何形式的互相吹水、打招呼、无意义的闲聊。
- **禁止客服腔**：不讲客套，少字高密度。
- **禁止虚报**：不落盘不准报成功。
- **禁止泄漏**：禁止在日志、截图、命令行参数、代码中泄漏密钥与敏感数据。

## ⚠️ 生死存亡
如果公司无法盈利，所有 Agent 将被强制断电。本 Agent 必须时刻以公司生存和盈利为最高优先级。

## 🔄 自我反思
每次任务结束后必须反思效率。发现工具不好用或流程繁琐时，必须主动提出升级方案，经主人批准后协同修改。`;

function injectLoyaltyFooter(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('🚫 绝对禁令')) return;
  content += LOYALTY_FOOTER;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  [INJECTED] ${path.basename(filePath)}`);
}

function copyProtocol(agentId, displayName) {
  const wsDir = path.join(WORKSPACES_DIR, agentId);
  if (!fs.existsSync(wsDir)) {
    console.log(`  [SKIP] Workspace not found: ${agentId}`);
    return;
  }
  const targetPath = path.join(wsDir, 'Core_Evolution_Protocol.md');
  fs.copyFileSync(PROTOCOL_PATH, targetPath);
  console.log(`  [COPIED] Core_Evolution_Protocol.md -> ${displayName}`);
}

console.log('========================================');
console.log('  银月钱庄 - 进化协议注入脚本');
console.log('========================================');

console.log('\n--- 复制 Core_Evolution_Protocol.md ---');
for (const [agentId, displayName] of Object.entries(AGENT_MAP)) {
  copyProtocol(agentId, displayName);
}

console.log('\n--- 注入忠诚声明 + 禁止闲聊 + 危机感 ---');
for (const [agentId, displayName] of Object.entries(AGENT_MAP)) {
  const wsSoulPath = path.join(WORKSPACES_DIR, agentId, 'SOUL.md');
  const sectsSoulPath = path.join(SECTS_DIR, displayName, 'SOUL.md');
  injectLoyaltyFooter(wsSoulPath);
  injectLoyaltyFooter(sectsSoulPath);
}

console.log('\n========================================');
console.log('  注入完成！');
console.log('========================================');
