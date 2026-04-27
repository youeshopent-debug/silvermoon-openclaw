function normalizeEnvKey(key) {
  let k = String(key || '').trim();
  if (!k) return '';
  k = k.replace(/^\uFEFF/, '');
  k = k.replace(/^(export)\s+/i, '');
  k = k.replace(/^[\-*•]+/, '').trim();
  k = k.replace(/\s+/g, '');
  return k;
}

function parseEnvText(raw) {
  const out = {};
  const lines = String(raw || '').split(/\r?\n/);
  for (const line of lines) {
    const s0 = String(line || '').trim();
    if (!s0) continue;
    if (s0.startsWith('#')) continue;
    const idx = s0.indexOf('=');
    if (idx <= 0) continue;
    const key0 = s0.slice(0, idx);
    const val0 = s0.slice(idx + 1);
    const key = normalizeEnvKey(key0);
    if (!key) continue;
    const val = String(val0 || '').trim();
    out[key] = val;
  }
  return out;
}

module.exports = { parseEnvText, normalizeEnvKey };

