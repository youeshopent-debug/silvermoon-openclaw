const { fetch } = require('undici');

async function tavilySearch(query, opts = {}) {
  try {
    if (String(process.env.OPENCLAW_FORCE_NET_FAIL || '').trim() === '1') return null;
    const apiKey = String(process.env.TAVILY_API_KEY || '').trim();
    const q = String(query || '').trim();
    if (!apiKey || !q) return null;

    const timeoutMs = Number(opts.timeoutMs || process.env.TAVILY_TIMEOUT_MS || 8000);
    const maxResults = Number(opts.maxResults || 5);
    const searchDepth = String(opts.searchDepth || 'basic');
    const dispatcher = opts.dispatcher || undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(200, timeoutMs));
    try {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        signal: controller.signal,
        dispatcher,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'openclaw/1.0',
        },
        body: JSON.stringify({
          query: q,
          max_results: maxResults,
          search_depth: searchDepth,
          include_answer: false,
          include_raw_content: false,
        }),
      });

      const txt = await resp.text().catch(() => '');
      if (!resp.ok) return null;

      let j;
      try {
        j = JSON.parse(txt);
      } catch {
        return null;
      }

      const results = Array.isArray(j?.results) ? j.results : [];
      const cleaned = results
        .map((r) => ({
          title: String(r?.title || '').trim(),
          url: String(r?.url || '').trim(),
          snippet: String(r?.content || r?.snippet || '').trim(),
          score: typeof r?.score === 'number' ? r.score : null,
          publishedDate: r?.published_date ? String(r.published_date) : null,
          source: r?.source ? String(r.source) : null,
        }))
        .filter((r) => r.title && r.url);

      return cleaned.length ? { query: q, results: cleaned } : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

module.exports = { tavilySearch };
