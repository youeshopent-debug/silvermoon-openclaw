'use strict';

const { fetch } = require('undici');
const https = require('https');
const http = require('http');

const PROXY = { host: '127.0.0.1', port: 7890 };

function proxyAgent(url) {
  const isHttps = String(url || '').startsWith('https');
  const mod = isHttps ? https : http;
  return new (mod.Agent)({
    proxy: PROXY,
    keepAlive: true,
    timeout: 15000,
  });
}

async function fetchWithProxy(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout || 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      dispatcher: proxyAgent(url),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(opts.headers || {}),
      },
      ...(opts.fetchOpts || {}),
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function googleAutocompleteSuggestions(keyword, lang = 'en') {
  const q = encodeURIComponent(String(keyword || '').trim());
  if (!q) return [];
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${q}&hl=${lang}`;
  try {
    const resp = await fetchWithProxy(url, { timeout: 8000 });
    const txt = await resp.text();
    const match = txt.match(/\[.*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    const suggestions = Array.isArray(parsed) && Array.isArray(parsed[1]) ? parsed[1].map(s => String(s[0] || '').trim()).filter(Boolean) : [];
    return suggestions;
  } catch {
    return [];
  }
}

async function googleKeywordIdeas(seedKeyword, lang = 'en') {
  const q = encodeURIComponent(String(seedKeyword || '').trim());
  if (!q) return [];
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const allSuggestions = new Set();
  const batchSize = 5;
  const batches = [];
  for (let i = 0; i < letters.length; i += batchSize) {
    batches.push(letters.slice(i, i + batchSize).split(''));
  }
  for (const batch of batches) {
    const promises = batch.map(async (letter) => {
      const suggestions = await googleAutocompleteSuggestions(`${seedKeyword} ${letter}`, lang);
      suggestions.forEach(s => allSuggestions.add(s));
    });
    await Promise.all(promises);
    await new Promise(r => setTimeout(r, 300));
  }
  return Array.from(allSuggestions).slice(0, 100);
}

async function googleSearchResults(query, numResults = 10) {
  const q = encodeURIComponent(String(query || '').trim());
  if (!q) return [];
  const url = `https://www.google.com/search?q=${q}&num=${Math.min(numResults, 20)}&hl=en`;
  try {
    const resp = await fetchWithProxy(url, { timeout: 15000 });
    const html = await resp.text();
    const results = [];
    const linkRegex = /<a[^>]*href="\/url\?q=([^"&]+)[^"]*"[^>]*>(.*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = decodeURIComponent(match[1]);
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (url && title && !url.includes('google.com') && !url.includes('youtube.com')) {
        results.push({ title, url, snippet: '' });
      }
      if (results.length >= numResults) break;
    }
    const snippetRegex = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>(.*?)<\/div>/gi;
    let snippetIdx = 0;
    while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
      results[snippetIdx].snippet = match[1].replace(/<[^>]+>/g, '').trim();
      snippetIdx++;
    }
    return results;
  } catch {
    return [];
  }
}

async function analyzePageSeo(url) {
  try {
    const resp = await fetchWithProxy(url, { timeout: 15000 });
    const html = await resp.text();
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i) || [])[1] || '';
    const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
    const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
    const ogImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
    const wordCount = html.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
    const hasSchema = html.includes('application/ld+json') || html.includes('itemscope') || html.includes('itemprop');
    const hasViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
    const hasRobots = html.includes('name="robots"') || html.includes("name='robots'");
    const imgAlts = [...html.matchAll(/<img[^>]+alt=["']([^"']*)["']/gi)].filter(m => m[1].trim()).length;
    const imgTotal = (html.match(/<img[^>]+>/gi) || []).length;
    const internalLinks = [...html.matchAll(/<a[^>]+href=["'](?!https?:\/\/|\/\/)[^"']*["']/gi)].length;
    const externalLinks = [...html.matchAll(/<a[^>]+href=["']https?:\/\/(?!.*google\.com)[^"']*["']/gi)].length;
    return {
      url,
      title: title.trim(),
      metaDescription: description.trim(),
      h1: h1.replace(/<[^>]+>/g, '').trim(),
      h1Count: h1s.length,
      h2Count: h2s.length,
      canonical: canonical || 'missing',
      ogTitle: ogTitle || 'missing',
      ogDesc: ogDesc || 'missing',
      ogImage: ogImage || 'missing',
      wordCount,
      hasSchema,
      hasViewport,
      hasRobots,
      imgAltsRatio: imgTotal > 0 ? `${imgAlts}/${imgTotal}` : '0/0',
      internalLinks,
      externalLinks,
    };
  } catch {
    return null;
  }
}

async function seoAudit(url) {
  const page = await analyzePageSeo(url);
  if (!page) return { ok: false, reason: 'unable_to_fetch' };
  const issues = [];
  const warnings = [];
  if (!page.title) issues.push('Missing <title> tag');
  else if (page.title.length < 10) warnings.push('Title too short (< 10 chars)');
  else if (page.title.length > 60) warnings.push('Title too long (> 60 chars)');
  if (!page.metaDescription) issues.push('Missing meta description');
  else if (page.metaDescription.length < 50) warnings.push('Meta description too short (< 50 chars)');
  else if (page.metaDescription.length > 160) warnings.push('Meta description too long (> 160 chars)');
  if (!page.h1) issues.push('Missing H1 tag');
  if (page.h1Count > 1) warnings.push(`Multiple H1 tags (${page.h1Count})`);
  if (!page.canonical || page.canonical === 'missing') warnings.push('Missing canonical URL');
  if (!page.hasViewport) issues.push('Missing viewport meta tag');
  if (!page.hasSchema) warnings.push('No structured data (JSON-LD/schema) found');
  if (page.imgAltsRatio === '0/0') warnings.push('No images found');
  else {
    const [alts, total] = page.imgAltsRatio.split('/').map(Number);
    if (total > 0 && alts < total) warnings.push(`${total - alts} images missing alt text`);
  }
  return {
    ok: true,
    url: page.url,
    score: Math.max(0, 100 - issues.length * 15 - warnings.length * 5),
    issues,
    warnings,
    details: page,
  };
}

async function seoSearch(query, opts = {}) {
  const type = String(opts.type || 'keyword').trim();
  const lang = String(opts.lang || 'en').trim();
  const q = String(query || '').trim();
  if (!q) return { ok: false, reason: 'missing_query' };
  if (type === 'keyword') {
    const suggestions = await googleAutocompleteSuggestions(q, lang);
    const ideas = await googleKeywordIdeas(q, lang);
    return {
      ok: true,
      type: 'keyword_research',
      query: q,
      autocomplete: suggestions.slice(0, 10),
      keywordIdeas: ideas.slice(0, 50),
      totalIdeas: ideas.length,
    };
  }
  if (type === 'serp') {
    const results = await googleSearchResults(q, opts.numResults || 10);
    return {
      ok: true,
      type: 'serp',
      query: q,
      results: results.slice(0, opts.numResults || 10),
      totalResults: results.length,
    };
  }
  if (type === 'audit') {
    return await seoAudit(q);
  }
  return { ok: false, reason: 'unknown_type' };
}

module.exports = {
  seoSearch,
  googleAutocompleteSuggestions,
  googleKeywordIdeas,
  googleSearchResults,
  analyzePageSeo,
  seoAudit,
};
