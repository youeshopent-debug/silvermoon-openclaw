import { defineConfig } from "vitest/config";

export const silvermoonRoot = new URL("../../", import.meta.url).pathname;

export const silvermoonTestPatterns = [
  // lib/ 下的 TypeScript 契约测试文件
  "lib/**/*.test.ts",
  // tests/ 下已迁移至 vitest 模式的 silvermoon 测试文件
  "tests/silvermoon-*.test.js",
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
