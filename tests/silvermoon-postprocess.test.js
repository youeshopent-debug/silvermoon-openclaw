const { postprocessSilvermoonReply } = require("../lib/silvermoon-postprocess");

describe("silvermoon-postprocess", () => {
  // ── postprocessSilvermoonReply 函数存在 ──────────────────────────────
  it("should export postprocessSilvermoonReply function", () => {
    expect(typeof postprocessSilvermoonReply).toBe("function");
  });

  // ── 场景 1：屏蔽 "工具不可用" + 注入记忆片段 ────────────────────────
  it("should strip '工具不可用' and inject memory snippet", () => {
    const raw = [
      "✅ 主人",
      "🔹 结论：由于工具不可用，无法直接提供 RWA 领域的新动向信息。",
      "🔹 建议：请提供更多关键词。",
    ].join("\n");
    const memSearch = () => ({
      ok: true,
      items: [
        {
          uid: "m1",
          snippet: "2026-04-16 已部署到 Vercel，Next.js 项目进入验收。",
        },
      ],
    });
    const out = postprocessSilvermoonReply({
      replyText: raw,
      userText: "rwa领域有什么新动向吗？",
      channelId: "c1",
      memorySearch: memSearch,
    });

    expect(out.includes("工具不可用")).toBe(false);
    expect(out.includes("无法直接提供")).toBe(false);
    expect(
      /快速发展的领域|基于知识库显示|基于基座模型知识库|由于外部检索未回传证据/.test(out),
    ).toBe(false);
    expect(/Vercel|Next\.js/i.test(out)).toBe(true);
    expect(out.startsWith("✅ 主人")).toBe(true);
    expect(out.includes("项目进度")).toBe(true);
    expect(out.includes("🔹 2026-04-16 已部署到")).toBe(true);
  });

  // ── 场景 2：工具不可用文本被记忆增强输出替换 ────────────────────────
  it("should replace useless reply with memory-enhanced structured output", () => {
    const raw = [
      "✅ 主人",
      "🔹 结论：由于工具不可用，无法直接提供 RWA 领域的新动向信息。",
    ].join("\n");
    const memSearch = () => ({
      ok: true,
      items: [
        {
          uid: "m1",
          snippet: "2026-04-16 已部署到 Vercel，Next.js 项目进入验收。",
        },
      ],
    });
    const out = postprocessSilvermoonReply({
      replyText: raw,
      userText: "RWA 合规有什么变化？",
      channelId: "c1",
      memorySearch: memSearch,
    });

    expect(out.startsWith("✅ 主人")).toBe(true);
    expect(out.includes("工具不可用")).toBe(false);
    expect(out.includes("项目进度")).toBe(true);
    expect(out.includes("Vercel")).toBe(true);
    expect(out.includes("Next.js")).toBe(true);
    expect(
      /快速发展的领域|基于知识库显示|基于基座模型知识库|由于外部检索未回传证据/.test(out),
    ).toBe(false);
  });
});
