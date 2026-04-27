const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { RestrictedExecutor } = require('../lib/restricted-exec');
const { ExecAudit } = require('../lib/exec-audit');
const { ApprovalGate } = require('../lib/approval-gate');

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-approval-'));
  const approvalsPath = path.join(tmp, 'exec_approvals.jsonl');
  const auditPath = path.join(tmp, 'exec_audit.jsonl');

  const audit = new ExecAudit({ approvalsPath, auditPath });

  {
    const ex = new RestrictedExecutor({
      allowedServices: ['silvermoon-control'],
      allowedRootDirs: [tmp],
    });

    const ok = ex.validateAction({ kind: 'svc_status', args: { service: 'silvermoon-control' } });
    assert.deepEqual(ok, { ok: true });

    const badSvc = ex.validateAction({ kind: 'svc_status', args: { service: 'ssh' } });
    assert.equal(badSvc.ok, false);
    assert.equal(badSvc.reason, 'service_not_allowed');

    const badPath = ex.validateAction({ kind: 'node_test', args: { testPath: '/etc/passwd' } });
    assert.equal(badPath.ok, false);
    assert.equal(badPath.reason, 'path_not_allowed');

    const badMeta = ex.validateAction({ kind: 'node_test', args: { testPath: `${tmp}\nwhoami` } });
    assert.equal(badMeta.ok, false);
    assert.equal(badMeta.reason, 'bad_chars');
  }

  {
    const gate = new ApprovalGate({
      ownerUserId: 'U_OWNER',
      enabled: true,
      approvalsPath,
      audit,
      now: () => new Date('2026-04-24T00:00:00.000Z'),
      ttlMs: 15 * 60 * 1000,
    });

    const created = gate.createPlan({
      channelId: 'C1',
      requestedBy: 'U_OWNER',
      kind: 'svc_status',
      args: { service: 'silvermoon-control' },
      reason: '验收服务在线',
    });
    assert.equal(created.ok, true);
    assert.ok(created.approvalId);

    const bound = gate.bindMessage({ approvalId: created.approvalId, messageId: 'M1' });
    assert.equal(bound.ok, true);

    const denyNonOwner = gate.onReaction({
      messageId: 'M1',
      userId: 'U_OTHER',
      emoji: '👍',
    });
    assert.equal(denyNonOwner.ok, false);
    assert.equal(denyNonOwner.reason, 'not_owner');

    const approve = gate.onReaction({
      messageId: 'M1',
      userId: 'U_OWNER',
      emoji: '👍',
    });
    assert.equal(approve.ok, true);
    assert.equal(approve.state, 'approved');

    const approveTwice = gate.onReaction({
      messageId: 'M1',
      userId: 'U_OWNER',
      emoji: '👍',
    });
    assert.equal(approveTwice.ok, false);
    assert.equal(approveTwice.reason, 'not_pending');
  }

  {
    const gate = new ApprovalGate({
      ownerUserId: 'U_OWNER',
      enabled: true,
      approvalsPath,
      audit,
      now: () => new Date('2026-04-24T00:00:00.000Z'),
      ttlMs: 0,
    });

    const created = gate.createPlan({
      channelId: 'C1',
      requestedBy: 'U_OWNER',
      kind: 'svc_status',
      args: { service: 'silvermoon-control' },
      reason: '过期测试',
    });
    gate.bindMessage({ approvalId: created.approvalId, messageId: 'M2' });

    const expired = gate.onReaction({
      messageId: 'M2',
      userId: 'U_OWNER',
      emoji: '👍',
    });
    assert.equal(expired.ok, false);
    assert.equal(expired.reason, 'expired');
  }

  {
    const secretish = 'token=abcdEFGHijklMNOP1234567890';
    const wrote = audit.appendAudit({
      at: new Date().toISOString(),
      kind: 'note',
      approvalId: 'A1',
      message: `看到 ${secretish} 但必须脱敏`,
      data: { secret: secretish },
    });
    assert.equal(wrote.ok, true);
    const raw = fs.readFileSync(auditPath, 'utf-8');
    assert.equal(raw.includes('abcdEFGH'), false);
  }

  {
    const mainPath = path.join(__dirname, '..', 'main.js');
    const raw = fs.readFileSync(mainPath, 'utf-8');
    assert.equal(/GROQ_API_KEY 未配置或读取失败/.test(raw), false);
  }
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
