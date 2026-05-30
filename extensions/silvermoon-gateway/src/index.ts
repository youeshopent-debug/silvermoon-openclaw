import { BrainRouter, type IntentResult, type AgentRanking, type AgentInfo } from "./brain-router.js";

export interface Message {
  channel: "telegram" | "discord" | "http";
  userId: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export class SilvermoonGateway {
  private brainRouter: BrainRouter;
  private ready = false;
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.brainRouter = new BrainRouter();
  }

  async onStartup(): Promise<void> {
    console.log("[silvermoon-gateway] 银月网关初始化中...");
    this.brainRouter.registerDefaultAgents();
    this.ready = true;
    console.log("[silvermoon-gateway] 银月网关就绪 — 8 位 OC 已在线待命");

    // 启动心跳超时巡检：每 30 秒检查一次，120 秒无心跳的 OC 自动降级 offline
    this.staleCheckTimer = setInterval(() => {
      this.brainRouter.checkStaleAgents(120_000);
    }, 30_000);
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
    const targetName = intent.entities?.targetAgent as string | undefined;

    // 如果命中了特定 OC，刷新其心跳 + 展示状态
    if (targetName) {
      this.brainRouter.heartbeat(targetName);
      const targetAgent = this.brainRouter.getAgentStatus(targetName);
      if (targetAgent) {
        const skillDisplay = targetAgent.skills.join(" / ");
        const statusIcon = targetAgent.status === "online" ? "🟢 在线" :
                           targetAgent.status === "idle"   ? "🟡 待命" :
                                                             "🔴 离线";
        return `【${targetAgent.displayName}】在呢，随时听候差遣 ✨

🎯 领域: ${skillDisplay}
📋 意图: ${intent.intent}
⚡ 状态: ${statusIcon}`;
      }
    }

    const idleCount = ranked.length - 1;
    const idleNote = idleCount > 0 ? `（另有 ${idleCount} 位 OC 待命中）` : "";

    return `【${lead.agentName}】正在处理您的请求...${idleNote}

📋 意图: ${intent.intent}
🎯 置信度: ${(intent.confidence * 100).toFixed(0)}%`;
  }

  async onShutdown(): Promise<void> {
    console.log("[silvermoon-gateway] 银月网关正在关闭...");
    this.ready = false;
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
  }
}
