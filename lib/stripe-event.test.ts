import { describe, it, expect } from "vitest";
import { extractStripeUsdCents } from "./stripe-event.js";

// ---------------------------------------------------------------------------
// stripe-event 契约测试
// extractStripeUsdCents(evt) → { ok: true, amountUsdCents } | { ok: false, reason }
// 纯函数，无副作用，无需 mock
// ---------------------------------------------------------------------------

describe("extractStripeUsdCents", () => {
  // ── checkout.session.completed ────────────────────────────────────────
  describe("checkout.session.completed", () => {
    it("should extract amount_total successfully", () => {
      const evt = {
        type: "checkout.session.completed",
        data: { object: { amount_total: 5000 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: true, amountUsdCents: 5000 });
    });

    it("should reject missing amount_total", () => {
      const evt = {
        type: "checkout.session.completed",
        data: { object: {} },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });

    it("should reject null amount_total", () => {
      const evt = {
        type: "checkout.session.completed",
        data: { object: { amount_total: null } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });

    it("should reject negative amount_total", () => {
      const evt = {
        type: "checkout.session.completed",
        data: { object: { amount_total: -100 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });

    it("should reject decimal amount_total", () => {
      const evt = {
        type: "checkout.session.completed",
        data: { object: { amount_total: 10.5 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });

    it("should reject zero amount_total", () => {
      const evt = {
        type: "checkout.session.completed",
        data: { object: { amount_total: 0 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: true, amountUsdCents: 0 });
    });
  });

  // ── payment_intent.succeeded ──────────────────────────────────────────
  describe("payment_intent.succeeded", () => {
    it("should extract amount successfully", () => {
      const evt = {
        type: "payment_intent.succeeded",
        data: { object: { amount: 2999 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: true, amountUsdCents: 2999 });
    });

    it("should reject missing amount", () => {
      const evt = {
        type: "payment_intent.succeeded",
        data: { object: {} },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });

    it("should reject negative amount", () => {
      const evt = {
        type: "payment_intent.succeeded",
        data: { object: { amount: -1 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });
  });

  // ── unsupported event types ───────────────────────────────────────────
  describe("unsupported event types", () => {
    it("should reject charge.refunded", () => {
      const evt = {
        type: "charge.refunded",
        data: { object: { amount: 500 } },
      };
      const result = extractStripeUsdCents(evt);
      expect(result).toEqual({ ok: false, reason: "unsupported_type" });
    });

    it("should reject empty object", () => {
      const result = extractStripeUsdCents({});
      expect(result).toEqual({ ok: false, reason: "unsupported_type" });
    });

    it("should reject null input", () => {
      const result = extractStripeUsdCents(null as unknown as Record<string, unknown>);
      expect(result).toEqual({ ok: false, reason: "unsupported_type" });
    });

    it("should reject undefined input", () => {
      const result = extractStripeUsdCents(undefined as unknown as Record<string, unknown>);
      expect(result).toEqual({ ok: false, reason: "unsupported_type" });
    });

    it("should reject missing type field", () => {
      const evt = { data: { object: { amount: 100 } } };
      const result = extractStripeUsdCents(evt as unknown as Record<string, unknown>);
      expect(result).toEqual({ ok: false, reason: "unsupported_type" });
    });
  });

  // ── edge cases on data.object ─────────────────────────────────────────
  describe("edge cases on data.object", () => {
    it("should handle missing data field", () => {
      const evt = { type: "checkout.session.completed" };
      const result = extractStripeUsdCents(evt as unknown as Record<string, unknown>);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });

    it("should handle missing data.object field", () => {
      const evt = { type: "checkout.session.completed", data: {} };
      const result = extractStripeUsdCents(evt as unknown as Record<string, unknown>);
      expect(result).toEqual({ ok: false, reason: "missing_amount" });
    });
  });
});
