function buildGeminiRequestBody({ system, user }) {
  const sys = String(system || '').trim();
  const u = String(user || '').trim();
  const parts = [];
  if (sys) parts.push({ text: sys });
  if (u) parts.push({ text: u });
  return {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.3,
    },
  };
}

function parseGeminiTextFromResponse(json) {
  try {
    const parts = json?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    const text = parts.map((p) => String(p?.text || '')).join('').trim();
    return text;
  } catch {
    return '';
  }
}

async function callGeminiText({ apiKey, model, system, user, history, fetchImpl, timeoutMs }) {
  const key = String(apiKey || '').trim();
  const m = String(model || '').trim();
  if (!key || !m) throw new Error('missing_gemini_config');
  const f = typeof fetchImpl === 'function' ? fetchImpl : (typeof fetch === 'function' ? fetch : require('undici').fetch);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(200, Number(timeoutMs || 0) || 12_000));
  try {
    const body = buildGeminiRequestBody({ system, user, history });
    const resp = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const txt = await resp.text().catch(() => '');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${txt}`);
    let j;
    try {
      j = JSON.parse(txt);
    } catch {
      return '';
    }
    return parseGeminiTextFromResponse(j);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { buildGeminiRequestBody, parseGeminiTextFromResponse, callGeminiText };

