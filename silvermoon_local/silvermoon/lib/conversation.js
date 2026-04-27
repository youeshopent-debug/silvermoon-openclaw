function classifyComplexity(text) {
  const s = String(text || '').trim().toLowerCase();
  if (!s) return { level: 0, reason: 'empty' };
  const len = s.length;
  if (len < 10) return { level: 0, reason: 'short_greeting' };
  if (len < 60) return { level: 1, reason: 'simple_query' };
  if (len < 200) return { level: 2, reason: 'normal' };
  return { level: 3, reason: 'deep_task' };
}

function getLlmParams(level) {
  const map = {
    0: { model: 'qwen3:4b', maxTokens: 256, temperature: 0.7 },
    1: { model: 'qwen3:4b', maxTokens: 512, temperature: 0.7 },
    2: { model: 'qwen3-coder-next:latest', maxTokens: 1024, temperature: 0.6 },
    3: { model: 'qwen3-coder-next:latest', maxTokens: 2048, temperature: 0.5 },
  };
  return map[level] || map[2];
}

const _sentMap = new Map();

function isDuplicate(channelId, text) {
  const key = `${channelId}:${String(text || '').slice(0, 40)}`;
  const now = Date.now();
  const prev = _sentMap.get(key);
  if (prev && now - prev < 8000) return true;
  _sentMap.set(key, now);
  for (const [k, v] of _sentMap) {
    if (now - v > 120000) _sentMap.delete(k);
  }
  return false;
}

module.exports = { classifyComplexity, getLlmParams, isDuplicate };
