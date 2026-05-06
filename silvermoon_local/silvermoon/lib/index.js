const fs = require('fs');
const path = require('path');
const { toolTaskManager } = require('./task-manager');
const { getDispatchHistory } = require('./dispatch-consumer');

function tailLines(text, maxLines) {
  const n = Math.max(1, Number(maxLines || 0) || 50);
  const lines = String(text || '').split(/\r?\n/);
  const out = lines.slice(-n).join('\n').trim();
  return out;
}

async function toolTailErrors(args, ctx) {
  const maxLines = Math.max(1, Number(args?.maxLines || 0) || 80);
  const baseDir = String(ctx?.baseDir || process.cwd());
  const p = path.join(baseDir, 'workspace', 'CRON', 'errors.jsonl');
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    return { ok: true, path: p, text: tailLines(raw, maxLines) };
  } catch (e) {
    return { ok: false, reason: 'unavailable', path: p, error: String(e?.message || e) };
  }
}

async function toolReadFileSafe(args, ctx) {
  const baseDir = String(ctx?.baseDir || process.cwd());
  const rel = String(args?.path || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel) return { ok: false, reason: 'missing_path' };
  if (rel.includes('..')) return { ok: false, reason: 'forbidden_path' };
  const abs = path.join(baseDir, rel);
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return { ok: false, reason: 'not_file' };
    const maxBytes = 64 * 1024;
    const raw = fs.readFileSync(abs);
    const buf = raw.length > maxBytes ? raw.subarray(0, maxBytes) : raw;
    return { ok: true, path: abs, text: buf.toString('utf-8') };
  } catch (e) {
    return { ok: false, reason: 'unavailable', path: abs, error: String(e?.message || e) };
  }
}

async function toolProposeExec(args, ctx) {
  const cmd = String(args?.cmd || '').trim();
  const channelId = String(ctx?.channelId || '').trim();
  const requestedBy = String(ctx?.requestedBy || '').trim();
  if (!cmd) return { ok: false, reason: 'missing_cmd' };
  return {
    ok: true,
    needApproval: true,
    plan: {
      kind: 'restricted_exec',
      args: { cmd },
      reason: 'LLM_proposed',
      channelId,
      requestedBy,
    },
  };
}

function stripCdata(s) {
  const t = String(s || '').trim();
  const m = /^<!\[CDATA\[([\s\S]*?)\]\]>$/i.exec(t);
  return m ? String(m[1] || '').trim() : t;
}

function parseRssItems(xml, limit) {
  const src = String(xml || '');
  const out = [];
  const reItem = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = reItem.exec(src)) !== null) {
    const block = m[0];
    const t = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const l = /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    const title = stripCdata(t ? t[1] : '');
    const url = stripCdata(l ? l[1] : '');
    if (title && url) out.push({ title, url, snippet: '' });
    if (out.length >= limit) break;
  }
  return out;
}

function buildGoogleNewsRssUrl(q) {
  const qq = encodeURIComponent(String(q || '').trim());
  return `https://news.google.com/rss/search?q=${qq}&hl=zh-CN&gl=MY&ceid=MY:zh-Hans`;
}

async function toolWebSearch(args, ctx) {
  const q = String(args?.query || '').trim();
  if (!q) return { ok: false, reason: 'missing_query' };
  try {
    const { tavilySearch } = require('../tavily-search');
    const r = await tavilySearch(q, { maxResults: 5, searchDepth: 'basic' });
    if (r) {
      const items = (r.results || []).slice(0, 5).map((x) => ({
        title: String(x.title || '').trim(),
        url: String(x.url || '').trim(),
        snippet: String(x.snippet || '').trim(),
        publishedDate: x.publishedDate || null,
        source: x.source || null,
      }));
      return { ok: true, query: r.query, results: items, source: 'tavily' };
    }

    const f =
      typeof ctx?.fetchImpl === 'function'
        ? ctx.fetchImpl
        : (typeof fetch === 'function' ? fetch : require('undici').fetch);
    const url = buildGoogleNewsRssUrl(q);
    const resp = await f(url);
    const txt = await resp.text();
    if (!resp.ok) return { ok: false, reason: 'unavailable', error: `HTTP ${resp.status}` };
    const items = parseRssItems(txt, 5);
    if (!items.length) return { ok: false, reason: 'unavailable' };
    return { ok: true, query: q, results: items, source: 'google_news_rss' };
  } catch (e) {
    return { ok: false, reason: 'unavailable', error: String(e?.message || e) };
  }
}

