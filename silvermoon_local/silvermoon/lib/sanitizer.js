function sanitize(text, opts = {}) {
  let out = String(text || '').trim();
  if (!out) return out;

  const charLimit = Number(opts?.charLimit) || 1500;

  if (typeof opts?.postprocessHook === 'function') {
    try {
      out = opts.postprocessHook({ replyText: out, userText: opts.userText, channelId: opts.channelId });
    } catch {}
  }

  if (out.length > charLimit) {
    out = out.slice(0, charLimit).trimEnd();
  }

  return out;
}

module.exports = { sanitize };
