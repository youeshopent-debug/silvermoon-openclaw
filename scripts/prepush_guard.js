const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
}

function repoRoot() {
  try {
    const out = sh('git rev-parse --show-toplevel').trim();
    if (!out) throw new Error('empty');
    return out;
  } catch (e) {
    throw new Error('未检测到 git 仓库根目录');
  }
}

function listStagedFiles() {
  const out = sh('git diff --cached --name-only').trim();
  if (!out) return [];
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function listTrackedFiles() {
  const out = sh('git ls-files').trim();
  if (!out) return [];
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function isBinary(buf) {
  if (!buf || buf.length === 0) return false;
  let zeros = 0;
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i += 1) {
    if (buf[i] === 0) zeros += 1;
  }
  return zeros >= Math.floor(n / 20);
}

function fail(lines) {
  const msg = ['阻断推送：检测到敏感内容或敏感文件', ...lines].join('\n');
  process.stderr.write(msg + '\n');
  process.exit(1);
}

function main() {
  const root = repoRoot();
  const staged = listStagedFiles();
  const tracked = listTrackedFiles();

  const forbiddenPathRe = [
    /(^|\/)\.env(\.|$)/i,
    /(^|\/)user_data\//i,
    /(^|\/)workspace\/CASHCLAW\//i,
    /(^|\/)memory\//i,
    /(^|\/)flows\//i,
    /(^|\/)tasks\//i,
    /(^|\/)logs\//i,
    /(^|\/)id_rsa(\.pub)?$/i,
    /(^|\/)id_ed25519(\.pub)?$/i,
    /\.pem$/i,
    /\.key$/i,
    /\.sqlite(-wal|-shm)?$/i,
  ];

  const forbiddenTracked = tracked.filter((f) => forbiddenPathRe.some((re) => re.test(f)));
  if (forbiddenTracked.length > 0) {
    fail(forbiddenTracked.slice(0, 30).map((f) => `敏感文件已被 git 跟踪：${f}`));
  }

  const forbiddenStagedByPath = staged.filter((f) => forbiddenPathRe.some((re) => re.test(f)));
  if (forbiddenStagedByPath.length > 0) {
    fail(forbiddenStagedByPath.slice(0, 30).map((f) => `敏感文件进入暂存区：${f}`));
  }

  const forbiddenContentRe = [
    /BEGIN (RSA |EC |)PRIVATE KEY/i,
    /STRIPE_WEBHOOK_SECRET\s*=/i,
    /GROQ_API_KEY\s*=/i,
    /GEMINI_API_KEY\s*=/i,
    /DISCORD_TOKEN\s*=/i,
    /DROPBOX_TOKEN\s*=/i,
    /\bsk_live_[0-9a-zA-Z]+\b/i,
    /\bsk_test_[0-9a-zA-Z]+\b/i,
    /\bwhsec_[0-9a-zA-Z]+\b/i,
  ];

  const hitLines = [];
  for (const rel of staged) {
    const abs = path.join(root, rel);
    const buf = readFileSafe(abs);
    if (!buf) continue;
    if (isBinary(buf)) continue;
    const txt = buf.toString('utf8');
    for (const re of forbiddenContentRe) {
      if (re.test(txt)) {
        hitLines.push(`敏感内容命中：${rel}`);
        break;
      }
    }
    if (hitLines.length >= 30) break;
  }

  if (hitLines.length > 0) fail(hitLines);
}

main();
