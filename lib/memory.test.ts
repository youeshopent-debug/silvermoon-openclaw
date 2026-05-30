import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMemory, MemoryStore } from "./memory.js";

// ---------------------------------------------------------------------------
// memory 模块契约测试
// createMemory({ dbPath }) → MemoryStore 实例
//
// 测试策略：使用 better-sqlite3 :memory: 模式，无需 mock 数据库
// embedding 模块为可选依赖，try/catch 保护，不影响核心 FTS5 功能
// ---------------------------------------------------------------------------

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = createMemory({ dbPath: ":memory:" });
  });

  afterEach(() => {
    store.close();
  });

  // ── 1. init() ─────────────────────────────────────────────────────────
  describe("init", () => {
    it("should initialize with :memory: dbPath", () => {
      const result = store.init();
      expect(result).toEqual({ ok: true });
    });

    it("should fail with missing dbPath", () => {
      const badStore = createMemory({ dbPath: "" });
      const result = badStore.init();
      expect(result).toEqual({ ok: false, reason: "missing_db_path" });
    });
  });

  // ── 2. append ─────────────────────────────────────────────────────────
  describe("append", () => {
    beforeEach(() => {
      store.init();
    });

    it("should append a record successfully", () => {
      const result = store.append({
        uid: "test-001",
        content: "用户询问了汇率计算",
        role: "user",
      });
      expect(result).toEqual({ ok: true, changes: 1 });
    });

    it("should reject empty uid", () => {
      const result = store.append({
        uid: "",
        content: "some content",
      });
      expect(result).toEqual({ ok: false, reason: "invalid_record" });
    });

    it("should reject empty content", () => {
      const result = store.append({
        uid: "test-002",
        content: "",
      });
      expect(result).toEqual({ ok: false, reason: "invalid_record" });
    });

    it("should ignore duplicate uid (INSERT OR IGNORE)", () => {
      store.append({ uid: "dup-001", content: "first entry" });
      const result = store.append({ uid: "dup-001", content: "second entry" });
      // changes === 0 表示 INSERT OR IGNORE 没有插入新行
      expect(result).toEqual({ ok: true, changes: 0 });
    });

    it("should store and recall channelId", () => {
      store.append({
        uid: "ch-test",
        content: "channel specific memory",
        channelId: "discord:123",
      });
      const r = store.search("channel", { limit: 10 });
      expect(r.ok).toBe(true);
      expect(r.items.length).toBeGreaterThanOrEqual(1);
      expect(r.items[0].channelId).toBe("discord:123");
    });

    it("should store meta as JSON string", () => {
      store.append({
        uid: "meta-test",
        content: "memory with metadata",
        meta: { source: "test", priority: 1 },
      });
      // 无法直接读取 meta，但确认不抛异常即可
      const r = store.search("memory", { limit: 10 });
      expect(r.ok).toBe(true);
      expect(r.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 3. search ─────────────────────────────────────────────────────────
  describe("search", () => {
    beforeEach(() => {
      store.init();
      store.append({ uid: "s1", content: "today exchange rate USD/MYR is 4.5", role: "user" });
      store.append({ uid: "s2", content: "help debug Vercel deployment logs", role: "user" });
      store.append({ uid: "s3", content: "order #12345 has been shipped", role: "assistant" });
    });

    it("should find matching records by FTS5", () => {
      const r = store.search("exchange rate", { limit: 10 });
      expect(r.ok).toBe(true);
      expect(r.items.length).toBeGreaterThanOrEqual(1);
      expect(r.items.some((i) => i.uid === "s1")).toBe(true);
    });

    it("should return empty items for non-matching query", () => {
      const r = store.search("xyznonexistent", { limit: 10 });
      expect(r.ok).toBe(true);
      expect(r.items).toEqual([]);
    });

    it("should return empty items for empty query", () => {
      const r = store.search("", { limit: 10 });
      expect(r.ok).toBe(true);
      expect(r.items).toEqual([]);
    });

    it("should respect limit parameter", () => {
      // 插入更多记录
      for (let i = 0; i < 10; i++) {
        store.append({ uid: `bulk-${i}`, content: `test record number ${i}` });
      }
      const r = store.search("test", { limit: 3 });
      expect(r.ok).toBe(true);
      expect(r.items.length).toBeLessThanOrEqual(3);
    });

    it("should clamp limit to max 50", () => {
      const r = store.search("test", { limit: 999 });
      expect(r.ok).toBe(true);
      expect(r.items.length).toBeLessThanOrEqual(50);
    });

    it("should include snippet and rank in results", () => {
      const r = store.search("exchange rate", { limit: 10 });
      expect(r.items.length).toBeGreaterThanOrEqual(1);
      const item = r.items[0];
      expect(typeof item.uid).toBe("string");
      expect(typeof item.snippet).toBe("string");
      expect(typeof item.rank).toBe("number");
      expect(item.at).toBeTruthy();
    });
  });

  // ── 4. searchDeep ─────────────────────────────────────────────────────
  describe("searchDeep", () => {
    beforeEach(() => {
      store.init();
      store.append({ uid: "d1", content: "user deployed Vercel project", role: "user" });
      store.append({ uid: "d2", content: "project uses Next.js framework", role: "user" });
      store.append({ uid: "d3", content: "current progress frontend 80 percent done", role: "assistant" });
    });

    it("should expand search with related terms", () => {
      const r = store.searchDeep("progress", { limit: 10 });
      expect(r.ok).toBe(true);
      expect(r.items.length).toBeGreaterThanOrEqual(1);
      // expanded 应为 true（当搜索结果不足时会扩展）
      // 注意：如果 rank 满足条件则不会扩展
      expect(r.expanded).toBeDefined();
    });

    it("should deduplicate results", () => {
      // 搜索 deep 应该去重
      const r = store.searchDeep("Vercel", { limit: 10 });
      expect(r.ok).toBe(true);
      const uids = r.items.map((i) => i.uid);
      expect(new Set(uids).size).toBe(uids.length);
    });
  });

  // ── 5. expandRadius (alias for searchDeep) ────────────────────────────
  describe("expandRadius", () => {
    beforeEach(() => {
      store.init();
      store.append({ uid: "e1", content: "测试 expand radius 功能", role: "user" });
    });

    it("should be an alias for searchDeep", () => {
      const r1 = store.searchDeep("测试", { limit: 10 });
      const r2 = store.expandRadius("测试", { limit: 10 });
      expect(r2.ok).toBe(r1.ok);
      expect(Array.isArray(r2.items)).toBe(true);
    });
  });

  // ── 6. migrateFromJsonl ──────────────────────────────────────────────
  describe("migrateFromJsonl", () => {
    beforeEach(() => {
      store.init();
    });

    it("should return missing_source for non-existent path", () => {
      const r = store.migrateFromJsonl("/nonexistent/path.jsonl");
      expect(r).toEqual({ ok: false, reason: "missing_source" });
    });
  });

  // ── 7. close ──────────────────────────────────────────────────────────
  describe("close", () => {
    it("should close the database cleanly", () => {
      store.init();
      const r = store.close();
      expect(r).toEqual({ ok: true });
    });

    it("should be callable multiple times (idempotent)", () => {
      store.close();
      const r = store.close();
      expect(r).toEqual({ ok: true });
    });
  });

  // ── 8. not_ready guard ────────────────────────────────────────────────
  describe("guard against uninitialized store", () => {
    it("append should return not_ready before init", () => {
      const r = store.append({ uid: "x", content: "test" });
      expect(r).toEqual({ ok: false, reason: "not_ready" });
    });

    it("search should return not_ready before init", () => {
      const r = store.search("test", { limit: 10 });
      expect(r).toEqual({ ok: false, reason: "not_ready", items: [] });
    });
  });
});
