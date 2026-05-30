"use strict";

const fs = require("fs");
const path = require("path");
const crawler = require("../lib/xiaoyan-crawler");

const TEST_URL = process.argv[2] || "https://example.com";
const OUTPUT_FILE = path.join(__dirname, "..", "tmp_crawlee_screenshot.png");

(async () => {
  console.log(`[test-crawlee-screenshot] Target URL: ${TEST_URL}`);
  console.log("[test-crawlee-screenshot] Waiting for Crawlee init...");

  // Give Crawlee a moment to init
  await new Promise((r) => setTimeout(r, 1500));

  console.log("[test-crawlee-screenshot] Calling crawlAndScreenshot...");
  const result = await crawler.crawlAndScreenshot(TEST_URL);

  if (!result.success) {
    console.error(`[test-crawlee-screenshot] FAILED: ${result.error}`);
    process.exit(1);
  }

  const { url, title, textLength, screenshotBase64 } = result.data;

  console.log(`\n--- Results ---`);
  console.log(`URL:        ${url}`);
  console.log(`Title:      ${title}`);
  console.log(`Text length: ${textLength}`);
  console.log(`Screenshot base64 length: ${screenshotBase64.length} chars`);

  // Save screenshot to file
  const buf = Buffer.from(screenshotBase64, "base64");
  fs.writeFileSync(OUTPUT_FILE, buf);
  console.log(`\nScreenshot saved to: ${OUTPUT_FILE}`);
  console.log(`File size: ${buf.length} bytes`);

  // Verify file is a valid PNG
  if (buf.length < 100) {
    console.error("[test-crawlee-screenshot] ERROR: Screenshot file too small, likely invalid");
    process.exit(1);
  }

  // PNG header magic bytes: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    console.log("[test-crawlee-screenshot] PNG header valid: OK");
  } else {
    console.error("[test-crawlee-screenshot] ERROR: Not a valid PNG (bad magic bytes)");
    process.exit(1);
  }

  console.log("\n[test-crawlee-screenshot] All checks passed. Screenshot OK.");
})();
