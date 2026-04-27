function stripTrailingPunct(s) {
  let out = String(s || '').trim();
  if (!out) return '';
  out = out.replace(/^[<\u300a\u300b]+/, '').replace(/[>\u300a\u300b]+$/, '');
  while (out.length > 0 && /[)\]\s"'，,。.;:；、!?！？…》】]+$/.test(out)) out = out.slice(0, -1);
  return out.trim();
}

function canonicalizeUrl(u) {
  const s = stripTrailingPunct(u);
  if (!s) return '';
  try {
    const url = new URL(s);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function extractUrls(text, limit) {
  const s = String(text || '');
  const re = /https?:\/\/[^\s<>()]+/gi;
  const found = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    const u = canonicalizeUrl(m[0]);
    if (!u) continue;
    if (!found.includes(u)) found.push(u);
    const lim = typeof limit === 'number' ? limit : 6;
    if (found.length >= lim) break;
  }
  return found;
}

function decodeHtmlEntities(text) {
  let s = String(text || '');
  if (!s) return '';
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d);
      if (!Number.isFinite(n)) return '';
      try {
        return String.fromCodePoint(n);
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const n = parseInt(String(h || ''), 16);
      if (!Number.isFinite(n)) return '';
      try {
        return String.fromCodePoint(n);
      } catch {
        return '';
      }
    });
  return s;
}

function stripHtmlToText(html, maxChars) {
  let s = String(html || '');
  if (!s) return '';
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<\/(p|div|br|li|h[1-6])\s*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeHtmlEntities(s);
  s = s.replace(/\r/g, '\n');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  const lim = typeof maxChars === 'number' ? maxChars : 1800;
  if (lim > 0 && s.length > lim) s = s.slice(0, lim).trim();
  return s;
}

function findAttr(tag, attrName) {
  const re1 = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i');
  const re2 = new RegExp(`${attrName}\\s*=\\s*'([^']*)'`, 'i');
  return (String(tag || '').match(re1) || String(tag || '').match(re2))?.[1] || '';
}

function findMetaByName(html, name) {
  const s = String(html || '');
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tag = m[0];
    const n = findAttr(tag, 'name');
    if (String(n || '').toLowerCase() !== String(name || '').toLowerCase()) continue;
    const c = findAttr(tag, 'content');
    if (c) return decodeHtmlEntities(c).trim();
  }
  return '';
}

function findMetaByProperty(html, prop) {
  const s = String(html || '');
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tag = m[0];
    const p = findAttr(tag, 'property');
    if (String(p || '').toLowerCase() !== String(prop || '').toLowerCase()) continue;
    const c = findAttr(tag, 'content');
    if (c) return decodeHtmlEntities(c).trim();
  }
  return '';
}

function findCanonicalLink(html) {
  const s = String(html || '');
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const tag = m[0];
    const rel = findAttr(tag, 'rel');
    if (String(rel || '').toLowerCase() !== 'canonical') continue;
    const href = findAttr(tag, 'href');
    if (href) return stripTrailingPunct(decodeHtmlEntities(href)).trim();
  }
  return '';
}

function parseHtmlMeta(html) {
  const s = String(html || '');
  const titleRaw = (s.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const title = decodeHtmlEntities(titleRaw).replace(/\s+/g, ' ').trim();
  const description = findMetaByName(s, 'description');
  const ogTitle = findMetaByProperty(s, 'og:title');
  const ogDescription = findMetaByProperty(s, 'og:description');
  const canonical = findCanonicalLink(s);
  return {
    title,
    description,
    ogTitle,
    ogDescription,
    canonical,
  };
}

module.exports = {
  canonicalizeUrl,
  extractUrls,
  parseHtmlMeta,
  stripHtmlToText,
};
