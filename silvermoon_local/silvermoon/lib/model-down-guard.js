function isModelDownNoticeText(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (s.includes('127.0.0.1:11434')) return true;
  if (!/^⚠️\s*主人/.test(s)) return false;
  if (/Ollama|Groq/i.test(s) && /(无法连接|通道异常|已自动回退|下线)/.test(s)) return true;
  return false;
}

function toCompactModelDownReply(text) {
  const s = String(text || '').trim();
  if (!isModelDownNoticeText(s)) return s;
  return '✅ 我在线，已切到规则模式。你可以继续：对账入库、审批闸门（👍放行）、查状态/拉日志、生成晨报。';
}

module.exports = { isModelDownNoticeText, toCompactModelDownReply };
