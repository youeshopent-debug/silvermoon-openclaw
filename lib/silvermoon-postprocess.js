function normalizeText(s) {
  return String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripGenericTalk(text) {
  let s = normalizeText(text);
  s = s.replace(/XX是一个快速发展的领域/g, '');
  s = s.replace(/基于知识库显示/g, '');
  s = s.replace(/基于基座模型知识库/g, '');
  s = s.replace(/由于外部检索未回传证据[，。！!]?/g, '');
  s = s.replace(/作为阁下的指令系统[，。！!]?/g, '');
  s = s.replace(/希望这些信息对您有所帮助[，。！!]?/g, '');
  s = s.replace(/根据我的知识和权限[，。！!]?/g, '');
  // 拦截并剔除任何形式的启发式追问或反向提问
  s = s.replace(/启发式追问[:：][\s\S]*?([？?]|(?=\n|$))/g, '');
  s = s.replace(/追问[:：][\s\S]*?([？?]|(?=\n|$))/g, '');
  const stripFollowupQ = String(process.env.OPENCLAW_STRIP_FOLLOWUP_Q || '').trim() === '1';
  if (stripFollowupQ) {
    s = s.replace(/您认为[\s\S]*?[？?]/g, '');
    s = s.replace(/是否[\s\S]*?[？?]/g, '');
    s = s.replace(/要不要[\s\S]*?[？?]/g, '');
  }
  return s.trim();
}

function stripBannedPhrases(text) {
  let s = stripGenericTalk(text);
  return s.trim();
}

function looksMachineyOrUseless(text) {
  const s = stripGenericTalk(String(text || '')).trim();
  if (!s) return true;
  if (/工具不可用|无法直接提供|无法获取/.test(s)) return true;
  if (/结论：.*工具/i.test(s) && /证据：.*不可用/i.test(s)) return true;
  return false;
}

function pickKeywords(userText) {
  const u = String(userText || '');
  const keys = [];
  const add = (k) => {
    const t = String(k || '').trim();
    if (!t) return;
    if (!keys.includes(t)) keys.push(t);
  };
  if (/rwa/i.test(u)) add('RWA');
  if (/web3/i.test(u)) add('Web3');
  if (/tokeni[sz]e|tokeni[sz]ation/i.test(u)) add('tokenization');
  if (/vercel/i.test(u)) add('Vercel');
  if (/next\.?js/i.test(u)) add('Next.js');
  if (/stripe/i.test(u)) add('Stripe');
  if (keys.length === 0) {
    add('RWA');
    add('Vercel');
    add('Next.js');
  }
  return keys;
}

function buildMemoryLines(items, pick, limit) {
  const arr = Array.isArray(items) ? items : [];
  const lines = [];
  const seen = new Set();
  const n = Math.max(1, Number(limit || 0) || 3);
  for (const it of arr) {
    const sn = String(it?.snippet || '').trim();
    if (!sn) continue;
    const s = sn.replace(/\s+/g, ' ').trim();
    if (!s) continue;
    if (typeof pick === 'function' && !pick(s)) continue;
    const key = s.slice(0, 140);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`🔹 ${key}`);
    if (lines.length >= n) break;
  }
  return lines;
}

function buildGuidedQuestion(userText, memText) {
  return '';
}

function postprocessSilvermoonReply({ replyText, userText, channelId, memorySearch }) {
  const cid = String(channelId || '').trim();
  const raw = normalizeText(replyText).trim();
  const cleaned = stripBannedPhrases(raw);

  const should = looksMachineyOrUseless(raw) || looksMachineyOrUseless(cleaned);
  if (!should) return cleaned || raw;

  const keys = pickKeywords(userText);

  let memItems = [];
  if (typeof memorySearch === 'function' && cid) {
    const probes = [];
    const addProbe = (k) => {
      const t = String(k || '').trim();
      if (!t) return;
      if (!probes.includes(t)) probes.push(t);
    };
    for (const k of keys) addProbe(k);
    addProbe('部署');
    addProbe('进度');
    addProbe('偏好');
    addProbe('Vercel');
    addProbe('Next.js');
    for (const k of probes) {
      try {
        const r = memorySearch(k, { limit: 6, minAgeMs: 60_000 });
        if (r && r.ok && Array.isArray(r.items) && r.items.length) memItems = memItems.concat(r.items);
      } catch {}
    }
  }
  const byUid = new Map();
  for (const it of memItems) {
    const uid = String(it?.uid || '').trim();
    if (!uid) continue;
    if (!byUid.has(uid)) byUid.set(uid, it);
  }
  memItems = Array.from(byUid.values());

  const isProgress = (s) => /(部署|进度|vercel|next\.?js|vps|systemd|节点|上线)/i.test(s);
  const isPreference = (s) => /(禁表格|垂直|卡片流|代理|7890|成本|少问|不甩锅|tdd|审计|审批)/i.test(s);

  const progressLines = buildMemoryLines(memItems, isProgress, 2);
  const prefLines = buildMemoryLines(memItems, isPreference, 2);
  const otherLines = buildMemoryLines(memItems, (s) => !isProgress(s) && !isPreference(s), 1);
  const memText = [...progressLines, ...prefLines, ...otherLines].join('\n');

  const bullets = [];
  if (progressLines.length) bullets.push('🔹 项目进度：', ...progressLines);
  if (prefLines.length) bullets.push('🔹 偏好记录：', ...prefLines);
  if (otherLines.length) bullets.push('🔹 相关线索：', ...otherLines);
  
  return ['✅ 主人', ...bullets].join('\n').trim();
}

module.exports = { postprocessSilvermoonReply };
