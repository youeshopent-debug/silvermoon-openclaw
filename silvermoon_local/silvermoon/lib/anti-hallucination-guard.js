function hasHallucinationTrigger(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  if (/dropbox\.com/i.test(s)) return true;
  if (/(^|[^a-z])x{6,}([^a-z]|$)/i.test(s)) return true;
  if (/(已上传|网盘链接)/i.test(s)) return true;
  if (/(详见|见)\s*(?:链接|dropbox)/i.test(s)) return true;
  if (/dropbox\s*链接/i.test(s)) return true;
  return false;
}

function collectEmbedText(embeds) {
  const arr = Array.isArray(embeds) ? embeds : [];
  const parts = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const t = String(e.title || '').trim();
    const d = String(e.description || '').trim();
    if (t) parts.push(t);
    if (d) parts.push(d);
    const fields = Array.isArray(e.fields) ? e.fields : [];
    for (const f of fields) {
      const n = String(f?.name || '').trim();
      const v = String(f?.value || '').trim();
      if (n) parts.push(n);
      if (v) parts.push(v);
    }
  }
  return parts.join('\n');
}

function stripDangerousTokens(text) {
  let s = String(text || '');
  s = s.replace(/https?:\/\/\S+/gi, '');
  s = s.replace(/x{6,}/gi, '');
  s = s.replace(/(已上传|网盘链接|dropbox\s*链接)/gi, '');
  s = s.replace(/(详见|见)\s*(?:链接|dropbox)/gi, '');
  s = s.replace(/[ \t]{2,}/g, ' ').trim();
  return s;
}

function guardOutgoingText(text, opts) {
  const s = String(text || '');
  if (!hasHallucinationTrigger(s)) return { blocked: false, text: s };
  const resolveEvidence = typeof opts?.resolveEvidence === 'function' ? opts.resolveEvidence : null;
  const ev = resolveEvidence ? resolveEvidence(s) : null;
  if (!ev || !ev.absPath) {
    return {
      blocked: true,
      text: [
        '🚨 主人',
        '🔹 检测到疑似外链/伪交付表述，已拦截',
        '🔹 未发现可核验的本地文件证据（DROPBOX/... 或 workspace/... 或本机绝对路径）',
        '🔹 真实情况：当前没有可验收的文件产物',
        '🔹 处理建议：把内容直接贴在聊天窗口；或先生成真实文件再汇报路径',
      ].join('\n'),
    };
  }
  const safeRel = typeof opts?.formatEvidence === 'function' ? String(opts.formatEvidence(ev) || '').trim() : '';
  const sizeKb = typeof ev.size === 'number' ? Math.max(1, Math.round(ev.size / 1024)) : null;
  const lines = [];
  lines.push('⚠️ 主人');
  lines.push('🔹 检测到外链/上传/占位符表述，已拦截并改为事实回执');
  lines.push(`🔹 已核验本地文件存在：${safeRel || ev.baseName || '（已存在）'}`);
  if (sizeKb != null) lines.push(`🔹 文件大小：约 ${sizeKb}KB`);
  const cleaned = stripDangerousTokens(s);
  if (cleaned && cleaned.length >= 6) lines.push(`🔹 原回复已净化：${cleaned}`.trim());
  return { blocked: true, text: lines.join('\n') };
}

function guardOutgoingPayload(payload, opts) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const content = String(p.content || '');
  const embeds = Array.isArray(p.embeds) ? p.embeds : null;
  const joined = [content, collectEmbedText(embeds)].filter(Boolean).join('\n');
  if (!hasHallucinationTrigger(joined)) return { blocked: false, payload: p };
  const g = guardOutgoingText(joined, opts);
  return { blocked: true, payload: { content: g.text } };
}

module.exports = {
  hasHallucinationTrigger,
  collectEmbedText,
  guardOutgoingText,
  guardOutgoingPayload,
};

