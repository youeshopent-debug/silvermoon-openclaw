function extractFirstJsonObject(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\') {
        esc = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function normalizeRoute(obj) {
  const mode = String(obj?.mode || 'chat').toLowerCase();
  const brain = String(obj?.brain || 'groq').toLowerCase();
  const needsTools = !!obj?.needsTools;
  const out = {
    mode: mode === 'work' ? 'work' : 'chat',
    brain: brain === 'gemini' ? 'gemini' : (brain === 'ollama' ? 'ollama' : 'groq'),
    needsTools,
  };
  return out;
}

async function routeWithLLM({ askFast, text, memoryHint, channelId }) {
  const ask = askFast;
  if (typeof ask !== 'function') return { mode: 'chat', brain: 'groq', needsTools: false };

  const userText = String(text || '').trim();
  const hint = String(memoryHint || '').trim();
  const prompt = [
    '你是路由引擎。只输出严格 JSON，不要多余文字。',
    '字段：mode(chat|work)、brain(groq|gemini|ollama)、needsTools(boolean)。',
    '规则：一般聊天/安抚/闲聊 -> mode=chat brain=groq needsTools=false。',
    '需要搜索/排障/读日志/计划执行/审批 -> mode=work brain=gemini needsTools=true。',
    hint ? `记忆提示：${hint}` : '',
    `用户输入：${userText}`,
  ].filter(Boolean).join('\n');

  try {
    const raw = await ask(prompt, { channelId });
    const jsonText = extractFirstJsonObject(raw);
    if (!jsonText) return { mode: 'chat', brain: 'groq', needsTools: false };
    const obj = JSON.parse(jsonText);
    return normalizeRoute(obj);
  } catch {
    return { mode: 'chat', brain: 'groq', needsTools: false };
  }
}

module.exports = { routeWithLLM };

