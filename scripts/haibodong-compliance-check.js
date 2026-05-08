const fs = require('fs');
const path = require('path');
const shared = require('./pipeline-shared');

const PROHIBITED_KEYWORDS = [
  'weapon', 'gun', 'ammo', 'knife', 'drug', 'cannabis', 'cbd', 'vape',
  'gambling', 'casino', 'poker', 'lottery', 'counterfeit', 'replica',
  'hack', 'crack', 'cheat', 'exploit', 'malware', 'ransomware',
  'nft', 'crypto', 'defi', 'token', 'shitcoin', 'pump and dump'
];

// 安全上下文白名单：关键词 + 同行上下文词 → 降级为 info
const SAFE_CONTEXT_EXCEPTIONS = {
  'gambling': /\b(study|research|university|cambridge|academic|survey)\b/i,
  'token': /\b(SSE|resumable|cancellable|multi.device|OAuth|JWT|session|API.key|streaming|LLM)\b/i,
  'hack': /\b(CVE|vulnerability|patch|disclosure|LPE|privilege\.escalation|Hacker\s*News|ProductivityHacks?|IndieHacker)\b/i,
  'crack': /\b(cracking|crackme|password.recovery)\b/i,
  'cheat': /\b(cheat.sheet|game.mechanic|anti.cheat)\b/i,
};

const HIGH_RISK_CATEGORIES = [
  'health supplement', 'weight loss', 'medical device',
  'financial service', 'investment', 'trading signal',
  'adult content', 'dating', 'escort'
];

const TM_BRANDS = [
  'apple', 'google', 'microsoft', 'amazon', 'meta', 'tesla',
  'openai', 'anthropic', 'nvidia', 'intel', 'amd', 'samsung',
  'sony', 'nintendo', 'adidas', 'nike', 'gucci', 'louis vuitton',
  'disney', 'netflix', 'spotify', 'twitter', 'facebook', 'instagram'
];

function runCheck(reportText) {
  if (!reportText) return { status: 'skip', reason: '无趋势报告可审计', issues: [] };
  const lines = reportText.split('\n');
  const lower = reportText.toLowerCase();
  const issues = [];

  // 逐行检查，应用安全上下文异常
  PROHIBITED_KEYWORDS.forEach(kw => {
    lines.forEach((line, idx) => {
      if (!line.toLowerCase().includes(kw)) return;
      const exception = SAFE_CONTEXT_EXCEPTIONS[kw];
      if (exception && exception.test(line)) {
        issues.push({ level: 'info', rule: '关键词(安全上下文)', match: kw, line: idx + 1 });
      } else {
        issues.push({ level: 'critical', rule: '禁止类关键词', match: kw, line: idx + 1 });
      }
    });
  });
  HIGH_RISK_CATEGORIES.forEach(cat => {
    if (lower.includes(cat)) issues.push({ level: 'warn', rule: '高风险类别', match: cat });
  });
  TM_BRANDS.forEach(brand => {
    const count = (lower.match(new RegExp(brand, 'g')) || []).length;
    if (count >= 3) issues.push({ level: 'info', rule: '商标品牌频繁提及', match: brand, count });
  });

  const criticalCount = issues.filter(i => i.level === 'critical').length;
  const warnCount = issues.filter(i => i.level === 'warn').length;
  const status = criticalCount > 0 ? 'fail' : warnCount > 2 ? 'warn' : 'pass';

  return { status, issues, criticalCount, warnCount, checkedAt: new Date().toISOString() };
}

function run({ dryRun = false } = {}) {
  const reportPath = shared.latestTrendReport();
  if (!reportPath) {
    const result = { ok: true, skipped: true, reason: '无趋势报告可审计' };
    shared.writeStageOutput('haibodong', result);
    return result;
  }

  const reportText = fs.readFileSync(reportPath, 'utf-8');
  const check = runCheck(reportText);

  const result = {
    ok: true, dryRun,
    reportPath,
    reportDate: shared.today(),
    compliance: check,
    stageOutput: shared.writeStageOutput('haibodong', { ...check, reportPath, reportDate: shared.today() })
  };

  if (!dryRun && check.status !== 'fail') {
    const trendLines = reportText.split('\n').filter(l => l.startsWith('##') || l.startsWith('1.')).slice(0, 8).join('\n');
    shared.writeDispatchEntry('小医仙', `【脚本生成任务】\n趋势报告：${reportPath}\n合规状态：${check.status}\n\n趋势摘要：\n${trendLines}\n\n请根据以上趋势生成今日 TikTok 短视频脚本，每个关键词产出 15-60 秒垂直分镜脚本。`, 'high', '海波东');
  }

  return result;
}

if (require.main === module) {
  const dryRun = !process.argv.includes('--live');
  const r = run({ dryRun });
  console.log(JSON.stringify(r, null, 2));
}

module.exports = { run, runCheck };
