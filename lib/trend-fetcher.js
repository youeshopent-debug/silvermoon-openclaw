const https = require('https');
const http = require('http');

const TREND_SOURCES = [
  { name: 'producthunt', url: 'https://api.producthunt.com/v1/posts?sort_by=votes_count&per_page=10' },
  { name: 'hackernews', url: 'https://hacker-news.firebaseio.com/v0/topstories.json' },
];

const DEEP_CALM_KEYWORDS = [
  'sleep', 'anxiety', 'meditation', 'mental health', 'wellness', 'mindfulness',
  'relaxation', 'stress relief', 'calm', 'deep calm', 'neural', 'brain health',
  'cognitive', 'focus', 'mood', 'serotonin', 'gaba', 'insomnia', 'therapy',
  'self care', 'mental wellness', 'health tech', 'ai health', 'digital wellness',
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, headers: { 'User-Agent': 'OpenClaw/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

function scoreTopic(topic) {
  const text = (topic.title + ' ' + (topic.description || '')).toLowerCase();
  let score = 0;
  for (const kw of DEEP_CALM_KEYWORDS) {
    if (text.includes(kw)) score += 3;
  }
  if (text.includes('ai') || text.includes('tech')) score += 1;
  const now = Date.now();
  const age = now - (topic.createdAt || now);
  const hoursOld = age / 3600000;
  if (hoursOld < 24) score += 2;
  if (hoursOld < 6) score += 1;
  score += Math.min((topic.votes || 0) / 100, 5);
  return score;
}

async function fetchHackerNews() {
  try {
    const ids = await httpsGet(TREND_SOURCES[1].url);
    if (!Array.isArray(ids)) return [];
    const topIds = ids.slice(0, 30);
    const items = await Promise.all(
      topIds.map(id => httpsGet(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null))
    );
    return items.filter(Boolean).map(item => ({
      source: 'hackernews',
      title: item.title || '',
      description: item.text || item.title || '',
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      votes: item.score || 0,
      createdAt: (item.time || 0) * 1000,
    }));
  } catch { return []; }
}

async function fetchTrends(count = 5) {
  const all = [];
  const hn = await fetchHackerNews();
  all.push(...hn);
  for (const src of all) src.score = scoreTopic(src);
  all.sort((a, b) => (b.score || 0) - (a.score || 0));
  return all.slice(0, count);
}

module.exports = { fetchTrends, TREND_SOURCES, DEEP_CALM_KEYWORDS, scoreTopic };
