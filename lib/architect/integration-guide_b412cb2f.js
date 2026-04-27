/**
 * main.js — OpenClaw 2.0 重构版入口
 *
 * 这是集成指南文件，展示如何将所有模块组装到 main.js
 * 将此文件的内容合并到你现有的 main.js 中
 *
 * 模块架构：
 *   lib/intent.js        → 意图分类 + 正则拦截（8 种意图，三语）
 *   lib/memory.js         → SQLite FTS5 长期记忆
 *   lib/prompt-builder.js → 精简版 System Prompt（三语）
 *   lib/sanitizer.js      → 后处理管道（字符限制替代行数限制）
 *   lib/tool-router.js    → 确定性工具分发（替代 LLM JSON tool call）
 *   lib/agents.js         → 多角色管理
 *   lib/cron.js           → 定时任务管理
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// 第 1 部分：模块引入（替换原有硬编码逻辑）
// ═══════════════════════════════════════════════════════════════

const { tryIntentIntercept, detectLang } = require('./lib/intent');
const memory = require('./lib/memory');
const { buildSystemPrompt, buildAgentPrompt } = require('./lib/prompt-builder');
const { sanitize } = require('./lib/sanitizer');
const toolRouter = require('./lib/tool-router');
const agents = require('./lib/agents');
const cron = require('./lib/cron');

// ... 保留你现有的其他 require（discord.js, dotenv, etc.）


// ═══════════════════════════════════════════════════════════════
// 第 2 部分：启动初始化（在 client.once('ready') 中）
// ═══════════════════════════════════════════════════════════════

/*
client.once('ready', async () => {
  console.log(`[OpenClaw] ${client.user.tag} 已上线`);

  // ── 2.1 初始化记忆系统 ──
  memory.init();  // 默认路径，或 memory.init('/your/custom/path.sqlite')

  // （可选）一次性迁移旧 JSONL 数据
  // memory.migrateFromJsonl(LONG_TERM_DB_PATH);

  // ── 2.2 初始化角色系统 ──
  agents.init({
    agentsDir: AGENTS_DIR,  // 你现有的 AGENTS_DIR 路径
    // customAgents: { ... }  // 可选覆盖
  });

  // ── 2.3 注册工具 ──
  // 迁移现有 !commands
  toolRouter.registerBangCommands({
    // 将你现有的 !command 处理函数放在这里
    // status: handleStatusCommand,
    // help:   handleHelpCommand,
    // brief:  handleBriefCommand,
  });

  // 注册预设工具
  toolRouter.registerPresets({
    searchMemory: (q, opts) => memory.search(q, opts),
    getSystemInfo: () => ({
      uptime: formatUptime(process.uptime()),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      activeAgents: agents.listAgents().length,
      memoryRecords: memory.stats().totalRecords,
    }),
  });

  // ── 2.4 注册并启动定时任务 ──
  cron.registerPresets({
    buildMorningBrief,     // 你现有的函数
    buildNightlyReport,    // 你现有的函数（如有）
    consolidateMemory: () => memory.purgeOlderThan(90),  // 90天前的记忆自动清理
    sendToChannel: async (channelId, text) => {
      const ch = await client.channels.fetch(channelId);
      if (ch) await ch.send(text);
    },
    briefChannelId: process.env.BRIEF_CHANNEL_ID,
  });
  cron.startAll();
});
*/


// ═══════════════════════════════════════════════════════════════
// 第 3 部分：消息处理（替换 messageCreate 处理器）
// ═══════════════════════════════════════════════════════════════

