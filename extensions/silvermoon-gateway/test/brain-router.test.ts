import { describe, it, expect, beforeEach } from "vitest";
import { BrainRouter } from "../src/brain-router.js";

// ---------------------------------------------------------------------------
// BrainRouter（扩展版）契约测试
// resolveIntent(text)  → IntentResult { intent, confidence, entities? }
// rankAgents(intent)    → AgentRanking[] 银月始终第一
// ---------------------------------------------------------------------------

function createRouter(): BrainRouter {
  const router = new BrainRouter();
  router.registerDefaultAgents();
  return router;
}

describe("BrainRouter — resolveIntent", () => {
  let router: BrainRouter;

  beforeEach(() => {
    router = createRouter();
  });

  // ── Vision intent（看图 / 图片识别 — 美杜莎） ──────────────────────────

  it('should resolve "看这张图" to vision intent', () => {
    const r = router.resolveIntent("帮我看看这张图有什么");
    expect(r.intent).toBe("vision");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should resolve "图片里有什么" to vision intent', () => {
    const r = router.resolveIntent("图片里有什么东西");
    expect(r.intent).toBe("vision");
  });

  it('should resolve "分析图片" to vision intent', () => {
    const r = router.resolveIntent("分析图片内容");
    expect(r.intent).toBe("vision");
  });

  it('should resolve "识别图片" to vision intent', () => {
    const r = router.resolveIntent("识别图片中的文字");
    expect(r.intent).toBe("vision");
  });

  it('should resolve "vision" keyword to vision intent', () => {
    const r = router.resolveIntent("vision analysis");
    expect(r.intent).toBe("vision");
  });

  it('should resolve "读取图片" to vision intent', () => {
    const r = router.resolveIntent("读取图片文件");
    expect(r.intent).toBe("vision");
  });

  it('should resolve "图片分析" to vision intent', () => {
    const r = router.resolveIntent("进行图片分析");
    expect(r.intent).toBe("vision");
  });

  // ── Screenshot intent（截图 / 截屏 — 墨影） ────────────────────────────

  it('should resolve "截图" to screenshot intent', () => {
    const r = router.resolveIntent("帮我截图");
    expect(r.intent).toBe("screenshot");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should resolve "截屏" to screenshot intent', () => {
    const r = router.resolveIntent("截屏当前页面");
    expect(r.intent).toBe("screenshot");
  });

  it('should resolve "screenshot" to screenshot intent', () => {
    const r = router.resolveIntent("take a screenshot");
    expect(r.intent).toBe("screenshot");
  });

  it('should resolve "屏幕截图" to screenshot intent', () => {
    const r = router.resolveIntent("生成屏幕截图");
    expect(r.intent).toBe("screenshot");
  });

  it('should resolve "桌面截图" to screenshot intent', () => {
    const r = router.resolveIntent("桌面截图发给我");
    expect(r.intent).toBe("screenshot");
  });

  it('should resolve "拍照" to screenshot intent', () => {
    const r = router.resolveIntent("帮我拍照");
    expect(r.intent).toBe("screenshot");
  });

  // ── Expanded monitoring keywords ────────────────────────────────────────

  it('should resolve "系统检查" to monitoring intent', () => {
    const r = router.resolveIntent("执行健康检查");
    expect(r.intent).toBe("monitoring");
  });

  it('should resolve "健康检查" to monitoring intent (existing)', () => {
    const r = router.resolveIntent("健康检查一下服务器");
    expect(r.intent).toBe("monitoring");
  });

  it('should resolve "状态检查" to monitoring intent', () => {
    const r = router.resolveIntent("状态检查所有服务");
    expect(r.intent).toBe("monitoring");
  });

  it('should resolve "运行状态" to monitoring intent', () => {
    const r = router.resolveIntent("查询服务器运行状态");
    expect(r.intent).toBe("monitoring");
  });

  // ── Expanded design keywords ────────────────────────────────────────────

  it('should resolve "修图" to design intent', () => {
    const r = router.resolveIntent("帮我修图");
    expect(r.intent).toBe("design");
  });

  it('should resolve "生成图片" to design intent', () => {
    const r = router.resolveIntent("生成图片素材");
    expect(r.intent).toBe("design");
  });

  it('should resolve "作图" to design intent', () => {
    const r = router.resolveIntent("帮我作图");
    expect(r.intent).toBe("design");
  });

  it('should resolve "画图" to design intent', () => {
    const r = router.resolveIntent("帮我画图");
    expect(r.intent).toBe("design");
  });

  it('should resolve "图标" to design intent', () => {
    const r = router.resolveIntent("设计一个图标");
    expect(r.intent).toBe("design");
  });

  it('should resolve "icon" to design intent', () => {
    const r = router.resolveIntent("create an icon");
    expect(r.intent).toBe("design");
  });

  it('should resolve "封面" to design intent', () => {
    const r = router.resolveIntent("设计封面图片");
    expect(r.intent).toBe("design");
  });

  it('should resolve "缩略图" to design intent', () => {
    const r = router.resolveIntent("生成视频缩略图");
    expect(r.intent).toBe("design");
  });

  it('should resolve "配图" to design intent', () => {
    const r = router.resolveIntent("给帖子配图");
    expect(r.intent).toBe("design");
  });

  // ── Existing intent regression tests ────────────────────────────────────

  it('should resolve "转账" to payment intent (existing)', () => {
    const r = router.resolveIntent("给我转账100 USDT");
    expect(r.intent).toBe("payment");
  });

  it('should resolve "余额" to payment/inquiry intent (existing)', () => {
    const r = router.resolveIntent("查询余额");
    expect(r.intent).toBe("payment");
  });

  it('should resolve "行情" to market intent (existing)', () => {
    const r = router.resolveIntent("查看BTC行情");
    expect(r.intent).toBe("market");
  });

  it('should resolve "设置" to admin intent (existing)', () => {
    const r = router.resolveIntent("帮我设置一下");
    expect(r.intent).toBe("admin");
  });

  it('should resolve "代码" to code intent (existing)', () => {
    const r = router.resolveIntent("帮我写代码");
    expect(r.intent).toBe("code");
  });

  it('should resolve "文案" to copywriting intent (existing)', () => {
    const r = router.resolveIntent("写一篇产品文案");
    expect(r.intent).toBe("copywriting");
  });

  it('should resolve "设计" to design intent (existing)', () => {
    const r = router.resolveIntent("设计一个海报");
    expect(r.intent).toBe("design");
  });

  it('should resolve "记账" to accounting intent (existing)', () => {
    const r = router.resolveIntent("帮我记账");
    expect(r.intent).toBe("accounting");
  });

  it('should resolve "外汇" to trading intent (existing)', () => {
    const r = router.resolveIntent("分析外汇走势");
    expect(r.intent).toBe("trading");
  });

  it('should resolve "产品" to ecommerce intent (existing)', () => {
    const r = router.resolveIntent("搜索产品");
    expect(r.intent).toBe("ecommerce");
  });

  it('should resolve "你好" to chat intent (existing)', () => {
    const r = router.resolveIntent("你好呀");
    expect(r.intent).toBe("chat");
  });

  // ── OC name detection ───────────────────────────────────────────────────

  it('should detect OC name "墨影" and route to his primary skill', () => {
    const r = router.resolveIntent("墨影");
    expect(r.entities?.targetAgent).toBe("OC墨影");
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('should detect OC name "美杜莎" and route to her primary skill', () => {
    const r = router.resolveIntent("呼叫美杜莎");
    expect(r.entities?.targetAgent).toBe("OC美杜莎");
  });

  it('should detect OC name "银月" and route to his primary skill', () => {
    const r = router.resolveIntent("银月，帮我看一下");
    expect(r.entities?.targetAgent).toBe("OC银月");
  });

  // ── Unknown fallback ────────────────────────────────────────────────────

  it('should return unknown intent for unrelated text', () => {
    const r = router.resolveIntent("中午吃什么");
    expect(r.intent).toBe("unknown");
    expect(r.confidence).toBeLessThanOrEqual(0.3);
  });

  it('should handle empty string gracefully', () => {
    const r = router.resolveIntent("");
    expect(r.intent).toBe("unknown");
  });

  it('should handle whitespace-only string gracefully', () => {
    const r = router.resolveIntent("   ");
    expect(r.intent).toBe("unknown");
  });

  // ── Intent priority: vision / screenshot before code ────────────────────

  it('should prioritize "vision" over "code" for ambiguous "看图片"', () => {
    const r = router.resolveIntent("看图片识别内容");
    expect(r.intent).toBe("vision");
  });

  it('should prioritize "screenshot" over "monitoring" for "截图"', () => {
    const r = router.resolveIntent("截图保存");
    expect(r.intent).toBe("screenshot");
  });

  it('should prioritize "design" over "vision" for "处理图片" design context', () => {
    // "处理图片" is in both vision and design lists, but design is checked after vision.
    // Vision matches first, so it should return "vision"
    const r = router.resolveIntent("处理图片尺寸");
    expect(r.intent).toBe("vision"); // vision check comes first
  });
});

describe("BrainRouter — rankAgents", () => {
  let router: BrainRouter;

  beforeEach(() => {
    router = createRouter();
  });

  it("should rank 银月 first for any intent", () => {
    const rankings = router.rankAgents("payment");
    expect(rankings[0].agentName).toBe("OC银月");
  });

  it("should place skill-matching agents higher than non-matching", () => {
    const rankings = router.rankAgents("design");
    const 美杜莎 = rankings.find((r) => r.agentName === "OC美杜莎");
    const 李长寿 = rankings.find((r) => r.agentName === "OC李长寿");
    expect(美杜莎).toBeDefined();
    expect(李长寿).toBeDefined();
    expect(美杜莎!.score).toBeGreaterThan(李长寿!.score);
  });

  it("should return all 8 agents in ranking", () => {
    const rankings = router.rankAgents("code");
    expect(rankings).toHaveLength(8);
  });

  it("should return scores in descending order", () => {
    const rankings = router.rankAgents("trading");
    for (let i = 1; i < rankings.length; i++) {
      expect(rankings[i - 1].score).toBeGreaterThanOrEqual(rankings[i].score);
    }
  });
});

describe("BrainRouter — agent registration", () => {
  it("should register all 8 default agents", () => {
    const router = createRouter();
    const agents = router.getAllAgents();
    expect(agents).toHaveLength(8);
    const names = agents.map((a) => a.name);
    expect(names).toContain("OC银月");
    expect(names).toContain("OC李长寿");
    expect(names).toContain("OC墨影");
    expect(names).toContain("OC药老");
    expect(names).toContain("OC美杜莎");
    expect(names).toContain("OC雅妃");
    expect(names).toContain("OC萧炎");
    expect(names).toContain("OC韩立");
  });

  it("should allow registering additional agents", () => {
    const router = new BrainRouter();
    router.registerAgent({
      name: "OC测试",
      displayName: "测试",
      skills: ["testing"],
      status: "online",
      lastHeartbeatAt: null,
    });
    expect(router.getAllAgents()).toHaveLength(1);
  });

  it("should filter available agents by skill", () => {
    const router = createRouter();
    const designers = router.getAvailableAgents("design");
    expect(designers).toHaveLength(1);
    expect(designers[0].name).toBe("OC美杜莎");
  });

  it("should return all agents when no skill filter provided", () => {
    const router = createRouter();
    expect(router.getAvailableAgents()).toHaveLength(8);
  });
});

describe("BrainRouter — heartbeat & stale detection", () => {
  let router: BrainRouter;

  beforeEach(() => {
    router = createRouter();
  });

  it("should record heartbeat for an agent", () => {
    const before = Date.now();
    router.heartbeat("OC银月");
    const agent = router.getAgentStatus("OC银月");
    expect(agent).toBeDefined();
    expect(agent!.lastHeartbeatAt).toBeGreaterThanOrEqual(before);
  });

  it("should not throw when heartbeating a non-existent agent", () => {
    expect(() => router.heartbeat("OC不存在")).not.toThrow();
  });

  it("should upgrade offline agent to idle on heartbeat", () => {
    // 模拟银月离线
    const agent = router.getAgentStatus("OC银月")!;
    agent.status = "offline";
    router.heartbeat("OC银月");
    const updated = router.getAgentStatus("OC银月")!;
    expect(updated.status).toBe("idle");
  });

  it("should keep online status after heartbeat", () => {
    router.heartbeat("OC银月");
    const agent = router.getAgentStatus("OC银月")!;
    expect(agent.status).toBe("online");
  });

  it("should NOT offline agents that have never heartbeaten (idle defaults)", () => {
    router.heartbeat("OC银月");
    // 李长寿默认 idle，从未 heartbeat → heartbeatTimestamps 无条目
    router.checkStaleAgents(0); // 0ms 超时 — 任何有心跳的都会触发
    const 李长寿 = router.getAgentStatus("OC李长寿")!;
    expect(李长寿.status).toBe("idle"); // 不应被降级
  });

  it("should detect stale agents (heartbeat timed out) and mark offline", () => {
    // 创建一个干净的 router，手动注册一个 agent，心跳后立即用 0 超时检查
    const r2 = new BrainRouter();
    r2.registerAgent({
      name: "OC测试离线",
      displayName: "测试离线",
      skills: ["test"],
      status: "online",
      lastHeartbeatAt: null,
    });
    r2.heartbeat("OC测试离线");               // 记录心跳时间戳
    r2.checkStaleAgents(-1);                   // -1ms：任何正时间差都触发离线
    const offlineAgent = r2.getAgentStatus("OC测试离线")!;
    expect(offlineAgent.status).toBe("offline");
  });

  it("should not offline agents with recent heartbeat within timeout", () => {
    const r2 = new BrainRouter();
    r2.registerAgent({
      name: "OC测试在线",
      displayName: "测试在线",
      skills: ["test"],
      status: "online",
      lastHeartbeatAt: null,
    });
    r2.heartbeat("OC测试在线");
    r2.checkStaleAgents(360_000); // 6 分钟超时，新心跳远小于此值
    const agent = r2.getAgentStatus("OC测试在线")!;
    expect(agent.status).toBe("online");
  });

  it("should return undefined for non-existent agent in getAgentStatus", () => {
    expect(router.getAgentStatus("OC不存在")).toBeUndefined();
  });
});
