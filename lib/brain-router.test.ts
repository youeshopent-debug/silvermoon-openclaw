import { describe, it, expect, vi } from "vitest";
import { routeWithLLM } from "./brain-router.js";

// ---------------------------------------------------------------------------
// brain-router 契约测试
// routeWithLLM({ askFast, text, memoryHint?, channelId? })
//   → Promise<{ mode: 'chat'|'work', brain: 'groq'|'gemini'|'ollama', needsTools: boolean }>
// ---------------------------------------------------------------------------

function createMockAsk(responseText: string) {
  return vi.fn<(...args: unknown[]) => Promise<string>>().mockResolvedValue(responseText);
}

describe("routeWithLLM", () => {
  // ── 1. askFast 非函数 → fallback ─────────────────────────────────────
  it("should return fallback when askFast is not a function", async () => {
    const result = await routeWithLLM({
      askFast: undefined as unknown as (...args: unknown[]) => Promise<string>,
      text: "hello",
    });
    expect(result).toEqual({ mode: "chat", brain: "groq", needsTools: false });
  });

  // ── 2. 空文本 → 正常调用并返回 LLM 结果 ─────────────────────────────
  it("should handle empty text gracefully", async () => {
    const askFast = createMockAsk(
      '{"mode":"chat","brain":"groq","needsTools":false}',
    );
    const result = await routeWithLLM({ askFast, text: "" });
    expect(result).toEqual({ mode: "chat", brain: "groq", needsTools: false });
    expect(askFast).toHaveBeenCalledWith(
      expect.stringContaining("用户输入："),
      expect.any(Object),
    );
  });

  // ── 3. LLM 返回 work + gemini + needsTools:true ───────────────────────
  it("should route to work mode when LLM returns work config", async () => {
    const askFast = createMockAsk(
      '{"mode":"work","brain":"gemini","needsTools":true}',
    );
    const result = await routeWithLLM({
      askFast,
      text: "帮我排查服务器日志",
    });
    expect(result).toEqual({ mode: "work", brain: "gemini", needsTools: true });
  });

  // ── 4. LLM 返回 chat + groq ──────────────────────────────────────────
  it("should route to chat mode when LLM returns chat config", async () => {
    const askFast = createMockAsk(
      '{"mode":"chat","brain":"groq","needsTools":false}',
    );
    const result = await routeWithLLM({
      askFast,
      text: "你好，今天天气如何？",
    });
    expect(result).toEqual({
      mode: "chat",
      brain: "groq",
      needsTools: false,
    });
  });

  // ── 5. LLM 返回 ollama brain ─────────────────────────────────────────
  it("should support ollama brain", async () => {
    const askFast = createMockAsk(
      '{"mode":"chat","brain":"ollama","needsTools":false}',
    );
    const result = await routeWithLLM({ askFast, text: "hello" });
    expect(result).toEqual({
      mode: "chat",
      brain: "ollama",
      needsTools: false,
    });
  });

  // ── 6. JSON 提取失败（非 JSON 响应）→ fallback ──────────────────────
  it("should fallback when LLM returns non-JSON response", async () => {
    const askFast = createMockAsk("抱歉，我无法理解你的问题。");
    const result = await routeWithLLM({ askFast, text: "测试非JSON" });
    expect(result).toEqual({ mode: "chat", brain: "groq", needsTools: false });
  });

  // ── 7. memoryHint 正确传递至 prompt ──────────────────────────────────
  it("should include memoryHint in the prompt", async () => {
    const askFast = createMockAsk(
      '{"mode":"chat","brain":"groq","needsTools":false}',
    );
    await routeWithLLM({
      askFast,
      text: "继续上次的话题",
      memoryHint: "用户上次询问了汇率计算",
    });
    expect(askFast).toHaveBeenCalledWith(
      expect.stringContaining("记忆提示：用户上次询问了汇率计算"),
      expect.any(Object),
    );
  });

  // ── 8. askFast 抛异常 → fallback ─────────────────────────────────────
  it("should fallback when askFast throws", async () => {
    const askFast = vi
      .fn<(...args: unknown[]) => Promise<string>>()
      .mockRejectedValue(new Error("API down"));
    const result = await routeWithLLM({ askFast, text: "test" });
    expect(result).toEqual({ mode: "chat", brain: "groq", needsTools: false });
  });
});
