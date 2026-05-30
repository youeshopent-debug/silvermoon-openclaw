import { BrainRouter, type IntentResult, type AgentRanking } from "./brain-router.js";

export interface Message {
  channel: "telegram" | "discord" | "http";
  userId: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export class SilvermoonGateway {
  private brainRouter: BrainRouter;
  private ready = false;

  constructor() {
    this.brainRouter = new BrainRouter();
  }

  async onStartup(): Promise<void> {
    console.log("[silvermoon-gateway] 银月网关初始化中...");
    this.brainRouter.registerDefaultAgents();
    this.ready = true;
    console.log("[silvermoon-gateway] 银月网关就绪 — 8 位 OC 已在线待命");
  }

  async handleMessage(msg: Message): Promise<string> {
    if (!this.ready) {
      return "⏳ 网关尚未就绪，请稍后再试";
    }

    const intent: IntentResult = this.brainRouter.resolveIntent(msg.text);

    if (intent.intent === "unknown" && intent.confidence < 0.3) {
      const ranked = this.brainRouter.rankAgents("chat");
      if (ranked.length === 0) {
        return "未能理解您的请求，请尝试重新描述";
      }
      return `【${ranked[0].agentName}】未能理解您的请求，请尝试重新描述`;
    }

    const ranked: AgentRanking[] = this.brainRouter.rankAgents(intent.intent, msg.metadata);

    if (ranked.length === 0) {
      return "暂无可用 OC 处理此请求";
    }

    const lead = ranked[0];
    const idleCount = ranked.length - 1;
    const idleNote = idleCount > 0 ? `（另有 ${idleCount} 位 OC 待命中）` : "";

    return `【${lead.agentName}】正在处理您的请求...${idleNote}

📋 意图: ${intent.intent}
🎯 置信度: ${(intent.confidence * 100).toFixed(0)}%`;
  }

  async onShutdown(): Promise<void> {
    console.log("[silvermoon-gateway] 银月网关正在关闭...");
    this.ready = false;
  }
}
