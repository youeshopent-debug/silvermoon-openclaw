import crypto from "node:crypto";

// ── 类型定义 ──

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown>;
  };
}

export interface SettlementReport {
  date: string;
  totalTransactions: number;
  totalAmount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
}

// ── 支付网关 ──

export class SilvermoonPayment {
  private webhookSecret: string;
  private transactionLog: StripeEvent[] = [];

  constructor() {
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  }

  /**
   * Stripe Webhook 处理器
   * 验证签名 → 解析事件 → 分派处理
   */
  async handleStripeWebhook(
    rawBody: string,
    signature: string
  ): Promise<{ status: number; message: string }> {
    // 签名验证
    if (this.webhookSecret) {
      const verified = this.verifySignature(rawBody, signature);
      if (!verified) {
        console.warn("[silvermoon-payment] Webhook 签名验证失败");
        return { status: 401, message: "Invalid signature" };
      }
    }

    try {
      const event: StripeEvent = JSON.parse(rawBody);

      // 记录交易
      this.transactionLog.push(event);
      if (this.transactionLog.length > 10000) {
        this.transactionLog.shift();
      }

      // 按事件类型分派
      switch (event.type) {
        case "payment_intent.succeeded":
          console.log(
            `[silvermoon-payment] 收款成功: ${event.id}`
          );
          break;

        case "payment_intent.payment_failed":
          console.warn(
            `[silvermoon-payment] 收款失败: ${event.id}`
          );
          break;

        case "charge.refunded":
          console.log(
            `[silvermoon-payment] 退款处理: ${event.id}`
          );
          break;

        case "charge.dispute.created":
          console.warn(
            `[silvermoon-payment] 争议创建: ${event.id} — 需要人工处理`
          );
          break;

        default:
          // 未知事件类型，记录但不处理
          console.log(
            `[silvermoon-payment] 未处理事件类型: ${event.type} (${event.id})`
          );
      }

      return { status: 200, message: "OK" };
    } catch (err) {
      console.error("[silvermoon-payment] Webhook 解析失败:", err);
      return { status: 400, message: "Invalid payload" };
    }
  }

  /**
   * Stripe 签名验证
   * 使用 HMAC-SHA256 验证 webhook 签名
   */
  private verifySignature(payload: string, signatureHeader: string): boolean {
    try {
      const parts = signatureHeader.split(",");
      const timestampPart = parts.find((p) => p.startsWith("t="));
      const signaturePart = parts.find((p) => p.startsWith("v1="));

      if (!timestampPart || !signaturePart) {
        return false;
      }

      const timestamp = timestampPart.slice(2);
      const expectedSig = signaturePart.slice(3);

      const signedPayload = `${timestamp}.${payload}`;
      const computedSig = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(signedPayload, "utf-8")
        .digest("hex");

      // 恒定时间比较，防止时序攻击
      if (computedSig.length !== expectedSig.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(computedSig, "utf-8"),
        Buffer.from(expectedSig, "utf-8")
      );
    } catch {
      return false;
    }
  }

  /**
   * 日终对账（Cron 触发）
   * 汇总当日交易，生成对账报告
   */
  async dailySettlement(): Promise<SettlementReport> {
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = Math.floor(
      new Date(`${today}T00:00:00Z`).getTime() / 1000
    );
    const todayEnd = Math.floor(
      new Date(`${today}T23:59:59Z`).getTime() / 1000
    );

    // 筛选当日成功交易
    const todayTransactions = this.transactionLog.filter((ev) => {
      if (ev.type !== "payment_intent.succeeded") return false;
      return ev.created >= todayStart && ev.created <= todayEnd;
    });

    const totalAmount = todayTransactions.reduce((sum, ev) => {
      const obj = ev.data.object as { amount?: number };
      return sum + (obj.amount || 0);
    }, 0);

    const report: SettlementReport = {
      date: today,
      totalTransactions: todayTransactions.length,
      totalAmount,
      currency: "usd",
      status: "completed",
    };

    console.log(
      `[silvermoon-payment] 日终对账 ${today}: ` +
      `${report.totalTransactions} 笔, ` +
      `$${(report.totalAmount / 100).toFixed(2)}`
    );

    return report;
  }
}
