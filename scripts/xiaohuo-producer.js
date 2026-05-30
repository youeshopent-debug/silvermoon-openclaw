// 小医仙 · TikTok 增长专家产出脚本
// 1) 生成脚本实验室输出（垂直卡片流，移动端友好）
// 2) 生成 CEO 简报 → 投递到银月审核队列

const fs = require('fs');
const path = require('path');

const DISPATCH_FILE = path.join(__dirname, '..', '.silvermoon_core', 'dispatched_tasks.jsonl');

// ── 脚本实验室 · 垂直卡片输出 ──
function formatScriptLab({ hook, scenes, cta, vibeNotes, paymentFunnel }) {
  const lines = [];
  lines.push('');
  lines.push('🎬 脚本实验室 · 小医仙产出');
  lines.push('');
  lines.push(`🔥 Hook（前 3 秒）`);
  lines.push(`${hook}`);
  lines.push('');
  lines.push('📽️ 分镜');
  for (const s of (scenes || [])) {
    lines.push(`⏱️ ${s.time}`);
    lines.push(`📹 ${s.visual}`);
    lines.push(`🎙️ ${s.audio}`);
    lines.push('');
  }
  lines.push(`🛒 CTA`);
  lines.push(`${cta}`);
  lines.push('');
  if (vibeNotes) {
    lines.push('🎨 Vibe Coding 视觉');
    lines.push(`${vibeNotes}`);
    lines.push('');
  }
  if (paymentFunnel) {
    lines.push('💳 支付转化漏斗');
    lines.push(`${paymentFunnel}`);
    lines.push('');
  }
  return lines.join('\n');
}

// ── CEO 简报 · 投递到银月审核队列 ──
function submitCEOBriefing({ title, script, strategyNotes, targetAudience }) {
  const entry = {
    at: new Date().toISOString(),
    target: '银月',
    source: '小医仙',
    priority: 'high',
    status: 'pending',
    task: [
      '📋 CEO 简报 · 请审核',
      '',
      `📌 ${title}`,
      '',
      ...(script ? [`🎬 脚本\n${script}`] : []),
      ...(strategyNotes ? [`📊 策略说明\n${strategyNotes}`] : []),
      ...(targetAudience ? [`🎯 目标受众\n${targetAudience}`] : []),
      '',
      '⚠️ 请银月核对品牌调性后 👍 批准执行',
    ].join('\n'),
  };

  try {
    const existing = fs.existsSync(DISPATCH_FILE)
      ? fs.readFileSync(DISPATCH_FILE, 'utf-8').trim()
      : '';
    const line = JSON.stringify(entry);
    fs.writeFileSync(DISPATCH_FILE, existing ? `${existing}\n${line}\n` : `${line}\n`, 'utf-8');
    console.log(`[小医仙] CEO 简报已投递 → 银月审核队列: ${title}`);
    return { ok: true, ref: entry.at };
  } catch (e) {
    console.error(`[小医仙] 简报投递失败:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── 首次提案：离职重启账号 · 第一波流量爆破 ──
function proposeAccountRestartPlan() {
  const plan = formatScriptLab({
    hook: '🔥 我辞了上一份工，All-in 做技术 Creator。\n前 3 秒：屏幕录制 VS Code + Terminal 快速切换，配上 "I quit my job to build in public." 字幕。',
    scenes: [
      { time: '0-3s', visual: 'VS Code 屏幕录制，快速敲代码 + 切换 Terminal', audio: '🔥 (键盘敲击音效) I quit my job to build in public.' },
      { time: '3-8s', visual: '切到数字人（紫妍渲染），穿连帽衫坐办公桌前', audio: 'No more meetings. No more Jira tickets. Just me, my MacBook, and a vision.' },
      { time: '8-15s', visual: 'Split screen：左 AI 工作流仪表盘 / 右 Shopify 销售实时数据', audio: 'I built an AI automation stack that processes payments, manages inventory, and generates content — all on autopilot.' },
      { time: '15-20s', visual: '数字人展示产品（手机屏幕 / Mac 屏幕），突出 Stripe / LS 收益', audio: 'And the best part? It generates revenue while I sleep.' },
      { time: '20-28s', visual: '数字人直视镜头 + 字幕 "Want the blueprint? Link in bio."', audio: "I documented the entire stack. From zero to automated income. Grab the blueprint — it's your turn." },
    ],
    cta: '🔗 Link in bio → "The Indie Maker Stack"\n💬 Comment "STACK" for a free snippet',
    vibeNotes: 'Dark mode VS Code · Tokyo Night 主题 · 快速切换 Terminal · 数字人穿简约黑色 + 暖光灯\n全程无 UI 干扰元素，一眼 Builder 调性',
    paymentFunnel: '💳 Lemon Squeezy 低价引导 ($9.99 "Indie Stack Blueprint") → upsell ($49 "Full Stack + 1-on-1 Call")\n🎁 前 100 单送 Notion Template（裂变传播触发词）',
  });

  const briefing = {
    title: '🔥 离职重启 · 第一波流量爆破方案',
    script: plan,
    strategyNotes: [
      '📌 策略：Build in Public 叙事是最低成本的冷启动',
      '',
      'Day 1-3: 每天 1 条 "离职倒计时/搭建栈" 系列',
      'Day 4-7: 产品落地展示 + 收益数字（无数字不火）',
      'Day 7-14: 用户证言 + 教程切片（信任积累）',
      'Day 14-21: 定价公布 + 限时折扣（迫购）',
      '',
      '🔥 前 3 秒必须抓住：离职 → Build in Public → 收益数字',
      '⚠️ 不可碰的雷区：虚假炫富/过度承诺/与中国大陆相关的政治身份话题',
    ].join('\n'),
    targetAudience: [
      '🎯 核心人群：25-35 岁技术从业者',
      '· 正在考虑副业/独立开发的程序员',
      '· 对 AI 自动化感兴趣的技术创业者',
      '· 搜索 "passive income" "indie hacking" "build in public" 标签的用户',
      '',
      '📍 投放建议：US/UK/CA 英语区 TikTok + Instagram Reels 同步',
    ].join('\n'),
  };

  const result = submitCEOBriefing(briefing);
  console.log(`[小医仙] 离职重启方案已生成，${result.ok ? '等待银月审核中' : '投递失败'}`);
  return result;
}

// ── CLI 入口 ──
if (require.main === module) {
  const action = process.argv[2] || 'propose';
  switch (action) {
    case 'propose':
      proposeAccountRestartPlan();
      break;
    case 'brief':
      submitCEOBriefing({
        title: process.argv[3] || '手动提审',
        script: process.argv[4] || '(见附件)',
        strategyNotes: process.argv[5] || '',
        targetAudience: process.argv[6] || '',
      });
      break;
    default:
      console.log(`用法: node scripts/xiaohuo-producer.js [propose|brief]`);
  }
}

module.exports = { formatScriptLab, submitCEOBriefing, proposeAccountRestartPlan };
