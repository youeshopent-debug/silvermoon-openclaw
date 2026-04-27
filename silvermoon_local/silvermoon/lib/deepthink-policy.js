function stripPrefixOnce(s, prefix) {
  const raw = String(s || '');
  const p = String(prefix || '');
  const t = raw.trimStart();
  if (!p) return { hit: false, text: raw };
  if (!t.startsWith(p)) return { hit: false, text: raw };
  const idx = raw.indexOf(p);
  const after = raw.slice(idx + p.length);
  return { hit: true, text: after.trimStart() };
}

function parseInterventionPrefix(text) {
  const raw = String(text || '');
  let mode = null;
  let t = raw;
  const a = stripPrefixOnce(t, '[强制深思]');
  if (a.hit) {
    mode = 'force_on';
    t = a.text;
  }
  const b = stripPrefixOnce(t, '[极速执行]');
  if (b.hit) {
    mode = 'force_off';
    t = b.text;
  }
  return { mode, text: t };
}

function isDeepThinkTriggerText(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  return /(详细资料|报告|深挖|复盘|根因|尽调|背调)/.test(s);
}

function resolveDeepThinkStatus(rawText) {
  const parsed = parseInterventionPrefix(rawText);
  const trigger = isDeepThinkTriggerText(parsed.text);
  if (parsed.mode === 'force_on') {
    return { enabled: true, status: '开-最高权限强制开启', mode: 'force_on', text: parsed.text, trigger: false };
  }
  if (parsed.mode === 'force_off') {
    return { enabled: false, status: '关-最高权限极速跳过', mode: 'force_off', text: parsed.text, trigger, };
  }
  if (trigger) {
    return { enabled: true, status: '自动-命中触发词', mode: 'auto_on', text: parsed.text, trigger: true };
  }
  return { enabled: false, status: '关-未命中触发词', mode: 'auto_off', text: parsed.text, trigger: false };
}

module.exports = {
  parseInterventionPrefix,
  isDeepThinkTriggerText,
  resolveDeepThinkStatus,
};
