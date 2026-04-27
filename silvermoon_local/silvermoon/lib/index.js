const fs = require('fs');
const path = require('path');

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

async function executeTool({ name, args, ctx }) {
  const n = String(name || '').trim();
  if (n === 'webSearch') return toolWebSearch(args, ctx);
  if (n === 'tailErrors') return toolTailErrors(args, ctx);
  if (n === 'readFileSafe') return toolReadFileSafe(args, ctx);
  if (n === 'proposeExec') return toolProposeExec(args, ctx);
  return { ok: false, reason: 'unknown_tool', name: n };
}

module.exports = { executeTool };