async function toolCrawlee(args, ctx) {
  const action = String(args?.action || '').trim();
  const urls = Array.isArray(args?.urls) ? args.urls : [];
  const keywords = Array.isArray(args?.keywords) ? args.keywords : [];
  const sites = Array.isArray(args?.sites) ? args.sites : ['1688.com', 'aliexpress.com', 'amazon.com'];

  try {
    const xiaoyanCrawler = require('../../lib/xiaoyan-crawler');
    if (action === 'crawlUrl' && urls.length > 0) {
      const r = await xiaoyanCrawler.crawlUrl(urls[0]);
      return { ok: true, ...r };
    }
    if (action === 'crawlEcommerce' && keywords.length > 0) {
      const r = await xiaoyanCrawler.crawlEcommerce(keywords, sites);
      return { ok: true, ...r };
    }
    if (action === 'crawlByKeywords' && keywords.length > 0) {
      const r = await xiaoyanCrawler.crawlByKeywords(keywords);
      return { ok: true, ...r };
    }
    if (action === 'summary') {
      const r = xiaoyanCrawler.getDataSummary();
      return { ok: true, data: r };
    }
    return { ok: false, reason: 'invalid_action_or_params', action };
  } catch (e) {
    return { ok: false, reason: 'crawler_error', error: String(e?.message || e) };
  }
}

async function toolZeroTokenAuth(args, ctx) {
  const action = String(args?.action || 'status').trim();
  try {
    const baseDir = ctx?.baseDir || process.cwd();
    const authPath = path.join(baseDir, 'lib/zero-token-auth');
    const auth = require(authPath);
    if (action === 'status') {
      const r = await auth.checkStatus();
      return { ok: true, platforms: r };
    }
    if (action === 'open') {
      setImmediate(() => auth.openAllForLogin().catch(e => console.error('zero-token-auth error:', e)));
      return { ok: true, message: '浏览器已打开，请在浏览器中登录各平台' };
    }
    return { ok: false, reason: 'unknown_action', action };
  } catch (e) {
    return { ok: false, reason: 'zero_token_auth_error', error: String(e?.message || e) };
  }
}

