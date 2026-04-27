function splitTextToChunks(text, limit) {
  const maxLen = Math.max(1, Number(limit || 1800));
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.length <= maxLen) return [trimmed];

  const lines = raw.split('\n').map((l) => String(l || '').trim()).filter((l) => l);
  if (!lines.length) return [];

  const chunks = [];
  let cur = '';
  const pushCur = () => {
    const t = cur.trim();
    if (t) chunks.push(t);
    cur = '';
  };

  for (const line of lines) {
    if (line.length > maxLen) {
      pushCur();
      for (let i = 0; i < line.length; i += maxLen) chunks.push(line.slice(i, i + maxLen));
      continue;
    }
    if (!cur) {
      cur = line;
      continue;
    }
    const next = `${cur}\n${line}`;
    if (next.length <= maxLen) {
      cur = next;
    } else {
      pushCur();
      cur = line;
    }
  }
  pushCur();

  return chunks.length ? chunks : [trimmed.slice(0, maxLen)];
}

module.exports = { splitTextToChunks };
