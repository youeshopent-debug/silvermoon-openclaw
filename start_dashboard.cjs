'use strict';
const { ControlCenter } = require('./lib/control-center');
const fs = require('fs');
const path = require('path');

const AGENT_ROLES = {
  '银月': { role: '总管', duty: '协调所有 Agent、监控系统' },
  '李长寿': { role: '全栈架构师', duty: 'Web 开发、Shopify 装修、自动化' },
  '墨影': { role: '巡检官', duty: '系统监控、日志审计、通知' },
  '药老': { role: '增长专家', duty: 'SEO 优化、文案创作、产品描述' },
  '小医仙': { role: '社媒运营', duty: '推广、内容策划、社区管理' },
  '萧炎': { role: '情报分析师', duty: '竞品分析、选品调研、趋势抓取' },
  '美杜莎': { role: 'UI/UX 设计师', duty: '视觉设计、Figma 还原' },
  '韩立': { role: '侦查员', duty: '信息搜集、数据分析' },
  '雅妃': { role: '账房先生', duty: '账目管理、客户服务' },
  '紫灵': { role: '辅助', duty: '通用任务支持' },
  '紫研': { role: '数字人专家', duty: '短视频口播、多媒体' },
};

async function main() {
  const cc = new ControlCenter(4310);
  await cc.start();

  const configPath = path.join(__dirname, 'openclaw.json');
  let agentNames = [];
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    agentNames = (config.agents?.list || []).map(a => a.name).filter(Boolean);
  } catch (e) {
    console.log('[Dashboard] 无法读取 openclaw.json:', e.message);
    agentNames = Object.keys(AGENT_ROLES);
  }

  for (const name of agentNames) {
    const info = AGENT_ROLES[name] || { role: 'Agent', duty: '待分配' };
    cc.agentStatus[name] = {
      connected: false,
      heartbeatCount: 0,
      lastHeartbeatAt: null,
      lastReason: 'main.js 未启动',
    };
    console.log(`  ${name} (${info.role}) — ${info.duty}`);
  }

  const seqCounter = { val: 0 };
  setInterval(() => {
    seqCounter.val++;
    for (const name of agentNames) {
      cc.heartbeats.push({
        agent: name,
        type: 'system',
        reason: cc.agentStatus[name]?.connected ? 'active' : 'offline',
        timestamp: new Date().toISOString(),
        sequence: seqCounter.val,
      });
    }
    if (cc.heartbeats.length > cc.maxHeartbeats) {
      cc.heartbeats = cc.heartbeats.slice(-cc.maxHeartbeats);
    }
  }, 30000);

  console.log(`\n[Dashboard] 已注册 ${agentNames.length} 位 Agent`);
  console.log(`            打开 http://127.0.0.1:4310/ 查看看板`);
  console.log(`            (Agent 均显示离线 — main.js 未运行)`);
}

main().catch(e => {
  console.error('[Dashboard] 启动失败:', e.message);
  process.exit(1);
});
