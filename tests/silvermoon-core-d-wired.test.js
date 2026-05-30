const fs = require("fs");
const path = require("path");

describe("silvermoon-core-d-wired", () => {
  const mainJsPath = path.join(__dirname, "..", "main.js");
  const mainJs = fs.readFileSync(mainJsPath, "utf-8");

  it("should require persona-silvermoon", () => {
    expect(mainJs.includes("require('./lib/persona-silvermoon')")).toBe(true);
  });

  it("should require brain-router", () => {
    expect(mainJs.includes("require('./lib/brain-router')")).toBe(true);
  });

  it("should require tools", () => {
    expect(mainJs.includes("require('./lib/tools')")).toBe(true);
  });

  it("should reference askSilvermoonAutonomyD", () => {
    expect(mainJs.includes("askSilvermoonAutonomyD")).toBe(true);
  });
});
