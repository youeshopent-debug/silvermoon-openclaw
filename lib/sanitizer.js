/**
 * sanitizer.js — 精简版后处理管道
 * 替换原有 sanitizeDiscordReply 的 6 层管道
 *
 * 改动摘要：
 *   ❌ 删除 enforceLangPolicy — 语言由 prompt-builder 控制
 *   ❌ 删除 10 行硬截断 — 改为字符数限制（默认 1500）
 *   ✅ 保留 stripBotTemplateLines — 清理 LLM 模板废话
 *   ✅ 保留 enforceNoBusyPlaceholders — 拦截敷衍占位符
 *   ✅ 保留 dedupeLines — 仅去连续重复行
 *   ✅ 保留 代码块自动闭合
 *   ✅ 保留 emphasizeLinks
 *   ✅ 保留 enforceTaskContractResponse — 通过依赖注入
 */

'use strict';

// ─── 主入口 ─────────────────────────────────────────────────

/**
 * 后处理 LLM 回复文本，准备发送到 Discord
 *
 * @param {string} text - LLM 原始回复
 * @param {object} [opts]
 * @param {string}   [opts.agent]      - 当前角色名
 * @param {string}   [opts.channelId]  - 频道 ID
 * @param {string}   [opts.userText]   - 用户原始消息
 * @param {boolean}  [opts.verbose]    - 是否允许更长回复
 * @param {number}   [opts.charLimit]  - 自定义字符上限（默认 1500）
 * @param {Function} [opts.postprocessHook]         - 银月后处理钩子（可选）
 * @param {Function} [opts.taskContractHandler]      - 任务契约处理（可选）
 * @param {Function} [opts.emphasizeLinks]           - 链接强调处理（可选）
 * @returns {string}
 */
function sanitize(text, opts = {}) {
  let out = String(text || '');

  // ── 第 1 层：基础清理 ──
  out = basicClean(out);
  if (!out) return '主人，银月内阁暂时无可奉告。';

  // ── 第 1.5 层：过滤模型思考过程（<> 包裹的内容） ──
  out = stripThinkingBlocks(out);

  // ── 第 2 层：清理 LLM 模板废话 ──
  out = stripBotTemplateLines(out);
  out = filterSystemLines(out);
  if (!out.trim()) return '主人，我在。请吩咐。';

  // ── 第 3 层：去连续重复行 ──
  out = dedupeConsecutive(out);

  // ── 第 4 层：拦截敷衍占位符 ──
  out = enforceNoBusyPlaceholders(out);

  // ── 第 5 层：可选钩子 ──

  // 链接强调
  if (typeof opts.emphasizeLinks === 'function') {
    out = opts.emphasizeLinks(out);
  }

  // 任务契约
  if (typeof opts.taskContractHandler === 'function') {
    out = opts.taskContractHandler(out, opts.channelId);
  }

  // 银月专属后处理（如 postprocessSilvermoonReply）
  if (typeof opts.postprocessHook === 'function') {
    try {
      out = opts.postprocessHook({
        replyText: out,
        userText: String(opts.userText || ''),
        channelId: String(opts.channelId || ''),
      });
    } catch (e) {
      // 钩子失败不影响主流程
    }
  }

  // ── 第 6 层：智能截断（按字符数，非行数） ──
  out = smartTruncate(out, opts);

  // ── Discord 硬上限 2000 字符 ──
  if (out.length > 2000) {
    out = out.slice(0, 1990) + '…';
  }

  return out;
}

// ─── 过滤模型思考过程 ─────────────────────────────────────────

function stripThinkingBlocks(text) {
  let s = String(text || '');
  // 过滤 <> 包裹的思考过程（qwen 模型常见行为）
  s = s.replace(/<[^>]*>[\s\S]*?<\/[^>]*>/g, '');
  // 过滤未闭合的 <tag 到行尾
  s = s.replace(/<[^>]*>[^<]*$/gm, '');
  // 过滤单独的 <tag> 标签
  s = s.replace(/<[^>]+>/g, '');
  return s.trim();
}

// ─── 基础清理 ───────────────────────────────────────────────

