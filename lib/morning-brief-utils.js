const { fetch: undiciFetch, Agent: UndiciAgent } = require('undici');

function isLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase().trim();
  if (!h) return false;
  if (h === 'localhost') return true;
  if (h === '127.0.0.1') return true;
  if (h === '::1') return true;
  return false;
}

function isExternalHttpUrl(url) {
  let u;
  try {
    u = new URL(String(url || '').trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return !isLocalHostname(u.hostname);
}

function fetchWithTimeout(url, opts) {
  if (String(process.env.OPENCLAW_FORCE_NET_FAIL || '').trim() === '1' && isExternalHttpUrl(url)) {
    return Promise.reject(new Error('模拟断网：外部数据源不可用（OPENCLAW_FORCE_NET_FAIL=1）'));
  }
  const timeoutMs = Math.max(1, Number(opts?.timeoutMs || 0) || 0);
  const init = opts?.init || {};
  const dispatcher = opts?.dispatcher || null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs || 18_000);
  const merged = {
    ...init,
    signal: controller.signal,
    headers: {
      'User-Agent': 'openclaw/1.0',
      ...(init.headers || {}),
    },
  };
  if (dispatcher) merged.dispatcher = dispatcher;
  return undiciFetch(url, merged).finally(() => clearTimeout(timer));
}

function extractTextTag(block, tagName) {
  const reCdata = new RegExp(`<${tagName}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const raw = (block.match(reCdata) || block.match(re))?.[1];
  const txt = String(raw || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return txt || '';
}

function extractAtomLink(block) {
  const m1 = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i);
  if (m1?.[1]) return String(m1[1]).trim();
  const m2 = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
  const txt = String(m2?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return txt || '';
}

function parseRssAnyItems(xml, limit) {
  const s = String(xml || '');
  const max = Math.max(1, Number(limit || 0) || 20);
  const out = [];

  const reItem = /<item\b[\s\S]*?<\/item>/gi;
  let m;
  while ((m = reItem.exec(s)) !== null) {
    const block = m[0];
    const title = extractTextTag(block, 'title');
    const link = extractTextTag(block, 'link');
    if (!title || !link) continue;
    out.push({ title, link });
    if (out.length >= max) return out;
  }

  const reEntry = /<entry\b[\s\S]*?<\/entry>/gi;
  while ((m = reEntry.exec(s)) !== null) {
    const block = m[0];
    const title = extractTextTag(block, 'title');
    const link = extractAtomLink(block);
    if (!title || !link) continue;
    out.push({ title, link });
    if (out.length >= max) return out;
  }

  return out;
}

function truncateDiscordFieldValue(s) {
  const v = String(s || '');
  if (v.length <= 1024) return v;
  return v.slice(0, 1020) + '...';
}

function ensureDoubleNewline(s) {
  const v = String(s || '');
  if (/\n\n$/.test(v)) return v;
  if (/\n$/.test(v)) return v + '\n';
  return v + '\n\n';
}

function buildField(name, lines) {
  const arr = Array.isArray(lines) ? lines.filter((x) => String(x || '').trim()) : [];
  const valueRaw = (arr.length ? arr.join('\n') : '暂无').trim();
  const value = ensureDoubleNewline(truncateDiscordFieldValue(valueRaw));
  return { name: String(name || '').trim() || '信息', value, inline: false };
}

function buildMorningBriefFields(input) {
  return [
    buildField('⛅ 天气', input?.weatherLines),
    buildField('💱 汇率', input?.fxLines),
    buildField('🗞️ 新闻', input?.newsLines),
  ];
}

function truncateDiscordEmbedText(s, maxChars) {
  const max = Math.max(40, Number(maxChars || 0) || 0);
  const v = String(s || '');
  if (!max) return v;
  if (v.length <= max) return v;
  return v.slice(0, Math.max(0, max - 3)) + '...';
}

function buildCardEmbed(title, lines, color) {
  const arr = Array.isArray(lines) ? lines.filter((x) => String(x || '').trim()) : [];
  const raw = (arr.length ? arr.join('\n') : '暂无').trim();
  const desc = ensureDoubleNewline(truncateDiscordEmbedText(raw, 3900));
  const t = String(title || '').trim() || '信息';
  return { title: t.slice(0, 256), description: desc, color };
}

function buildMorningBriefEmbeds(input) {
  const tzNow = input?.tzNow instanceof Date ? input.tzNow : null;
  const at = String(input?.generatedAtText || (tzNow ? tzNow.toISOString() : '') || '').trim();
  const color = typeof input?.color === 'number' ? input.color : 0x2b90d9;

  const out = [];
  const headerDesc = [
    at ? `生成时间：${at}` : '生成时间：未知',
  ].filter(Boolean).join('\n');
  out.push({
    title: '📣 银月情报局 斗湖早报',
    description: ensureDoubleNewline(truncateDiscordEmbedText(headerDesc, 3900)),
    color,
  });

  out.push(buildCardEmbed('⛅ 天气', input?.weatherLines, color));
  out.push(buildCardEmbed('💰 金融', input?.fxLines, color));

  const cards = Array.isArray(input?.newsCards) ? input.newsCards : [];
  for (const c of cards) {
    const icon = String(c?.icon || '🗞️').trim() || '🗞️';
    const name = String(c?.name || '').trim();
    const headline = String(c?.headline || '').trim();
    const impact = String(c?.impact || '').trim();
    const lines = [];
    if (headline) lines.push(`${headline}`);
    if (impact) lines.push(`💼 影响：${impact}`);
    if (!lines.length) lines.push('暂无');
    out.push(buildCardEmbed(`${icon} ${name || '新闻'}`.trim(), lines, color));
    if (out.length >= 10) break;
  }

  return out.slice(0, 10);
}

function createDirectAgent() {
  return new UndiciAgent();
}

module.exports = {
  fetchWithTimeout,
  parseRssAnyItems,
  buildMorningBriefFields,
  buildMorningBriefEmbeds,
  createDirectAgent,
};
