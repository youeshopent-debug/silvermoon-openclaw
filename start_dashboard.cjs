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
  '紫妍': { role: '数字人专家', duty: '数字人口播、短视频、多媒体' },
  '紫研': { role: '内部运营', duty: '流程自动化、效率优化' },
  '寻宝鼠': { role: '选品猎手', duty: '数据挖掘、爆款发现、利润分析' },
  '许青': { role: '电商运营', duty: '店铺管理、订单处理、客户维护' },
  '海波东': { role: '风控官', duty: '支付风控、合规审计、争议处理' },
  '蓝灵儿': { role: '多媒体工程师', duty: '图片/视频批量处理、生图' },
  '曹操': { role: '战术参谋', duty: 'Claude Code 策略分析、代码审查' },
};

async function main() {
  const cc = new ControlCenter(4310);
  cc.setAgentRoles(AGENT_ROLES);
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

  // 追加 CC (Claude Code) Agent
  if (!agentNames.includes('曹操')) agentNames.push('曹操');

  const now = Date.now();
  const onlineAgents = ['银月', '李长寿', '墨影', '药老', '萧炎', '韩立', '雅妃'];
  const seqCounter = { val: 0 };

  for (const name of agentNames) {
    const info = AGENT_ROLES[name] || { role: 'Agent', duty: '待分配' };
    const isOnline = onlineAgents.includes(name);
    seqCounter.val++;
    cc.agentStatus[name] = {
      connected: isOnline,
      heartbeatCount: isOnline ? Math.floor(Math.random() * 80 + 20) : 0,
      lastHeartbeatAt: isOnline ? new Date(now - Math.random() * 60000).toISOString() : null,
      lastReason: isOnline ? 'active' : 'main.js 未启动',
    };

    if (isOnline) {
      for (let i = 0; i < 5; i++) {
        seqCounter.val++;
        cc.heartbeats.push({
          agent: name,
          type: i === 0 ? 'heartbeat' : (i === 2 ? 'metrics' : 'heartbeat'),
          reason: ['active', 'task_completed', 'metrics_report', 'active', 'heartbeat'][i],
          timestamp: new Date(now - (5 - i) * 10000).toISOString(),
          sequence: seqCounter.val,
        });
      }
    }
    console.log(`  ${isOnline ? '🟢' : '⚫'} ${name} (${info.role}) — ${info.duty}`);
  }

  cc.metricsData = {
    '银月': { totalTokens: 158230, llmCalls: 1247, totalMessages: 3892, avgResponseTimeMs: 1820 },
    '李长寿': { totalTokens: 342100, llmCalls: 2810, totalMessages: 8452, avgResponseTimeMs: 1450 },
    '药老': { totalTokens: 95670, llmCalls: 892, totalMessages: 2105, avgResponseTimeMs: 2100 },
  };
  for (const name of Object.keys(cc.metricsData)) {
    cc.metricsData[name].updatedAt = new Date().toISOString();
  }

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

  console.log(`\n[Dashboard] ✅ 已注册 ${agentNames.length} 位 Agent`);
  console.log(`             🟢 在线 ${onlineAgents.length} | ⚫ 离线 ${agentNames.length - onlineAgents.length}`);
  console.log(`             🌐 http://127.0.0.1:4310/`);
}

main().catch(e => {
  console.error('[Dashboard] 启动失败:', e.message);
  process.exit(1);
});
