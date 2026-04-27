/**
 * sanitizer.ts — Next.js 适配版后处理管道
 */

export interface SanitizeOptions {
  agent?: string;
  channelId?: string;
  userText?: string;
  verbose?: boolean;
  charLimit?: number;
  postprocessHook?: (opts: { replyText: string; userText: string; channelId: string }) => string;
  taskContractHandler?: (text: string, channelId?: string) => string;
  emphasizeLinks?: (text: string) => string;
}

export function sanitize(text: string, opts: SanitizeOptions = {}): string {
  let out = String(text || '');

  // ── 第 1 层：基础清理 ──
  out = basicClean(out);
  if (!out) return '主人，银月内阁暂时无可奉告。';

  // ── 第 2 层：清理 LLM 模板废话 ──
  out = stripBotTemplateLines(out);
  out = filterSystemLines(out);
  if (!out.trim()) return '收到。你直接下令要我做什么即可。';

  // ── 第 3 层：去连续重复行 ──
  out = dedupeConsecutive(out);

  // ── 第 4 层：拦截敷衍占位符 ──
  out = enforceNoBusyPlaceholders(out);

  // ── 第 5 层：可选钩子 ──
  if (typeof opts.emphasizeLinks === 'function') {
    out = opts.emphasizeLinks(out);
  }

  if (typeof opts.taskContractHandler === 'function') {
    out = opts.taskContractHandler(out, opts.channelId);
  }

  if (typeof opts.postprocessHook === 'function') {
    try {
      out = opts.postprocessHook({
        replyText: out,
        userText: String(opts.userText || ''),
        channelId: String(opts.channelId || ''),
      });
    } catch {
      // 钩子失败不影响主流程
    }
  }

  // ── 第 6 层：智能截断 ──
  out = smartTruncate(out, opts);

  // ── 硬上限 2000 字符 ──
  if (out.length > 2000) {
    out = out.slice(0, 1990) + '…';
  }

  return out;
}

