const crypto = require('crypto');

function fingerprint(type, text) {
  const base = `${type}|${String(text || '').trim().toLowerCase()}`;
  return crypto.createHash('sha1').update(base).digest('hex');
}

function classifyTaskKind(userText) {
  const s = String(userText || '').trim();
  if (!s) return 'unknown';

  const advisory = /(解释|说明|对比|分析|复盘|建议|方案|怎么做|怎么弄|为什么|是不是|如何|流程|规则|架构)/i.test(s);
  const artifact =
    /(写代码|修复|实现|改代码|改一下|优化|重构|生成|制作|导出|打包|压缩|画|设计图|海报|表格|脚本|配置|文件|落盘|dropbox|notebook)/i.test(s);

  if (artifact && !advisory) return 'artifact';
  if (advisory && !artifact) return 'advisory';
  if (artifact && advisory) return 'artifact';
  if (/(帮我|请你|麻烦|需要你|我要你).{0,8}(做|弄|写|改|修|整理)/.test(s)) return 'artifact';
  return 'unknown';
}

function extractTaskNeed(userText) {
  const s = String(userText || '').trim();
  const hasLink = /https?:\/\/\S+/i.test(s);
  const hasPath = /[a-zA-Z]:\\[^\n\r]+/.test(s) || /(DROPBOX\/|workspace\/|\/notebook\/)/i.test(s);
  const hasAttachmentHint = /(附件|截图|文件|压缩包|zip|pdf|表格|excel|csv|数据|原文|素材)/i.test(s);
  const hasMaterial = hasLink || hasPath || hasAttachmentHint;

  const hasSample = /(模板|样板|参照|参考|如图|照这个|按照这个|跟图|按图)/i.test(s);

  const hasDeadline =
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/.test(s) ||
    /(\d{1,2}:\d{2})/.test(s) ||
    /(今天|明天|后天|今晚|早上|中午|下午|晚上|周[一二三四五六日天]|星期[一二三四五六日天]|月底|下周|这个周末|下个周末)/.test(s);

  const sampleRequired = /(模板|排版|对齐|风格|按图|跟图|参照|参考|如图)/i.test(s);
  const materialRequired = /(素材|原文|数据|附件|截图|根据|把这|整理|翻译|转写|总结|生成|制作|做一张|做一个)/i.test(s);
  const deadlineRequired = /(截止|deadline|交付|上线|发布|定时|cron|几点|什么时候|每天|每周|今晚|明天)/i.test(s);

  return {
    needMaterial: materialRequired && !hasMaterial,
    needSample: sampleRequired && !hasSample,
    needDeadline: deadlineRequired && !hasDeadline,
  };
}

function pickOneAsk(need) {
  if (!need) return null;
  if (need.needSample) return 'sample';
  if (need.needMaterial) return 'material';
  if (need.needDeadline) return 'deadline';
  return null;
}

function buildAskText(askKey) {
  if (askKey === 'sample') return '缺样板/模板。你要我按哪一个版本对齐？（发 1 份截图/链接/文件即可）';
  if (askKey === 'material') return '缺素材。你把素材发我：附件/链接/原文/数据，任选其一。';
  if (askKey === 'deadline') return '缺截止时间。要我什么时候交付？（例如：今天 18:00 / 明天上午 / 2026-04-20）';
  return null;
}

function clampToSingleQuestion(text) {
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = s.split('\n');
  const out = [];
  let kept = false;
  for (const raw of lines) {
    const l = String(raw || '').trim();
    if (!l) continue;
    const isQ = /[？?]$/.test(l) || /(请问|能否|可以吗|要不要|是否)/.test(l);
    if (isQ) {
      if (kept) continue;
      kept = true;
      out.push(l);
      continue;
    }
    out.push(l);
  }
  return out.join('\n').trim();
}

function ensureAcceptanceChecklist(text) {
  const s = String(text || '').trim();
  if (!s) return s;
  if (/(验收|检查点|你可以用以下确认|对照以下)/.test(s)) return s;
  const block = [
    '',
    '✅ 验收清单',
    '🔹 结论/方案是否可直接照做',
    '🔹 是否给到关键参数/路径/命令（能复现）',
    '🔹 是否说明失败时的降级/回退动作',
  ].join('\n');
  return (s + block).trim();
}

function applyTaskContractToReply(params) {
  const replyText = String(params?.replyText || '').trim();
  const kind = params?.kind || 'unknown';
  const need = params?.need || null;
  const nowMs = Number(params?.nowMs || Date.now());
  const cooldownMs = Number(params?.cooldownMs || 30 * 60 * 1000);
  const cooldownMap = params?.cooldownMap && typeof params.cooldownMap === 'object' ? params.cooldownMap : {};

  if (!replyText) return { text: replyText, usedAskKey: null, cooldownMap };

  const genericClarify =
    /(请(你|您)?(提供|补充)|需要(你|您)?提供|麻烦(你|您)?提供).{0,10}(更多|一些|详细|细节|上下文|具体)|你可以(告诉|说明|分享).{0,12}(具体|细节|上下文)|我(不太|无法|没法).{0,10}(理解|判断).{0,10}(请|麻烦).{0,10}(补充|提供)/;
  const hasQuestion = /[？?]/.test(replyText) || /(请问|能否|可以吗|要不要|是否)/.test(replyText) || genericClarify.test(replyText);
  const askKey = kind === 'artifact' && hasQuestion ? pickOneAsk(need) : null;
  if (askKey) {
    const lastAt = Number(cooldownMap[askKey] || 0);
    if (lastAt && nowMs - lastAt < cooldownMs) {
      const label = askKey === 'sample' ? '样板/模板' : askKey === 'material' ? '素材' : '截止时间';
      return {
        text: `收到。当前缺${label}，你补齐后我直接交付。`,
        usedAskKey: null,
        cooldownMap,
      };
    }
    const q = buildAskText(askKey);
    if (q) {
      const next = { ...cooldownMap, [askKey]: nowMs };
      return { text: q, usedAskKey: askKey, cooldownMap: next };
    }
  }

  let out = clampToSingleQuestion(replyText);
  if (kind === 'advisory' && out.length >= 60 && !/[？?]/.test(out)) out = ensureAcceptanceChecklist(out);
  return { text: out, usedAskKey: null, cooldownMap };
}

function fingerprintUserTask(userText) {
  const s = String(userText || '').trim();
  const normalized = s
    .replace(/\s+/g, ' ')
    .replace(/[【】\[\]（）()]/g, '')
    .replace(/[：:，,。.!！?？]/g, '')
    .slice(0, 1200);
  return fingerprint('user_task', normalized);
}

module.exports = {
  classifyTaskKind,
  extractTaskNeed,
  pickOneAsk,
  applyTaskContractToReply,
  ensureAcceptanceChecklist,
  clampToSingleQuestion,
  fingerprintUserTask,
};

