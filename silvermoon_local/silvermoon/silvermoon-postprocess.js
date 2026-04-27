function normalizeText(s) {
  return String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripBannedPhrases(text) {
  let s = normalizeText(text);
  s = s.replace(/工具不可用/g, '外部检索暂时无回传');
  s = s.replace(/无法直接提供/g, '我先基于已知信息给你判断');
  s = s.replace(/无法获取相关(信息|资料)/g, '我先基于已知信息给你判断');
  s = s.replace(/由于工具.*?无法.*?(?:\n|$)/g, '');
  return s.trim();
}

function looksMachineyOrUseless(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (/工具不可用|外部检索暂时无回传|无法直接提供|无法获取/.test(s)) return true;
  if (/结论：.*工具/i.test(s) && /证据：.*不可用/i.test(s)) return true;
  if (s.length < 60) return true;
  return false;
}

function postprocessSilvermoonReply({ replyText, userText, channelId, memorySearch }) {
  const raw = normalizeText(replyText).trim();
  if (!raw) return raw;

  let cleaned = stripBannedPhrases(raw);

  if (looksMachineyOrUseless(cleaned)) {
    return '主人，银月暂时无法获取有效信息，请换个问题试试。';
  }

  return cleaned;
}

module.exports = { postprocessSilvermoonReply };
