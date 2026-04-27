const crypto = require('crypto');

function normalizeEvidenceText(s) {
  let t = String(s || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/https?:\/\/\S+/gi, (m) => {
    const u = String(m || '').trim();
    const q = u.indexOf('?');
    return q >= 0 ? u.slice(0, q) : u;
  });
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length > 2000) t = t.slice(0, 2000);
  return t;
}

function hashEvidenceText(text) {
  const s = normalizeEvidenceText(text);
  if (!s) return '';
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

class EvidenceRing {
  constructor(maxSize) {
    this.maxSize = Math.max(1, Number(maxSize || 0) || 3);
    this.items = [];
  }

  has(hash) {
    const h = String(hash || '').trim();
    if (!h) return false;
    return this.items.some((x) => x && x.hash === h);
  }

  push(hash, short) {
    const h = String(hash || '').trim();
    if (!h) return false;
    const it = { at: Date.now(), hash: h, short: String(short || '').slice(0, 240) };
    this.items.unshift(it);
    if (this.items.length > this.maxSize) this.items = this.items.slice(0, this.maxSize);
    return true;
  }
}

function createEvidenceDeduper({ size }) {
  const n = Math.max(1, Number(size || 0) || 3);
  const byChannel = new Map();
  const getRing = (channelId) => {
    const cid = String(channelId || '').trim();
    if (!cid) return null;
    let ring = byChannel.get(cid);
    if (!ring) {
      ring = new EvidenceRing(n);
      byChannel.set(cid, ring);
    }
    return ring;
  };
  return {
    hashEvidenceText,
    normalizeEvidenceText,
    isDuplicate(channelId, evidenceText) {
      const ring = getRing(channelId);
      if (!ring) return false;
      const h = hashEvidenceText(evidenceText);
      if (!h) return false;
      return ring.has(h);
    },
    record(channelId, evidenceText) {
      const ring = getRing(channelId);
      if (!ring) return { ok: false };
      const h = hashEvidenceText(evidenceText);
      const short = normalizeEvidenceText(evidenceText).replace(/\n/g, ' ').slice(0, 200);
      if (!h) return { ok: false };
      ring.push(h, short);
      return { ok: true, hash: h, short };
    },
  };
}

module.exports = { createEvidenceDeduper, hashEvidenceText, normalizeEvidenceText };