async function toolGithubSearch(args, ctx) {
  const q = String(args?.query || '').trim();
  if (!q) return { ok: false, reason: 'missing_query' };
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=5`;
    const f = typeof fetch === 'function' ? fetch : require('undici').fetch;
    const res = await f(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'SilverMoonBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    const items = (data.items || []).slice(0, 5).map((r) => ({
      name: r.full_name,
      stars: r.stargazers_count,
      description: (r.description || '').substring(0, 120),
      url: r.html_url,
      language: r.language || '',
      updated: r.updated_at || '',
    }));
    return { ok: true, query: q, total: data.total_count || 0, results: items, source: 'github_api' };
  } catch (e) {
    return { ok: false, reason: 'github_api_error', error: String(e?.message || e), query: q };
  }
}

function findSectsRoot(baseDir) {
  let dir = path.resolve(String(baseDir || process.cwd()));
  for (let i = 0; i < 5; i++) {
    const test = path.join(dir, 'sects');
    if (fs.existsSync(test) && fs.statSync(test).isDirectory()) return test;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(baseDir, '..', '..', 'sects');
}

async function toolDiscoverAgent(args, ctx) {
  const agentName = String(args?.name || '').trim();
  if (!agentName) return { ok: false, reason: 'missing_name' };
  try {
    const baseDir = ctx?.baseDir || process.cwd();
    const sectsRoot = findSectsRoot(baseDir);
    const dirs = fs.readdirSync(sectsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
    const match = dirs.find(d => {
      const lowerDir = d.name.toLowerCase().replace(/[\s_-]/g, '');
      const lowerSearch = agentName.toLowerCase().replace(/[\s_-]/g, '');
      return lowerDir.includes(lowerSearch) || lowerSearch.includes(lowerDir);
    });
    if (!match) {
      const allNames = dirs.map(d => d.name);
      return { ok: true, found: false, searchName: agentName, allAgents: allNames };
    }
    const taskPath = path.join(sectsRoot, match.name, 'TASK.json');
    if (!fs.existsSync(taskPath)) {
      return { ok: true, found: true, name: match.name, task: null, summary: '已找到该代理，但无 TASK.json 配置' };
    }
    const raw = fs.readFileSync(taskPath, 'utf-8');
    const task = JSON.parse(raw);
    return {
      ok: true,
      found: true,
      name: task.name || match.name,
      role: task.role || null,
      priority: task.priority || null,
      instruction: task.instruction || null,
      skills: Array.isArray(task.skills) ? task.skills : [],
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      fallback: task.fallback || null,
    };
  } catch (e) {
    return { ok: false, reason: 'discover_error', error: String(e?.message || e) };
  }
}

async function toolListAllAgents(args, ctx) {
  try {
    const baseDir = ctx?.baseDir || process.cwd();
    const sectsRoot = findSectsRoot(baseDir);
    const dirs = fs.readdirSync(sectsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
    const agents = [];
    for (const d of dirs) {
      const taskPath = path.join(sectsRoot, d.name, 'TASK.json');
      if (!fs.existsSync(taskPath)) {
        agents.push({ name: d.name, role: '未知', status: '无TASK.json' });
        continue;
      }
      try {
        const raw = fs.readFileSync(taskPath, 'utf-8');
        const t = JSON.parse(raw);
        agents.push({
          name: t.name || d.name,
          role: t.role || '未知',
          priority: t.priority ?? null,
          skills: Array.isArray(t.skills) ? t.skills.map(s => String(s || '').split(':')[0]) : [],
          dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
        });
      } catch {
        agents.push({ name: d.name, role: '未知', status: 'TASK.json解析失败' });
      }
    }
    return { ok: true, count: agents.length, agents };
  } catch (e) {
    return { ok: false, reason: 'list_error', error: String(e?.message || e) };
  }
}

async function toolDispatchTask(args, ctx) {
  const target = String(args?.target || '').trim();
  const task = String(args?.task || '').trim();
  const priority = String(args?.priority || 'medium').trim().toLowerCase();
  if (!target || !task) return { ok: false, reason: 'missing_target_or_task' };
  try {
    const baseDir = ctx?.baseDir || process.cwd();
    const sectsRoot = findSectsRoot(baseDir);
    const dirs = fs.readdirSync(sectsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
    const match = dirs.find(d => {
      const lowerDir = d.name.toLowerCase().replace(/[\s_-]/g, '');
      const lowerSearch = target.toLowerCase().replace(/[\s_-]/g, '');
      return lowerDir.includes(lowerSearch) || lowerSearch.includes(lowerDir);
    });
    if (!match) return { ok: false, reason: 'target_not_found', searchName: target };
    const dispatchedDir = path.resolve(sectsRoot, '..', '.silvermoon_core');
    fs.mkdirSync(dispatchedDir, { recursive: true });
    const logPath = path.join(dispatchedDir, 'dispatched_tasks.jsonl');
    const entry = {
      at: new Date().toISOString(),
      target: match.name,
      task,
      priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      status: 'pending',
      source: '银月',
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf-8');
    return { ok: true, message: `任务已派发至【${match.name}】`, entry };
  } catch (e) {
    return { ok: false, reason: 'dispatch_error', error: String(e?.message || e) };
  }
}

async function toolGetDispatchHistory(args) {
  const limit = Number(args?.limit || 20);
  try {
    const entries = getDispatchHistory(limit);
    return { ok: true, count: entries.length, entries };
  } catch (e) {
    return { ok: false, reason: 'history_error', error: String(e?.message || e) };
  }
}

async function executeTool({ name, args, ctx }) {
  const n = String(name || '').trim();
  if (n === 'webSearch') return toolWebSearch(args, ctx);
  if (n === 'githubSearch') return toolGithubSearch(args, ctx);
  if (n === 'tailErrors') return toolTailErrors(args, ctx);
  if (n === 'readFileSafe') return toolReadFileSafe(args, ctx);
  if (n === 'proposeExec') return toolProposeExec(args, ctx);
  if (n === 'crawlee') return toolCrawlee(args, ctx);
  if (n === 'zeroTokenAuth') return toolZeroTokenAuth(args, ctx);
  if (n === 'seoSearch') return toolSeoSearch(args, ctx);
  if (n === 'taskManager') return toolTaskManager(args, ctx);
  if (n === 'discoverAgent') return toolDiscoverAgent(args, ctx);
  if (n === 'listAllAgents') return toolListAllAgents(args, ctx);
  if (n === 'dispatchTask') return toolDispatchTask(args, ctx);
  if (n === 'getDispatchHistory') return toolGetDispatchHistory(args, ctx);
  return { ok: false, reason: 'unknown_tool', name: n };
}

async function toolSeoSearch(args, ctx) {
  const query = String(args?.query || '').trim();
  const type = String(args?.type || 'keyword').trim();
  const lang = String(args?.lang || 'en').trim();
  const numResults = Number(args?.numResults || 10);
  if (!query) return { ok: false, reason: 'missing_query' };
  try {
    const { seoSearch } = require('../../lib/seo-search');
    const r = await seoSearch(query, { type, lang, numResults });
    return r;
  } catch (e) {
    return { ok: false, reason: 'seo_search_error', error: String(e?.message || e) };
  }
}

module.exports = { executeTool };
