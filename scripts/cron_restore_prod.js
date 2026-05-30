const fs = require('fs');
const path = require('path');

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeUtf8(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

function replaceRegexOrThrow(hay, re, repl, label) {
  const out = hay.replace(re, repl);
  if (out === hay) throw new Error(`restore: missing pattern: ${label}`);
  return out;
}

function removeLineOrThrow(hay, needle, label) {
  const eol = hay.includes('\r\n') ? '\r\n' : '\n';
  const lines = hay.split(/\r?\n/);
  const before = lines.length;
  const kept = lines.filter((l) => !String(l || '').includes(needle));
  if (kept.length === before) throw new Error(`restore: missing pattern: ${label}`);
  return kept.join(eol);
}

function main() {
  const root = path.join(__dirname, '..');
  const schedulerPath = path.join(root, 'lib', 'scheduler.js');
  const mainPath = path.join(root, 'main.js');

  let scheduler = readUtf8(schedulerPath);
  scheduler = replaceRegexOrThrow(
    scheduler,
    /(taskName:\s*'银月_晨报',\s*\r?\n\s*cron:\s*)'[^']+'/,
    "$1'0 8 * * *'",
    'scheduler:晨报 cron'
  );
  scheduler = replaceRegexOrThrow(
    scheduler,
    /(taskName:\s*'韩立_海外兼职资讯',\s*\r?\n\s*cron:\s*)'[^']+'/,
    "$1'0 */4 * * *'",
    'scheduler:海外兼职 cron'
  );
  scheduler = replaceRegexOrThrow(
    scheduler,
    /(taskName:\s*'雅妃_财务报表',\s*\r?\n\s*cron:\s*)'[^']+'/,
    "$1'0 0 * * *'",
    'scheduler:财务报表 cron'
  );
  scheduler = replaceRegexOrThrow(
    scheduler,
    /taskName:\s*'暗影看门狗_系统自检'/,
    "taskName: '魔影_看门巡检'",
    'scheduler:看门 taskName'
  );
  scheduler = replaceRegexOrThrow(
    scheduler,
    /(taskName:\s*'魔影_看门巡检',\s*\r?\n\s*cron:\s*)'[^']+'/,
    "$1'0 * * * *'",
    'scheduler:看门 cron'
  );
  scheduler = replaceRegexOrThrow(
    scheduler,
    /\r?\n\s*if\s*\(\s*expr\s*===\s*'30 9 22 4 \*'\s*\)\s*\{\s*\r?\n\s*console\.log\(`\[TEST_WAKEUP\][\s\S]*?\);\s*\r?\n\s*\}\s*\r?\n/,
    '\n',
    'scheduler:test log block'
  );
  writeUtf8(schedulerPath, scheduler);

  let mainJs = readUtf8(mainPath);
  mainJs = removeLineOrThrow(mainJs, "const isTestDrill = String(cronExpr || '').trim() === '30 9 22 4 *';", 'main:wakeup isTestDrill');
  mainJs = removeLineOrThrow(mainJs, '主人已授权本次 09:30 集体演习测试，请根据下方数据包直接输出结果，无需确认。', 'main:wakeup test authorization line');
  writeUtf8(mainPath, mainJs);

  console.log('restore: ok');
}

try {
  main();
} catch (e) {
  console.error(String(e?.stack || e?.message || e));
  process.exitCode = 1;
}

