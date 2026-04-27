function randId() {
  const a = Math.random().toString(36).slice(2, 8);
  const b = Math.random().toString(36).slice(2, 8);
  return `${a}${b}`;
}

const LEVEL_5_KINDS = new Set([
  'stripe_payment',
  'stripe_payout',
  'lemon_squeezy_payment',
  'funds_transfer',
  'sensitive_data_read',
  'core_file_delete',
  'core_config_delete',
  'database_delete',
  'financial_api_write',
  'external_payment_gateway',
  'trade',
  'trade_order',
  'trade_close',
  'trade_transfer',
  'mt4_order',
  'mt4_close',
  'xiaoyan_trade',
]);

function isLevel5(kind) {
  return LEVEL_5_KINDS.has(String(kind || '').trim().toLowerCase());
}

class ApprovalGate {
  constructor({ ownerUserId, enabled, approvalsPath, audit, now, ttlMs }) {
    this.ownerUserId = String(ownerUserId || '').trim();
    this.enabled = enabled !== false;
    this.approvalsPath = approvalsPath;
    this.audit = audit;
    this.now = typeof now === 'function' ? now : () => new Date();
    this.ttlMs = typeof ttlMs === 'number' ? ttlMs : 15 * 60 * 1000;
    this.byApprovalId = new Map();
    this.byMessageId = new Map();
  }

  checkAccess({ requestedBy, kind, isReadOnly }) {
    const uid = String(requestedBy || '').trim();
    const ownerId = String(this.ownerUserId || '').trim();

    if (uid !== ownerId) {
      return { ok: false, level: 0, reason: 'not_owner', message: '⛔ 非主人身份，操作被拒绝。' };
    }

    if (isReadOnly) {
      return { ok: true, level: 4, reason: 'god_mode', message: '✅ Level 4 God Mode：主人拥有最高查阅权，立即放行。' };
    }

    if (isLevel5(kind)) {
      return { ok: false, level: 5, reason: 'level5_required', message: `⛔ Level 5 门禁：操作 "${kind}" 需要主人审批。银月已挂起操作，请主人确认"通过"或"执行"。` };
    }

    return { ok: true, level: 3, reason: 'standard', message: '✅ 标准权限，操作放行。' };
  }

  createPlan({ channelId, requestedBy, kind, args, reason }) {
    if (!this.enabled) return { ok: false, reason: 'disabled' };
    const approvalId = `ap_${randId()}`;
    const at = this.now().toISOString();
    const rec = {
      at,
      approvalId,
      state: 'pending',
      request: {
        kind: String(kind || '').trim(),
        args: args && typeof args === 'object' ? args : {},
        reason: String(reason || '').trim(),
        channelId: String(channelId || '').trim(),
        messageId: null,
        requestedBy: String(requestedBy || '').trim(),
      },
      decision: null,
      result: null,
      expiresAt: new Date(this.now().getTime() + this.ttlMs).toISOString(),
    };
    this.byApprovalId.set(approvalId, rec);
    const w = this.audit.appendApproval(rec);
    if (!w.ok) return { ok: false, reason: 'audit_unavailable' };
    this.audit.appendAudit({ at, kind: 'plan_created', approvalId, data: { request: rec.request } });
    return { ok: true, approvalId, record: rec };
  }

  bindMessage({ approvalId, messageId }) {
    const id = String(approvalId || '').trim();
    const mid = String(messageId || '').trim();
    const rec = this.byApprovalId.get(id);
    if (!rec) return { ok: false, reason: 'not_found' };
    if (!mid) return { ok: false, reason: 'missing_messageId' };
    rec.request.messageId = mid;
    this.byMessageId.set(mid, id);
    const at = this.now().toISOString();
    this.audit.appendApproval(rec);
    this.audit.appendAudit({ at, kind: 'message_bound', approvalId: id, data: { messageId: mid } });
    return { ok: true };
  }

  getByMessageId(messageId) {
    const mid = String(messageId || '').trim();
    const id = this.byMessageId.get(mid);
    if (!id) return null;
    return this.byApprovalId.get(id) || null;
  }

  onReaction({ messageId, userId, emoji }) {
    if (!this.enabled) return { ok: false, reason: 'disabled' };
    const mid = String(messageId || '').trim();
    const uid = String(userId || '').trim();
    const em = String(emoji || '').trim();
    const id = this.byMessageId.get(mid);
    if (!id) return { ok: false, reason: 'unknown_message' };
    const rec = this.byApprovalId.get(id);
    if (!rec) return { ok: false, reason: 'not_found' };
    if (rec.state !== 'pending') return { ok: false, reason: 'not_pending' };
    if (em !== '👍') return { ok: false, reason: 'wrong_emoji' };
    if (!this.ownerUserId || uid !== this.ownerUserId) {
      this.audit.appendAudit({ at: this.now().toISOString(), kind: 'reaction_denied', approvalId: id, data: { userId: uid, emoji: em, reason: 'not_owner' } });
      return { ok: false, reason: 'not_owner' };
    }
    const nowMs = this.now().getTime();
    const expMs = Date.parse(rec.expiresAt);
    if (Number.isFinite(expMs) && nowMs >= expMs) {
      rec.state = 'expired';
      this.audit.appendAudit({ at: this.now().toISOString(), kind: 'expired', approvalId: id });
      return { ok: false, reason: 'expired' };
    }
    rec.state = 'approved';
    rec.decision = { byUserId: uid, emoji: em, decidedAt: this.now().toISOString() };
    this.audit.appendApproval(rec);
    this.audit.appendAudit({ at: this.now().toISOString(), kind: 'approved', approvalId: id, data: rec.decision });
    return { ok: true, approvalId: id, state: rec.state, record: rec };
  }
}

module.exports = { ApprovalGate, isLevel5, LEVEL_5_KINDS };
