const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function writeJsonl(fp, obj) {
  try {
    ensureDir(path.dirname(fp));
    fs.appendFileSync(fp, JSON.stringify(obj) + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

function normalizeRawStatus(rs) {
  const r = rs && typeof rs === 'object' ? rs : null;
  if (!r) return null;
  const kind = String(r.kind || '').trim();
  const ok = typeof r.ok === 'boolean' ? r.ok : null;
  const evidence = r.evidence && typeof r.evidence === 'object' ? r.evidence : null;
  const at = String(r.at || '').trim();
  if (!kind || ok === null || !evidence || !at) return null;
  return { kind, ok, evidence, at };
}

function formatEvidence(evidence) {
  const e = evidence && typeof evidence === 'object' ? evidence : {};
  const parts = [];
  if (typeof e.httpStatus === 'number') parts.push(`HTTP=${e.httpStatus}`);
  if (typeof e.exitCode === 'number') parts.push(`exitCode=${e.exitCode}`);
  if (typeof e.killed === 'boolean') parts.push(`timeoutKilled=${e.killed ? '1' : '0'}`);
  if (e.url) parts.push(`url=${String(e.url).slice(0, 180)}`);
  if (e.absPath) parts.push(`path=${String(e.absPath).slice(0, 200)}`);
  if (typeof e.size === 'number') parts.push(`size=${e.size}`);
  if (e.reason) parts.push(`reason=${String(e.reason).slice(0, 180)}`);
  return parts.join(' | ') || 'evidence=EMPTY';
}

function buildFailureSystemMessage({ toolName, rawStatus, evidencePath }) {
  const name = String(toolName || '').trim() || 'unknown_tool';
  const rs = normalizeRawStatus(rawStatus);
  const evidenceText = rs ? formatEvidence(rs.evidence) : 'raw_status=INVALID_OR_MISSING';
  const crashPath = String(evidencePath || '').trim();
  return [
    '【系统级错误：工具调用失败/证据缺失】',
    `- 工具名：${name}`,
    `- 真实证据：${evidenceText}`,
    crashPath ? `- crash_evidence.log：${crashPath}` : '- crash_evidence.log：<missing>',
    '',
    '【封印脑补】检测到底层执行证据缺失/异常：',
    '1) 禁止输出任何暗示“已完成/已修复/已部署/已执行成功”的话术。',
    '2) 你唯一的任务是：向主人报告真实错误数据、证据路径，并请求进一步指令。',
    '3) 必须停止当前流，不得擅自继续推进后续步骤。',
  ].join('\n');
}

function guardToolResult({ toolName, result, channelId, evidencePath }) {
  const ep = String(evidencePath || '').trim();
  const rs = normalizeRawStatus(result?.raw_status);
  const ok = Boolean(result && result.ok === true && rs && rs.ok === true);
  if (ok) return { ok: true, result };

  const systemMessage = buildFailureSystemMessage({
    toolName,
    rawStatus: rs || result?.raw_status || null,
    evidencePath: ep,
  });

  const record = {
    at: nowIso(),
    channelId: channelId || null,
    tool: String(toolName || '').trim() || null,
    reason: !result ? 'empty_result' : !result.raw_status ? 'missing_raw_status' : !rs ? 'invalid_raw_status' : (rs.ok === false ? 'raw_status_not_ok' : 'unknown'),
    raw_status: rs || null,
    resultShape: result ? Object.keys(result).slice(0, 20) : null,
    stack: new Error('tool_guard_failure').stack,
  };
  if (ep) writeJsonl(ep, record);
  return { ok: false, systemMessage, crashPath: ep || null, record };
}

module.exports = {
  guardToolResult,
  buildFailureSystemMessage,
  normalizeRawStatus,
};

