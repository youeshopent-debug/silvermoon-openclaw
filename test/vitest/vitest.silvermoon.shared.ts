import { defineConfig } from "vitest/config";

export const silvermoonRoot = new URL("../../", import.meta.url).pathname;

export const silvermoonTestPatterns = [
  // 仅匹配 lib/ 下新创建的 TypeScript 契约测试文件
  // 排除 tests/ 下 39 个已有 TAP/node 测试文件（使用 run() IIFE，非 vitest 兼容）
  "lib/**/*.test.ts",
];

export const silvermoonExcludePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/venv-fish/**",
];

export function createSilvermoonVitestConfig(
  testPatterns: string[] = silvermoonTestPatterns,
  overrides: Record<string, unknown> = {},
) {
  return defineConfig({
    test: {
      include: testPatterns,
      exclude: silvermoonExcludePatterns,
      globals: true,
      environment: "node",
      setupFiles: ["./test/vitest/vitest.silvermoon.setup.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov", "html"],
        include: ["lib/**", "tests/**"],
        exclude: ["**/node_modules/**"],
      },
      ...overrides,
    },
  });
}