/*
client.on('messageCreate', async (message) => {
  // ── 3.0 基础过滤 ──
  if (message.author.bot) return;
  const userMessage = message.content.trim();
  if (!userMessage) return;

  const channelId = message.channel.id;
  const lang = detectLang(userMessage);

  // ── 3.1 角色切换检测 ──
  const switchIntent = agents.detectAgentSwitch(userMessage);
  if (switchIntent.shouldSwitch) {
    const result = agents.switchAgent(channelId, switchIntent.targetAgent);
    if (result.success) {
      await message.reply(agents.formatSwitchReply(result.agent, lang));
    } else {
      await message.reply(result.error);
    }
    return;
  }

  // ── 3.2 意图拦截（正则优先，零 API 消耗） ──
  const intercepted = await tryIntentIntercept(userMessage, {
    fetchUsdMyr,          // 你现有的函数
    fetchMetalsSpotUsd,   // 你现有的函数
    fetchCryptoUsd,       // 你现有的函数
    formatNum,            // 你现有的函数
    fetchWeather,         // 你现有的函数（如有）
    fetchNews,            // 你现有的函数（如有）
    setReminder: (ms, content) => {
      setTimeout(async () => {
        const t = lang === 'en' ? `Master, reminder: ${content}`
                : lang === 'ms' ? `Tuan, peringatan: ${content}`
                : `主人，提醒您：${content}`;
        await message.channel.send(t);
      }, ms);
      return true;
    },
    timezone: 'Asia/Kuala_Lumpur',
  });

  if (intercepted) {
    await message.reply(intercepted);
    // 记录到记忆
    memory.append({ channel: channelId, role: 'user', content: userMessage, tags: 'query' });
    memory.append({ channel: channelId, role: 'assistant', content: intercepted, tags: 'query,auto' });
    return;
  }

  // ── 3.3 工具路由（确定性分发） ──
  const toolResult = await toolRouter.tryRoute(userMessage, {
    fetchUsdMyr, fetchMetalsSpotUsd, fetchCryptoUsd, formatNum,
  });

  if (toolResult.matched) {
    if (toolResult.requireApproval) {
      // 发送审批请求（保留你现有的审批门控逻辑）
      const approvalMsg = await message.reply(`⚠️ 操作需要审批：${toolResult.tool}`);
      // ... 你现有的 reaction 审批逻辑
    } else {
      await message.reply(toolResult.result);
    }
    return;
  }

  // ── 3.4 LLM 处理（兜底） ──

  // 获取当前频道的角色
  const currentAgent = agents.getChannelAgent(channelId);

  // 构建 system prompt（精简版）
  const recentMemory = memory.getRecent(channelId, 10);
  const contextStr = recentMemory.map((m) => `[${m.role}] ${m.content}`).join('\n');

  const systemPrompt = currentAgent.name === '银月'
    ? buildSystemPrompt({
        userMessage,
        context: contextStr,
        dateStr: new Date().toLocaleDateString('zh-CN'),
        agentPersona: currentAgent.extendedPersona,
      })
    : buildAgentPrompt(currentAgent, {
        userMessage,
        context: contextStr,
        dateStr: new Date().toLocaleDateString('zh-CN'),
      });

  // 调用 LLM（保留你现有的 askHermes 路由链）
  const rawReply = await askHermes({
    systemPrompt,
    userMessage,
    // ... 其他参数
  });

  // 后处理（精简版管道）
  const reply = sanitize(rawReply, {
    agent: currentAgent.name,
    channelId,
    userText: userMessage,
    emphasizeLinks,  // 你现有的函数
    // taskContractHandler: enforceTaskContractResponse,  // 如需保留
    // postprocessHook: ...  // 如需保留银月专属后处理
  });

  // 发送回复
  await message.reply(reply);

  // 记录到记忆
  memory.append({ channel: channelId, role: 'user', content: userMessage });
  memory.append({ channel: channelId, role: 'assistant', content: reply });
});
*/


// ═══════════════════════════════════════════════════════════════
// 第 4 部分：进程退出处理
// ═══════════════════════════════════════════════════════════════

/*
process.on('SIGINT', () => {
  console.log('[OpenClaw] 正在关闭...');
  cron.stopAll();
  memory.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[OpenClaw] 收到终止信号...');
  cron.stopAll();
  memory.close();
  client.destroy();
  process.exit(0);
});
*/


// ═══════════════════════════════════════════════════════════════
// 第 5 部分：辅助函数（如尚未定义）
// ═══════════════════════════════════════════════════════════════

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
