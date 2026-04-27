async function sendDiscordWithFallback(msg, payload) {
  const errors = [];
  const p =
    typeof payload === 'string'
      ? { content: payload }
      : payload && typeof payload === 'object'
        ? payload
        : { content: String(payload || '') };

  const canReply = !!(msg && typeof msg.reply === 'function');
  if (canReply) {
    try {
      const out = await msg.reply(p);
      return { ok: true, via: 'reply', message: out || null, errors };
    } catch (e) {
      errors.push(String(e?.message || e || 'reply_failed'));
    }
  } else {
    errors.push('reply_unavailable');
  }

  const canSend = !!(msg && msg.channel && typeof msg.channel.send === 'function');
  if (canSend) {
    try {
      const out = await msg.channel.send(p);
      return { ok: true, via: 'send', message: out || null, errors };
    } catch (e) {
      errors.push(String(e?.message || e || 'send_failed'));
    }
  } else {
    errors.push('send_unavailable');
  }

  return { ok: false, via: 'none', message: null, errors };
}

module.exports = { sendDiscordWithFallback };

