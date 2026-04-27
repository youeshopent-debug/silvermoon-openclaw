const { canonicalizeUrl } = require('./link-inspector');

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const it of Array.isArray(arr) ? arr : []) {
    const s = String(it || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function isDossierRequest(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  return /(详细资料|报告|尽调|深挖|背调)/.test(s);
}

function stripTrackingParams(url) {
  const u = canonicalizeUrl(url);
  if (!u) return '';
  try {
    const x = new URL(u);
    const dropKeys = [];
    for (const [k] of x.searchParams) {
      const key = String(k || '').toLowerCase();
      if (key.startsWith('utm_')) dropKeys.push(k);
      else if (key === 'fbclid') dropKeys.push(k);
      else if (key === 'gclid') dropKeys.push(k);
      else if (key === 'yclid') dropKeys.push(k);
      else if (key === 'mc_cid') dropKeys.push(k);
      else if (key === 'mc_eid') dropKeys.push(k);
      else if (key === 'ref') dropKeys.push(k);
      else if (key === 'referrer') dropKeys.push(k);
      else if (key === 'source') dropKeys.push(k);
    }
    for (const k of dropKeys) x.searchParams.delete(k);
    const out = x.toString();
    return out;
  } catch {
    return u;
  }
}

function guessBrand(meta, url) {
  const title = String(meta?.ogTitle || meta?.title || '').replace(/\s+/g, ' ').trim();
  if (title) {
    const t = title.split('|')[0].split('—')[0].split('-')[0].trim();
    if (t && t.length >= 2 && t.length <= 48) return t;
  }
  try {
    const u = new URL(String(url || ''));
    const host = String(u.hostname || '').replace(/^www\./i, '').trim();
    if (!host) return '';
    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 2) return parts[0];
    return host;
  } catch {
    return '';
  }
}

function extractSameOriginCandidateUrlsFromHtml(html, baseUrl, maxCount) {
  const lim = typeof maxCount === 'number' ? maxCount : 10;
  let origin = '';
  try {
    origin = new URL(String(baseUrl || '')).origin;
  } catch {
    return [];
  }
  const s = String(html || '');
  if (!s) return [];
  const hrefRe = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  const keywords = [
    'about', 'about-us', 'company', 'legal', 'terms', 'term',
    'privacy', 'policy', 'pricing', 'fee', 'fees', 'plan', 'plans',
    'faq', 'help', 'support', 'contact',
  ];
  const found = [];
  let m;
  while ((m = hrefRe.exec(s)) !== null) {
    const raw = String(m[1] || m[2] || m[3] || '').trim();
    if (!raw) continue;
    if (raw.startsWith('#')) continue;
    if (/^javascript:/i.test(raw)) continue;
    let abs = '';
    try {
      abs = new URL(raw, baseUrl).toString();
    } catch {
      continue;
    }
    if (!abs.startsWith(origin)) continue;
    const low = abs.toLowerCase();
    if (!keywords.some((k) => low.includes('/' + k) || low.includes(k))) continue;
    const clean = stripTrackingParams(abs);
    if (!clean) continue;
    if (!found.includes(clean)) found.push(clean);
    if (found.length >= lim) break;
  }
  return found;
}

function extractKeyLines(text, patterns, limit) {
  const lim = typeof limit === 'number' ? limit : 8;
  const s = String(text || '').replace(/\r/g, '\n');
  const lines = s
    .split('\n')
    .map((x) => String(x || '').replace(/\s+/g, ' ').trim())
    .filter((x) => x && x.length >= 6);
  const ps = Array.isArray(patterns) ? patterns : [];
  const hit = [];
  for (const ln of lines) {
    const ok = ps.length ? ps.some((re) => re && re.test && re.test(ln)) : true;
    if (!ok) continue;
    hit.push(ln.slice(0, 220));
    if (hit.length >= lim) break;
  }
  return uniq(hit);
}

module.exports = {
  uniq,
  isDossierRequest,
  stripTrackingParams,
  guessBrand,
  extractSameOriginCandidateUrlsFromHtml,
  extractKeyLines,
};