function basicClean(text) {
  let s = String(text || '');
  // 统一换行符
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 去除行尾空白
  s = s.replace(/[ \t]+$/gm, '');
  // 压缩连续空行为最多 1 个
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// ─── 过滤系统/内存泄漏行 ────────────────────────────────────

function filterSystemLines(text) {
  return text
    .split('\n')
    .filter((l) => {
      const t = String(l || '').trim();
      if (!t) return true;
      // 过滤内存 DB 标识
      if (t === 'OPENCLAW_LONG_TERM_MEMORY_DB') return false;
      // 过滤 JSON 内存记录泄漏
      if (/^\{.*\}$/.test(t) && /"id"\s*:/.test(t) && /"at"\s*:/.test(t)) return false;
      return true;
    })
    .join('\n');
}

// ─── 清理 LLM 模板废话 ─────────────────────────────────────

/**
 * 过滤 LLM 常见的模板化/套话回复
 * 保留原有的 banned patterns（经过实战验证的列表）
 */
function stripBotTemplateLines(text) {
  const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const banned = [
    // ── 反馈/自省类套话 ──
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

    // ── 信息索取类套话 ──
    /请提供一些具体信息/,
    /(请|麻烦)(你|您)(提供|补充).{0,12}(信息|背景|上下文)/,
    /请告诉我(你|您)(的)?(需求|想法)/,

    // ── 方法论/下一步套话 ──
    /^方法论路线由[:：]/,
    /^方法论路线[:：]/,
    /^下一步动作[:：]/,
    /^下一步[:：，,]/,
    /(下一步|接下来)[,，]?\s*我(可以|能)帮助你做什么/,
    /(你|您)想聊什么呢/,
    /我(可以|能)正常聊天了/,

    // ── 自我介绍/身份泄漏 ──
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

    // ── 敷衍类套话 ──
    /请稍等(片刻|一下|一会)/,
    /我会(立刻|立即|马上|尽快).{0,12}(查找|搜索|检索|整理|学习|分析)/,
    /我(正在|已经开始).{0,18}(查找|搜索|检索|整理|学习|分析)/,
    /(稍后|待会|一旦).{0,20}(分享|汇报|反馈|给你|提供)/,
    /我会继续深入(研究|学习)/,
    /我不会用.*学习中.*查找中.*敷衍/,
    /有结果我直接交付/,
    /若缺素材.*格式.*我只问一次/,

    // ── 终端/技术指导（不该出现在 Discord） ──
    /(你|您)可以在(终端|命令行|控制台).{0,12}运行/,
    /在(终端|命令行|控制台).{0,12}运行(以下|下列|下面)/,

    // ── 追问类套话 ──
    /追问[:：]/,
    /启发式追问/,
    /^◆\s*追问/,
    /你这次.*更偏.*哪/,
    /你(想|需要|希望).*哪/,
    /我可以.*直接给.*一条/,
    /【基座模型知识库】/,
    /【预测性分析】/,
    /【记忆线索】/,
  ];

  // 技能列表跳过状态
  let skippingSkillList = false;

  const kept = s.split('\n')
    .map((l) => String(l || '').replace(/[ \t]+$/g, ''))
    .filter((l) => {
      const probe = String(l || '').trim();
      const line = probe.replace(/^[🔹✅⚠️👉\-\*•\s]+/g, '').trim();
      if (!line) return true;
      if (banned.some((re) => re.test(line))) return false;

      // 跳过技能列表块
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

// ─── 去连续重复行 ───────────────────────────────────────────

function dedupeConsecutive(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let lastKey = null;

  for (const raw of lines) {
    const l = String(raw || '').replace(/[ \t]+$/g, '');
    const key = l.trim();
    // 只跳过连续重复的非空行
    if (key && lastKey === key) continue;
    out.push(l);
    lastKey = key || null;
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

// ─── 拦截敷衍占位符 ─────────────────────────────────────────

function enforceNoBusyPlaceholders(text) {
  // 已废弃：不再替换回复内容，避免打断银月的正常回复流程
  return String(text || '').trim();
}

// ─── 智能截断 ───────────────────────────────────────────────

/**
 * 按字符数截断，而非行数
 * 自动识别特殊内容（表格、情报、代码块）并放宽限制
 */
function smartTruncate(text, opts = {}) {
  let out = String(text || '').trim();
  if (!out) return out;

  // 检测是否为特殊长内容（允许更多字符）
  const isSpecialContent =
    out.includes('┌') ||
    /\[PUA|\bPUA\b/i.test(out) ||
    /(银月情报局|斗湖早报|早晨简报|23:55\s*汇总|夜报|每日汇总|基于基座模型知识库|记忆线索)/.test(out);

  // 确定字符上限
  let charLimit;
  if (opts.charLimit) {
    charLimit = opts.charLimit;
  } else if (isSpecialContent) {
    charLimit = 1900;  // 特殊内容接近 Discord 上限
  } else if (opts.verbose) {
    charLimit = 1800;
  } else {
    charLimit = 1500;  // 默认：约 Discord 一屏
  }

  // 如果未超限，直接返回
  if (out.length <= charLimit) return out;

  // 单行超长 → 直接截断
  if (!out.includes('\n') && out.length > charLimit) {
    return out.slice(0, charLimit - 1) + '…';
  }

  // 按行截断，保持代码块完整性
  const lines = out.split('\n');
  const finalLines = [];
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

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  sanitize,
  // 单独导出供测试或自定义组合
  basicClean,
  stripBotTemplateLines,
  filterSystemLines,
  dedupeConsecutive,
  enforceNoBusyPlaceholders,
  smartTruncate,
};
