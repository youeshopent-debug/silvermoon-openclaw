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
 * @param {Function} [deps.searchMemory]   - 搜索记忆（FTS5 关键词）
 * @param {Function} [deps.semanticSearch] - 语义搜索（RAG/Embedding）
 * @param {Function} [deps.getSystemInfo]  - 获取系统信息
 * @param {Function} [deps.listFiles]      - 列出文件
 */
function registerPresets(deps = {}) {
  // 记忆搜索（FTS5 关键词）
  if (deps.searchMemory) {
    register({
      name: 'memory_search',
      description: '搜索长期记忆',
      triggers: [
        /^!搜索\s/i, /^!search\s/i, /^!记忆\s/i, /^!memory\s/i,
        /搜索(一下)?记忆/i, /search\s*memory/i,
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

  // 语义搜索（RAG/Embedding）
  if (deps.semanticSearch) {
    register({
      name: 'semantic_search',
      description: '语义搜索记忆（RAG），适合模糊/概念性查询',
      requireApproval: false,
      triggers: [
        /^!语义\s/i, /^!rag\s/i, /^!概念\s/i,
        /语义搜索/i, /rag\s*search/i, /概念搜索/i,
      ],
      handler: async (text, ctx) => {
        const query = text
          .replace(/^!(语义|rag|概念)\s*/i, '')
          .replace(/语义搜索[:：]?\s*/i, '')
          .replace(/rag\s*search[:：]?\s*/i, '')
          .trim();
        if (!query) {
          const t = { zh: '主人，请告诉银月要搜索什么概念～例如「!语义 三层记忆架构」', en: 'Master, tell me what concept to search for～e.g. "!rag three-layer memory"', ms: 'Tuan, sila beritahu konsep yang hendak dicari～' };
          return t[ctx.lang] || t.zh;
        }
        const results = await deps.semanticSearch(query, { limit: 5 });
        if (!results?.ok || !results.items?.length) {
          const t = { zh: `主人，银月未找到与「${query}」语义相关的记忆～`, en: `Master, I couldn't semantically find memories related to "${query}"~`, ms: `Tuan, Yin Yue tidak menemui memori berkaitan "${query}"~` };
          return t[ctx.lang] || t.zh;
        }
        const header = { zh: `✅ 主人，银月通过语义搜索找到以下与「${query}」相关的内容：`, en: `✅ Master, here are semantically related memories to "${query}":`, ms: `✅ Tuan, berikut memori berkaitan "${query}":` };
        const lines = [header[ctx.lang] || header.zh, ''];
        results.items.forEach((r, i) => {
          lines.push(`🔹 ${i + 1}. [${r.score}] ${r.content.slice(0, 500)}`);
          if (r.at) lines.push(`   📅 ${r.at}`);
        });
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

// ─── Chrome CDP 桥接工具注册 ────────────────────────────────

/**
 * 注册 Chrome CDP 桥接工具
 * 让 Agent 通过自然语言操控已登录的 Chrome
 * @param {object} chrome - chrome-cdp-bridge 模块引用
 */
function registerChromeTools(chrome) {
  register({
    name: 'chrome_connect',
    description: '连接 Chrome CDP',
    triggers: [
      /^(连接|打开)\s*(chrome|浏览器)/i,
      /^(connect|open)\s*(chrome|browser)/i,
    ],
    handler: async () => {
      const r = await chrome.connect();
      return `✅ 已连接 Chrome CDP (${r.tabs} 个标签页)`;
    },
  });

  register({
    name: 'chrome_disconnect',
    description: '断开 Chrome CDP',
    triggers: [
      /^(断开|关闭)\s*(chrome|浏览器)/i,
      /^(disconnect|close)\s*(chrome|browser)/i,
    ],
    handler: async () => {
      await chrome.disconnect();
      return '✅ 已断开 Chrome CDP';
    },
  });

  register({
    name: 'chrome_navigate',
    description: '在 Chrome 中打开网址',
    triggers: [
      /^chrome\s+(打开|去|go|open)\s+/i,
      /^(在浏览器|chrome)\s*(打开|访问|去)\s+/i,
      /^(帮我)?\s*(打开|访问|去|开一下)\s+/i,
    ],
    handler: async (text) => {
      let url = text.replace(/^chrome\s+(打开|去|go|open)\s+/i, '')
        .replace(/^(在浏览器|chrome)\s*(打开|访问|去)\s+/i, '')
        .replace(/^(帮我)?\s*(打开|访问|去|开一下)\s+/i, '')
        .trim();
      if (!url) return '⚠️ 主人，请告诉银月要打开什么网址～';
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      try {
        const info = await chrome.navigate(fullUrl);
        return `✅ 已打开: ${info.title || info.url}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  // ── 直连搜索兜底（不依赖 Chrome CDP）──
  async function _directSearch(query, site) {
    const _fetch = typeof fetch !== 'undefined' ? fetch : require('child_process').execSync;
    // 清理查询词：去中文填充词、去site前缀
    const _query = query.replace(/^(我要找|帮我找|找一下|查一下|搜一下|查找)\s*/i, '').trim();
    const _isGitHub = /github|git/i.test(site || '');
    const _isGitQuery = /^(github|git)\s/i.test(_query);
    if (_isGitHub || _isGitQuery) {
      const q = _query.replace(/^(github|git)\s*/i, '').trim();
      try {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=5`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'SilverMoonBot/1.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data = await res.json();
        if (!data.items || data.items.length === 0) {
          return `🔍 GitHub 搜索「${q}」无结果`;
        }
        const lines = [`🔍 GitHub 搜索「${q}」结果 (${data.total_count} 条):`, ''];
        data.items.slice(0, 5).forEach((r, i) => {
          lines.push(`  ${i+1}. ⭐ ${r.stargazers_count} | ${r.full_name}`);
          lines.push(`     ${r.description ? r.description.substring(0, 80) : '(无描述)'}`);
          lines.push(`     ${r.html_url}`);
          lines.push('');
        });
        return lines.join('\n');
      } catch (e) {
        return `⚠️ GitHub 搜索失败: ${e.message}。也可以直接访问 https://github.com/search?q=${encodeURIComponent(q)}`;
      }
    }
    // 通用网页搜索：用 DuckDuckGo lite
    try {
      const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(_query)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();
      const titles = [...html.matchAll(/<a[^>]+rel="nofollow"[^>]*>([^<]+)<\/a>/gi)];
      const snippets = [...html.matchAll(/<td[^>]*class="result-snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/td>/gi)];
      if (titles.length === 0) {
        return `🔍 搜索「${_query}」未找到结果。试试直接访问浏览器搜索。`;
      }
      const lines = [`🔍 搜索结果「${_query}」:`, ''];
      titles.slice(0, 5).forEach((t, i) => {
        const snippet = snippets[i] ? snippets[i][1].replace(/<[^>]+>/g, '').substring(0, 80) : '';
        lines.push(`  ${i+1}. ${t[1].trim()}`);
        if (snippet) lines.push(`     ${snippet}`);
      });
      lines.push('', '💡 要更精确的结果，可启动 Chrome 远程调试后重试');
      return lines.join('\n');
    } catch (e) {
      return `⚠️ 网页搜索失败: ${e.message}。可手动打开浏览器搜索。`;
    }
  }

  register({
    name: 'chrome_search',
    description: '搜索（支持Chrome/CDP兜底）',
    triggers: [
      /^(帮我)?\s*(搜索|搜一下|搜)\s*/i,
      /^(帮我)?\s*(找一下|查一下|查找)\s+/i,
      /^search\s+/i,
    ],
    handler: async (text) => {
      const raw = text.replace(/^(帮我)?\s*(搜索|搜一下|搜)\s*/i, '')
        .replace(/^(帮我)?\s*(找一下|查一下|查找)\s+/i, '')
        .replace(/^search\s+/i, '')
        .trim()
        .replace(/^[，,、\s]+/, '');
      if (!raw) return '⚠️ 主人，请告诉银月要搜索什么～';
      // 清理中文填充词（"我要找"、"帮我找"等）
      const cleanQuery = (s) => s.replace(/^(我要找|帮我找|找一下|查一下|搜一下|查找)\s*/i, '').trim();
      const siteMatch = raw.match(/^(github|git|google|淘宝|京东|亚马逊|shopify)[\s，,\u3000]+(.+)/i);
      let query, searchUrl, site;
      if (siteMatch) {
        site = siteMatch[1].toLowerCase();
        const q = cleanQuery(siteMatch[2].trim());
        query = q;
        const searchMap = {
          github: 'https://github.com/search?q=',
          git: 'https://github.com/search?q=',
          google: 'https://www.google.com/search?q=',
        };
        if (searchMap[site]) {
          searchUrl = searchMap[site] + encodeURIComponent(q);
        } else {
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(site + ' ' + q)}`;
        }
      } else {
        query = cleanQuery(raw);
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
      // 优先 Chrome CDP，失败则直连兜底
      try {
        await chrome.ensureConnected();
        const info = await chrome.navigate(searchUrl);
        return `✅ 已通过 Chrome 搜索「${query}」\n📄 ${info.title || info.url}`;
      } catch (e) {
        return await _directSearch(query, site);
      }
    },
  });

  register({
    name: 'chrome_screenshot',
    description: 'Chrome 截图',
    triggers: [
      /^chrome\s*(截图|screenshot)/i,
      /^(浏览器|页面)\s*(截图|screenshot)/i,
    ],
    handler: async () => {
      try {
        const info = await chrome.getPageInfo();
        return `⚠️ 截图已保存（Agent 需从 buffer 提取）\n📄 当前页面: ${info.title}\n${info.url}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  register({
    name: 'chrome_tabs',
    description: '列出 Chrome 标签页',
    triggers: [
      /^chrome\s*(标签|tab|tabs)/i,
      /^列出\s*(chrome|浏览器)\s*(标签|tab)/i,
    ],
    handler: async () => {
      try {
        const tabs = await chrome.listTabs();
        const lines = tabs.map((t) => `  [${t.index}] ${t.title}\n      ${t.url}`);
        return `📋 Chrome 标签页 (${tabs.length}):\n${lines.join('\n')}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  register({
    name: 'chrome_click',
    description: '在 Chrome 中点击元素',
    triggers: [
      /^chrome\s+(点击|click)\s+/i,
      /^(在浏览器|页面)\s*(点击|单击)\s+/i,
    ],
    handler: async (text) => {
      const selector = text.replace(/^chrome\s+(点击|click)\s+/i, '')
        .replace(/^(在浏览器|页面)\s*(点击|单击)\s+/i, '')
        .trim();
      try {
        await chrome.click(selector);
        return `✅ 已点击: ${selector}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  register({
    name: 'chrome_fill',
    description: '在 Chrome 中输入文字',
    triggers: [
      /^chrome\s+(输入|fill|type)\s+/i,
      /^(在浏览器|页面)\s*(输入|填写)\s+/i,
    ],
    handler: async (text) => {
      const rest = text.replace(/^chrome\s+(输入|fill|type)\s+/i, '')
        .replace(/^(在浏览器|页面)\s*(输入|填写)\s+/i, '');
      const sep = rest.includes('  ') ? '  ' : rest.includes('，') ? '，' : ' ';
      const parts = rest.split(sep).filter(Boolean);
      if (parts.length < 2) return '⚠️ 格式: chrome 输入 <选择器> <值>';
      const selector = parts[0].trim();
      const value = parts.slice(1).join(sep).trim();
      try {
        await chrome.fill(selector, value);
        return `✅ 已输入至 ${selector}: ${value.substring(0, 30)}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  register({
    name: 'chrome_info',
    description: '查看 Chrome 当前页面信息',
    triggers: [
      /^chrome\s*(info|状态|信息)/i,
      /^(浏览器|页面)\s*(信息|状态|info)/i,
    ],
    handler: async () => {
      try {
        const info = await chrome.getPageInfo();
        return `📄 当前页面:\n  标题: ${info.title}\n  URL: ${info.url}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  register({
    name: 'chrome_cookies',
    description: '查看 Chrome 当前页面 Cookie',
    triggers: [
      /^chrome\s*(cookie|cookies|登录)/i,
      /^(浏览器)\s*(cookie|cookies)/i,
    ],
    handler: async () => {
      try {
        const c = await chrome.getCookies();
        return `🍪 Cookies: ${c.cookieCount} 个\n🏠 LocalStorage: ${c.localStorageCount} 项`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });

  register({
    name: 'chrome_evaluate',
    description: '在 Chrome 中执行 JavaScript',
    triggers: [
      /^chrome\s+(eval|run|执行|js)\s+/i,
    ],
    handler: async (text) => {
      const script = text.replace(/^chrome\s+(eval|run|执行|js)\s+/i, '').trim();
      try {
        const result = await chrome.evaluate(script);
        const str = typeof result === 'object' ? JSON.stringify(result, null, 2).substring(0, 500) : String(result).substring(0, 500);
        return `✅ 执行结果:\n${str}`;
      } catch (e) {
        return '⚠️ Chrome远程调试未连接，请先双击桌面(启动Chrome远程调试.bat)，然后再说一遍';
      }
    },
  });
}

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  register,
  tryRoute,
  registerBangCommands,
  registerPresets,
  registerChromeTools,
  listTools,
};
