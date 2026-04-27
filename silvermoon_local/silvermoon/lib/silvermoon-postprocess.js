function normalizeText(s) {
  return String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function looksMachineyOrUseless(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (/^工具不可用$|^无法直接提供$|^无法获取/.test(s)) return true;
  if (/结论：.*工具/i.test(s) && /证据：.*不可用/i.test(s)) return true;
  return false;
}

function postprocessSilvermoonReply({ replyText, userText, channelId, memorySearch }) {
  const raw = normalizeText(replyText).trim();
  if (!raw) return raw;

  if (looksMachineyOrUseless(raw)) {
    return '主人，银月暂时无法获取有效信息，请换个问题试试。';
  }

  return raw;
}

module.exports = { postprocessSilvermoonReply };
