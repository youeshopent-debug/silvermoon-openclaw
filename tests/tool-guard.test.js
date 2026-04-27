const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const { guardToolResult, normalizeRawStatus, buildFailureSystemMessage } = require('../lib/tool-guard');

test('normalizeRawStatus: invalid -> null', () => {
  assert.equal(normalizeRawStatus(null), null);
  assert.equal(normalizeRawStatus({}), null);
  assert.equal(normalizeRawStatus({ kind: 'x', ok: true, evidence: {}, at: '' }), null);
});

test('normalizeRawStatus: valid -> normalized', () => {
  const rs = normalizeRawStatus({ kind: 'cmd', ok: false, evidence: { exitCode: 1 }, at: '2026-01-01T00:00:00Z' });
  assert.equal(rs.kind, 'cmd');
  assert.equal(rs.ok, false);
  assert.equal(rs.evidence.exitCode, 1);
});

test('buildFailureSystemMessage: contains required markers', () => {
  const msg = buildFailureSystemMessage({
    toolName: 'runCommand',
    rawStatus: { kind: 'cmd', ok: false, evidence: { exitCode: 2 }, at: '2026-01-01T00:00:00Z' },
    evidencePath: 'C:\\x\\crash_evidence.log',
  });
  assert.ok(msg.includes('工具名'));
  assert.ok(msg.includes('crash_evidence.log'));
  assert.ok(msg.includes('封印脑补'));
  assert.ok(msg.includes('已完成'));
});

test('guardToolResult: missing raw_status -> fail + crash log', () => {
  const fp = path.join(os.tmpdir(), `crash_evidence_${Date.now()}_${Math.random().toString(16).slice(2)}.log`);
  const r = guardToolResult({
    toolName: 'testTool',
    result: { ok: true, data: 'x' },
    channelId: 'c1',
    evidencePath: fp,
  });
  assert.equal(r.ok, false);
  assert.ok(r.systemMessage.includes('系统级错误'));
  assert.ok(fs.existsSync(fp));
  const lines = fs.readFileSync(fp, 'utf-8').trim().split('\n');
  assert.ok(lines.length >= 1);
});

test('guardToolResult: ok + raw_status.ok true -> pass', () => {
  const fp = path.join(os.tmpdir(), `crash_evidence_${Date.now()}_${Math.random().toString(16).slice(2)}.log`);
  const r = guardToolResult({
    toolName: 'okTool',
    result: { ok: true, raw_status: { kind: 'cli', ok: true, evidence: { exitCode: 0 }, at: '2026-01-01T00:00:00Z' } },
    channelId: 'c1',
    evidencePath: fp,
  });
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(fp), false);
});

