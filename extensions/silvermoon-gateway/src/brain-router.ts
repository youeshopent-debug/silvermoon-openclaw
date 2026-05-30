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
 *
 * 技能域说明:
 *   code/architecture/engineering    — 代码工程、架构设计（李长寿）
 *   monitoring/watchdog/health/ops   — 系统健康、看门狗、运维（墨影）
 *   copywriting/seo/content          — 文案、小说、SEO（药老）
 *   design/ui/ux/social_media/image  — 设计、UI/UX、社交媒体图片（美杜莎）
 *   accounting/bookkeeping/investment— 个人账目、公司账目、投资（雅妃）
 *   trading/forex/options/stocks     — 金融交易、外汇、期权（萧炎）
 *   ecommerce/shopify/research       — 产品搜索、Shopify（韩立）
 *   payment/admin/gateway            — 支付、管理、网关调度（银月）
 *
 * 状态: online（常驻在线）/ idle（待命）/ busy（忙碌）
 */
const DEFAULT_AGENTS: AgentInfo[] = [
  { name: "OC银月",  displayName: "银月",   skills: ["payment", "admin", "gateway"],              status: "online" },
  { name: "OC李长寿", displayName: "李长寿", skills: ["code", "architecture", "engineering"],      status: "idle"   },
  { name: "OC墨影",   displayName: "墨影",   skills: ["monitoring", "watchdog", "health", "ops"],  status: "idle"   },
  { name: "OC药老",   displayName: "药老",   skills: ["copywriting", "seo", "content"],            status: "idle"   },
  { name: "OC美杜莎", displayName: "美杜莎", skills: ["design", "ui", "ux", "social_media", "image"], status: "idle"},
  { name: "OC雅妃",   displayName: "雅妃",   skills: ["accounting", "bookkeeping", "investment"],  status: "idle"   },
  { name: "OC萧炎",   displayName: "萧炎",   skills: ["trading", "forex", "options", "stocks"],    status: "idle"   },
  { name: "OC韩立",   displayName: "韩立",   skills: ["ecommerce", "shopify", "research"],         status: "idle"   },
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

    // ── 代码 / 架构（李长寿） ──
    if (
      lower.includes("代码") || lower.includes("重构") ||
      lower.includes("架构") || lower.includes("系统设计") ||
      lower.includes("bug") || lower.includes("调试") ||
      lower.includes("部署") || lower.includes("cicd") ||
      lower.includes("ci/cd") || lower.includes("自动化") ||
      lower.includes("重构") || lower.includes("单元测试") ||
      lower.includes("测试") || lower.includes("pull request") ||
      lower.includes("pr") || lower.includes("代码审查")
    ) {
      return { intent: "code", confidence: 0.9 };
    }

    // ── 系统健康 / 看门狗（墨影） ──
    if (
      lower.includes("健康") || lower.includes("状态") ||
      lower.includes("看门狗") || lower.includes("watchdog") ||
      lower.includes("监控") || lower.includes("报警") ||
      lower.includes("日志") || lower.includes("异常") ||
      lower.includes("错误") || lower.includes("宕机") ||
      lower.includes("崩溃") || lower.includes("内存") ||
      lower.includes("cpu") || lower.includes("负载") ||
      lower.includes("重启") || lower.includes("恢复")
    ) {
      return { intent: "monitoring", confidence: 0.9 };
    }

    // ── 文案 / SEO（药老） ──
    if (
      lower.includes("文案") || lower.includes("写作") ||
      lower.includes("小说") || lower.includes("文章") ||
      lower.includes("seo") || lower.includes("seo标题") ||
      lower.includes("标签") || lower.includes("meta") ||
      lower.includes("描述") || lower.includes("内容") ||
      lower.includes("创作") || lower.includes("润色") ||
      lower.includes("修改文章") || lower.includes("标题优化")
    ) {
      return { intent: "copywriting", confidence: 0.9 };
    }

    // ── 设计 / UI/UX（美杜莎） ──
    if (
      lower.includes("设计") || lower.includes("图片") ||
      lower.includes("图案") || lower.includes("ui") ||
      lower.includes("ux") || lower.includes("界面") ||
      lower.includes("社交媒体图片") || lower.includes("海报") ||
      lower.includes("banner") || lower.includes("logo") ||
      lower.includes("配色") || lower.includes("字体") ||
      lower.includes("布局") || lower.includes("视觉")
    ) {
      return { intent: "design", confidence: 0.9 };
    }

    // ── 账目 / 投资（雅妃） ──
    if (
      lower.includes("账目") || lower.includes("记账") ||
      lower.includes("账本") || lower.includes("财务报表") ||
      lower.includes("收支") || lower.includes("利润") ||
      lower.includes("成本") || lower.includes("税务") ||
      lower.includes("发票") || lower.includes("对账") ||
      lower.includes("投资回报") || lower.includes("roi") ||
      lower.includes("稳定投资") || lower.includes("理财")
    ) {
      return { intent: "accounting", confidence: 0.9 };
    }

    // ── 金融交易 / 外汇 / 股票（萧炎） ──
    if (
      lower.includes("外汇") || lower.includes("forex") ||
      lower.includes("期权") || lower.includes("options") ||
      lower.includes("股票") || lower.includes("stocks") ||
      lower.includes("交易") || lower.includes("trade") ||
      lower.includes("买入") || lower.includes("卖出") ||
      lower.includes("做多") || lower.includes("做空") ||
      lower.includes("k线") || lower.includes("k线图") ||
      lower.includes("技术分析") || lower.includes("行情分析") ||
      lower.includes("纳斯达克") || lower.includes("标普") ||
      lower.includes("a股") || lower.includes("港股")
    ) {
      return { intent: "trading", confidence: 0.9 };
    }

    // ── 电商 / Shopify / 产品搜索（韩立） ──
    if (
      lower.includes("产品") || lower.includes("商品") ||
      lower.includes("shopify") || lower.includes("店铺") ||
      lower.includes("上架") || lower.includes("采购") ||
      lower.includes("搜索产品") || lower.includes("选品") ||
      lower.includes("供应商") || lower.includes("货源") ||
      lower.includes("eastel") || lower.includes("sim卡") ||
      lower.includes("物流") || lower.includes("库存")
    ) {
      return { intent: "ecommerce", confidence: 0.9 };
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

    // 唤出特定 OC — 映射到对应技能域
    for (const agent of this.agentRegistry.values()) {
      if (lower.includes(agent.displayName) || lower.includes(agent.name)) {
        // 取该 OC 的第一个技能作为主意图
        const primarySkill = agent.skills.length > 0 ? agent.skills[0] : "chat";
        return { intent: primarySkill, confidence: 0.9, entities: { targetAgent: agent.name } };
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
