import { vi } from "vitest";

// 全局测试环境标识
process.env.NODE_ENV = "test";

// Mock dotenv 避免测试时加载真实 .env
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));
