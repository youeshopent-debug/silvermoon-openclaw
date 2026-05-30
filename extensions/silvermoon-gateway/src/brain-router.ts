export interface AgentInfo {
  name: string;
  displayName: string;
  skills: string[];
  status: "online" | "idle" | "busy";
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities?: Record<string, unknown>;
}

export interface AgentRanking {
  agentName: string;
  score: number;
}

/**
 * 8 位核心 OC 定义
 * 所有 OC 初始为 idle（待命）状态，银月为 online（常驻在线）
 */
const DEFAULT_AGENTS: AgentInfo[] = [
  { name: "OC银月",  displayName: "银月",   skills: ["payment", "admin", "chat"],   status: "online" },
  { name: "OC李长寿", displayName: "李长寿", skills: ["chat"],                       status: "idle"   },
  { name: "OC墨影",   displayName: "墨影",   skills: ["chat"],                       status: "idle"   },
  { name: "OC药老",   displayName: "药老",   skills: ["chat"],                       status: "idle"   },
  { name: "OC美杜莎", displayName: "美杜莎", skills: ["chat"],                       status: "idle"   },
  { name: "OC雅妃",   displayName: "雅妃",   skills: ["chat"],                       status: "idle"   },
  { name: "OC萧炎",   displayName: "萧炎",   skills: ["chat"],                       status: "idle"   },
  { name: "OC韩立",   displayName: "韩立",   skills: ["chat"],                       status: "idle"   },
];

export class BrainRouter {
  private agentRegistry: Map<string, AgentInfo> = new Map();

  /**
   * 注册 8 位核心 OC
   */
  registerDefaultAgents(): void {
    for (const agent of DEFAULT_AGENTS) {
      this.agentRegistry.set(agent.name, { ...agent });
    }
    console.log(`[brain-router] ${DEFAULT_AGENTS.length} 位 OC 已注册`);
  }

  /**
   * 注册或更新单个 Agent
   */
  registerAgent(agent: AgentInfo): void {
    this.agentRegistry.set(agent.name, { ...agent });
  }

  /**
   * 获取所有已注册 Agent
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * 根据技能域获取可用 Agent
   */
  getAvailableAgents(skill?: string): AgentInfo[] {
    const all = this.getAllAgents();
    if (!skill) {
      return all;
    }
    return all.filter((a) => a.skills.includes(skill));
  }

  /**
   * 意图识别：通过关键词匹配确定用户意图
   */
  resolveIntent(text: string): IntentResult {
    const lower = text.toLowerCase();

    // 转账 / 支付 / 交易类
    if (
      lower.includes("转账") || lower.includes("转帐") ||
      lower.includes("支付") || lower.includes("付款") ||
      lower.includes("usdt") || lower.includes("ustd") ||
      lower.includes("打钱") || lower.includes("汇款") ||
      lower.includes("提现") || lower.includes("充值")
    ) {
      return { intent: "payment", confidence: 0.95, entities: { type: "transfer" } };
    }

    // 查询 / 余额 / 账单类
    if (
      lower.includes("余额") || lower.includes("账单") ||
      lower.includes("流水") || lower.includes("明细") ||
      lower.includes("交易记录") || lower.includes("查账")
    ) {
      return { intent: "payment", confidence: 0.85, entities: { type: "inquiry" } };
    }

    // 行情 / 价格类
    if (
      lower.includes("行情") || lower.includes("价格") ||
      lower.includes("btc") || lower.includes("eth") ||
      lower.includes("汇率") || lower.includes("报价")
    ) {
      return { intent: "market", confidence: 0.9, entities: { type: "quote" } };
    }

    // 管理 / 设置类
    if (
      lower.includes("设置") || lower.includes("配置") ||
      lower.includes("管理") || lower.includes("权限") ||
      lower.includes("admin") || lower.includes("系统")
    ) {
      return { intent: "admin", confidence: 0.85 };
    }

    // 打招呼 / 闲聊类
    if (
      lower.includes("你好") || lower.includes("在吗") ||
      lower.includes("在不在") || lower.includes("help") ||
      lower.includes("帮助") || lower.includes("hi") ||
      lower.includes("hello") || lower.includes("嗨")
    ) {
      return { intent: "chat", confidence: 0.8 };
    }

    // 唤出特定 OC
    for (const agent of this.agentRegistry.values()) {
      // 匹配 displayName 或 name（如 "银月"、"萧炎"）
      if (lower.includes(agent.displayName) || lower.includes(agent.name)) {
        return { intent: "chat", confidence: 0.9, entities: { targetAgent: agent.name } };
      }
    }

    // 兜底：未知意图
    return { intent: "unknown", confidence: 0.2 };
  }

  /**
   * Agent 排名：根据意图匹配度对 Agent 排序
   * 银月始终排第一，其余按技能匹配度排序
   */
  rankAgents(intent: string, _meta?: Record<string, unknown>): AgentRanking[] {
    const rankings: AgentRanking[] = [];

    for (const [, agent] of this.agentRegistry) {
      let score = 0;

      // 技能匹配加分
      if (agent.skills.includes(intent)) {
        score += 0.5;
      }

      // 在线状态加分
      if (agent.status === "online") {
        score += 0.3;
      } else if (agent.status === "idle") {
        score += 0.1;
      }

      // 银月特权：始终 +0.5 确保排第一
      if (agent.name === "OC银月") {
        score += 0.5;
      }

      rankings.push({ agentName: agent.name, score });
    }

    // 按分数降序排列
    return rankings.sort((a, b) => b.score - a.score);
  }
}