export function basicClean(text: string): string {
  let s = String(text || '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/[ \t]+$/gm, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

export function filterSystemLines(text: string): string {
  return text
    .split('\n')
    .filter((l) => {
      const t = String(l || '').trim();
      if (!t) return true;
      if (t === 'OPENCLAW_LONG_TERM_MEMORY_DB') return false;
      if (/^\{.*\}$/.test(t) && /"id"\s*:/.test(t) && /"at"\s*:/.test(t)) return false;
      return true;
    })
    .join('\n');
}

export function stripBotTemplateLines(text: string): string {
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const banned = [
    /我听到(你|您)的反馈了/,
    /收到(你|您)的反馈/,
    /理解(你|您)目前(面临|遇到)/,
    /为了帮助(我|我们)更好地(理解|处理|解决)/,
    /检测到对话中存在(严重的)?(不满|质疑|期待|意愿|问题)/,
    /我会(立即)?进行自我(反思|反省|评估)/,
    /我(可以|能)进行自我(反思|反省|评估)/,
    /谢谢(你|您)的反馈/,
    /我会努力改进/,
    /我会尽力提供更好的服务/,
    /确保类似的问题不会再次发生/,
    /提供一个改进计划/,
    /请提供一些具体信息/,
    /(请|麻烦)(你|您)(提供|补充).{0,12}(信息|背景|上下文)/,
    /请告诉我(你|您)(的)?(需求|想法)/,
    /^方法论路线由[:：]/,
    /^方法论路线[:：]/,
    /^下一步动作[:：]/,
    /^下一步[:：，,]/,
    /(下一步|接下来)[,，]?\s*我(可以|能)帮助你做什么/,
    /(你|您)想聊什么呢/,
    /我(可以|能)正常聊天了/,
    /在此[。！!]?$/,
    /我(是|乃).{0,18}(在此|来了)/,
    /我的(技能|职责)(包括|如下)/,
    /负责(视觉|UI|前端|财务|行情|侦查|社媒|文案|数字)/,
    /^你好[！!]?$/,
    /^你好[！!，,]\s*我(是|乃)/,
    /我(是|乃).{0,20}(助手|助理|AI|语言模型)/,
    /被设计用来/,
    /目前我的功能包括/,
    /日常对话/,
    /请稍等(片刻|一下|一会)/,
    /我会(立刻|立即|马上|尽快).{0,12}(查找|搜索|检索|整理|学习|分析)/,
    /我(正在|已经开始).{0,18}(查找|搜索|检索|整理|学习|分析)/,
    /(稍后|待会|一旦).{0,20}(分享|汇报|反馈|给你|提供)/,
    /我会继续深入(研究|学习)/,
    /(你|您)可以在(终端|命令行|控制台).{0,12}运行/,
    /在(终端|命令行|控制台).{0,12}运行(以下|下列|下面)/,
  ];

  let skippingSkillList = false;

  const kept = s.split('\n')
    .map((l) => String(l || '').replace(/[ \t]+$/g, ''))
    .filter((l) => {
      const probe = String(l || '').trim();
      const line = probe.replace(/^[🔹✅⚠️👉\-\*•\s]+/g, '').trim();
      if (!line) return true;
      if (banned.some((re) => re.test(line))) return false;

      if (/我的(技能|职责)(包括|如下)/.test(line)) {
        skippingSkillList = true;
        return false;
      }
      if (skippingSkillList) {
        if (/^(如果|如需|需要|想要)/.test(line)) {
          skippingSkillList = false;
          return false;
        }
        if (/^\d+\./.test(line) || /^(UI设计|视觉设计|设计规范维护)/.test(line)) return false;
      }

      return true;
    })
    .filter((l) => {
      const probe = String(l || '').trim();
      const line = probe.replace(/^[🔹✅⚠️👉\-\*•\s]+/g, '').trim();
      if (!line) return true;
      if (/^如果你(需要|想要)/.test(line)) return false;
      if (/^如(需|果需要)/.test(line) && /(请告诉我|告诉我)/.test(line)) return false;
      return true;
    });

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function dedupeConsecutive(text: string): string {
  const lines = String(text || '').split('\n');
  const out: string[] = [];
  let lastKey: string | null = null;

  for (const raw of lines) {
    const l = String(raw || '').replace(/[ \t]+$/g, '');
    const key = l.trim();
    if (key && lastKey === key) continue;
    out.push(l);
    lastKey = key || null;
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function enforceNoBusyPlaceholders(text: string): string {
  const s = String(text || '').trim();
  if (!s) return s;

  const hasEvidence = /(DROPBOX\/|\/notebook\/|https?:\/\/)/i.test(s);
  if (hasEvidence) return s;

  const busy = /(请稍等|正在(查找|搜索|检索|学习|整理|分析)|我会(立刻|立即|马上|尽快)|稍后(会|将)|一旦找到)/;
  if (busy.test(s)) {
    return '收到。我不会用"学习中/查找中"敷衍；有结果我直接交付。若缺素材/格式，我只问一次并给选择题。';
  }

  return s;
}

export function smartTruncate(text: string, opts: SanitizeOptions = {}): string {
  const out = String(text || '').trim();
  if (!out) return out;

  const isSpecialContent =
    out.includes('┌') ||
    /\[PUA|\bPUA\b/i.test(out) ||
    /(银月情报局|斗湖早报|早晨简报|23:55\s*汇总|夜报|每日汇总|基于基座模型知识库|记忆线索)/.test(out);

  let charLimit: number;
  if (opts.charLimit) {
    charLimit = opts.charLimit;
  } else if (isSpecialContent) {
    charLimit = 1900;
  } else if (opts.verbose) {
    charLimit = 1800;
  } else {
    charLimit = 1500;
  }

  if (out.length <= charLimit) return out;

  const lines = out.split('\n');
  const finalLines: string[] = [];
  let totalChars = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    totalChars += line.length + 1;

    if (totalChars > charLimit && !inCodeBlock && finalLines.length > 3) {
      break;
    }

    finalLines.push(line);
  }

  if (inCodeBlock) {
    finalLines.push('```');
  }

  return finalLines.join('\n').trim();
}
