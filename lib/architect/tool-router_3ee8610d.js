/**
 * tool-router.js — 确定性工具分发器
 * 替代 LLM 驱动的 JSON tool call，用确定性路由处理工具调用
 *
 * 设计思路：
 *   旧方案：用户消息 → LLM 生成 JSON → 解析 → 调用工具 → 失败率高
 *   新方案：用户消息 → 正则匹配意图 → 直接调用对应工具 → 100% 可靠
 *
 * 与 intent.js 的区别：
 *   - intent.js 处理"查询类"意图（汇率、金价等），直接返回格式化文本
 *   - tool-router.js 处理"动作类"意图（文件操作、系统命令等），执行操作后返回结果
 */

'use strict';

const { detectLang } = require('./intent');

// ─── 工具注册表 ─────────────────────────────────────────────

/**
 * 工具定义
 * @typedef {object} ToolDef
 * @property {string}   name        - 工具名称
 * @property {string}   description - 工具描述（用于日志/调试）
 * @property {RegExp[]} triggers    - 触发正则列表
 * @property {Function} handler     - 处理函数 (text, deps) => Promise<string|null>
 * @property {boolean}  [requireApproval] - 是否需要主人审批
 */

/** @type {ToolDef[]} */
const tools = [];

/**
 * 注册一个工具
 * @param {ToolDef} toolDef
 */
function register(toolDef) {
  if (!toolDef.name || !toolDef.triggers || !toolDef.handler) {
    throw new Error(`[tool-router] Invalid tool definition: ${JSON.stringify(toolDef)}`);
  }
  // 避免重复注册
  const existing = tools.findIndex((t) => t.name === toolDef.name);
  if (existing >= 0) {
    tools[existing] = toolDef;
  } else {
    tools.push(toolDef);
  }
  console.log(`[tool-router] Registered tool: ${toolDef.name}`);
}

// ─── 匹配 & 分发 ───────────────────────────────────────────

/**
 * 尝试匹配工具并执行
 * @param {string} text - 用户消息
 * @param {object} deps - 依赖注入（传递给 handler）
 * @returns {Promise<{ matched: boolean, tool?: string, result?: string, requireApproval?: boolean }>}
 */
async function tryRoute(text, deps = {}) {
  if (!text || typeof text !== 'string') {
    return { matched: false };
  }

  const cleaned = text.trim();
  const lang = detectLang(cleaned);

  for (const tool of tools) {
    for (const re of tool.triggers) {
      if (re.test(cleaned)) {
        console.log(`[tool-router] Matched tool: ${tool.name}`);

        // 如果工具需要审批，先返回等待审批状态
        if (tool.requireApproval) {
          return {
            matched: true,
            tool: tool.name,
            requireApproval: true,
            result: null,
            // 将 handler 暂存，审批通过后再执行
            _pendingHandler: () => tool.handler(cleaned, { ...deps, lang }),
          };
        }

        try {
          const result = await tool.handler(cleaned, { ...deps, lang });
          return {
            matched: true,
            tool: tool.name,
            result: result || '',
          };
        } catch (err) {
          console.error(`[tool-router] Tool ${tool.name} error:`, err.message);
          const errorMsg = {
            zh: `主人，执行 ${tool.name} 时遇到问题：${err.message}`,
            en: `Master, encountered an issue executing ${tool.name}: ${err.message}`,
            ms: `Tuan, menghadapi masalah semasa menjalankan ${tool.name}: ${err.message}`,
          };
          return {
            matched: true,
            tool: tool.name,
            result: errorMsg[lang] || errorMsg.zh,
          };
        }
      }
    }
  }

  return { matched: false };
}

// ─── 内置工具：!command 处理 ────────────────────────────────

/**
 * 将现有的 !command 迁移为注册式工具
 * 在 main.js 启动时调用此函数注册所有 ! 命令
 *
 * @param {object} commands - 现有命令映射 { commandName: handlerFn }
 */
function registerBangCommands(commands) {
  for (const [name, handler] of Object.entries(commands)) {
    register({
      name: `cmd_${name}`,
      description: `!${name} command`,
      triggers: [new RegExp(`^!${name}(?:\\s|$)`, 'i')],
      handler: async (text, deps) => {
        const args = text.replace(new RegExp(`^!${name}\\s*`, 'i'), '').trim();
        return handler(args, deps);
      },
    });
  }
}

