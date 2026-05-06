const BASE = 'https://hacker-news.firebaseio.com/v0';

async function fetchNewsDigest() {
  const idsRes = await fetch(`${BASE}/topstories.json`, { signal: AbortSignal.timeout(10000) });
  if (!idsRes.ok) throw new Error(`HN topstories ${idsRes.status}`);
  const ids = await idsRes.json();
  const topIds = ids.slice(0, 10);

  const items = (await Promise.allSettled(
    topIds.map(id =>
      fetch(`${BASE}/item/${id}.json`, { signal: AbortSignal.timeout(5000) }).then(r => r.json())
    )
  )).filter(r => r.status === 'fulfilled').map(r => r.value).filter(Boolean);

  items.sort((a, b) => (b.score || 0) - (a.score || 0));
  const top2 = items.slice(0, 2).map(item => ({
    title: item.title || '',
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score || 0,
    by: item.by || '',
    summary: (item.title || '').split(/[.?!]/).filter(Boolean)[0] || '',
  }));

  return { source: 'HackerNews', fetchedAt: new Date().toISOString(), items: top2 };
}

if (require.main === module) {
  fetchNewsDigest().then(r => {
    r.items.forEach(item => console.log(`- ${item.title}\n  ${item.url} (${item.score} pts)`));
  }).catch(e => {
    console.error('news-digest 失败:', e.message);
    process.exit(1);
  });
}

module.exports = { fetchNewsDigest };