// ─── 预设常用工具 ───────────────────────────────────────────

/**
 * 注册一组常用的预设工具
 * 调用时传入对应的依赖函数
 *
 * @param {object} deps
 * @param {Function} [deps.searchMemory]   - 搜索记忆
 * @param {Function} [deps.getSystemInfo]  - 获取系统信息
 * @param {Function} [deps.listFiles]      - 列出文件
 */
function registerPresets(deps = {}) {
  // 记忆搜索
  if (deps.searchMemory) {
    register({
      name: 'memory_search',
      description: '搜索长期记忆',
      triggers: [
        /^!搜索\s/i, /^!search\s/i, /^!记忆\s/i, /^!memory\s/i,
        /搜索(一下)?记忆/i, /search\s*memory/i,
        /帮我(找|搜|回忆)/i,
      ],
      handler: async (text, ctx) => {
        const query = text
          .replace(/^!(搜索|search|记忆|memory)\s*/i, '')
          .replace(/搜索(一下)?记忆[:：]?\s*/i, '')
          .replace(/search\s*memory[:：]?\s*/i, '')
          .replace(/帮我(找|搜|回忆)[:：]?\s*/i, '')
          .trim();
        if (!query) {
          const t = { zh: '主人，请告诉银月要搜索什么内容～', en: 'Master, please tell me what to search for~', ms: 'Tuan, sila beritahu apa yang perlu dicari~' };
          return t[ctx.lang] || t.zh;
        }
        const results = await deps.searchMemory(query, { limit: 5 });
        if (!results || results.length === 0) {
          const t = { zh: `主人，银月未找到与「${query}」相关的记忆～`, en: `Master, I couldn't find any memories related to "${query}"~`, ms: `Tuan, Yin Yue tidak menemui memori berkaitan "${query}"~` };
          return t[ctx.lang] || t.zh;
        }
        const header = { zh: `✅ 主人，银月找到以下与「${query}」相关的记忆：`, en: `✅ Master, here are memories related to "${query}":`, ms: `✅ Tuan, berikut memori berkaitan "${query}":` };
        const lines = [header[ctx.lang] || header.zh, ''];
        results.slice(0, 5).forEach((r, i) => {
          const snippet = String(r.content || '').substring(0, 80).replace(/\n/g, ' ');
          lines.push(`🔹 ${i + 1}. ${snippet}${r.content.length > 80 ? '...' : ''}`);
          if (r.timestamp) lines.push(`   📅 ${r.timestamp}`);
        });
        const footer = { zh: '\n如有其他需要，随时吩咐银月～', en: '\nLet me know if you need anything else~', ms: '\nJika ada keperluan lain, sila beritahu Yin Yue~' };
        lines.push(footer[ctx.lang] || footer.zh);
        return lines.join('\n');
      },
    });
  }

  // 系统状态
  if (deps.getSystemInfo) {
    register({
      name: 'system_status',
      description: '查看系统状态',
      triggers: [
        /^!status$/i, /^!系统$/i, /^!system$/i,
        /系统状态/i, /system\s*status/i,
      ],
      handler: async (text, ctx) => {
        const info = await deps.getSystemInfo();
        const header = { zh: '✅ 主人，以下是系统状态：', en: '✅ Master, here\'s the system status:', ms: '✅ Tuan, berikut status sistem:' };
        const lines = [header[ctx.lang] || header.zh, ''];
        if (info.uptime) lines.push(`🔹 Uptime：${info.uptime}`);
        if (info.memory) lines.push(`🔹 Memory：${info.memory}`);
        if (info.activeAgents) lines.push(`🔹 Active Agents：${info.activeAgents}`);
        if (info.memoryRecords) lines.push(`🔹 Memory Records：${info.memoryRecords}`);
        return lines.join('\n');
      },
    });
  }
}

// ─── 工具列表查询 ───────────────────────────────────────────

/**
 * 获取已注册的工具列表（用于帮助/调试）
 * @returns {Array<{ name: string, description: string }>}
 */
function listTools() {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    requireApproval: !!t.requireApproval,
  }));
}

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  register,
  tryRoute,
  registerBangCommands,
  registerPresets,
  listTools,
};
