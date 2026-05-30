'use strict';
const fs = require('fs');
const path = require('path');
const dep = require('../lib/dependency-registry');
const audit = require('../lib/health-audit');

const ROOT = path.resolve(__dirname, '..');

const SEVERITY = {
  PASS: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

const CRITICAL_FILES = [
  'main.js',
  'openclaw.json',
  'lib/agent-tools.js',
  'lib/tools.js',
  'lib/xiaoyan-crawler.js',
  'lib/crawlee-freelance.js',
  'lib/seo-search.js',
  'lib/prompt-builder.js',
  'lib/dependency-registry.js',
  'lib/health-audit.js',
  'lib/health-dashboard.js',
  'lib/cron.js',
  'lib/config.js',
  'lib/unified-logger.js',
  'lib/sanitizer.js',
  'lib/mailer.js',
  'scripts/startup-health-check.js',
  'scripts/run-tests.js',
  'scripts/pipeline-shared.js',
];

const DIRECTORIES = [
  'lib',
  'scripts',
  'sects',
  'tests',
  '.silvermoon_core',
  'silvermoon_local',
];

const CRITICAL_NPM_PACKAGES = [
  'crawlee',
  'playwright',
  'node-telegram-bot-api',
  'node-cron',
  'better-sqlite3',
  'nodemailer',
  'ws',
  'https-proxy-agent',
  'discord.js',
];

const results = [];

function record(name, severity, ok, detail) {
  results.push({ name, severity: SEVERITY[severity] ?? 0, ok, detail });
}

function check(condition, name, severity, detail) {
  record(name, condition ? 'PASS' : severity, condition, condition ? 'OK' : detail);
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  check(
    major >= 18,
    'Node版本检查',
    'CRITICAL',
    `当前Node.js v${process.version}，需 >= 18`
  );
  return major >= 18;
}

function checkFiles() {
  for (const relPath of CRITICAL_FILES) {
    const absPath = path.join(ROOT, relPath.replace(/\//g, path.sep));
    try {
      fs.accessSync(absPath, fs.constants.R_OK);
      record(`文件: ${relPath}`, SEVERITY.PASS, true, 'OK');
    } catch (e) {
      record(`文件: ${relPath}`, SEVERITY.CRITICAL, false, `不可读: ${e.message}`);
    }
  }
}

function checkDirectories() {
  for (const dir of DIRECTORIES) {
    const absPath = path.join(ROOT, dir);
    try {
      const stat = fs.statSync(absPath);
      check(stat.isDirectory(), `目录: ${dir}`, 'CRITICAL', `不是有效目录: ${absPath}`);
    } catch (e) {
      record(`目录: ${dir}`, SEVERITY.CRITICAL, false, `不存在: ${e.message}`);
    }
  }
}

function checkDependencyPaths() {
  const pathResults = dep.checkAllPaths();
  for (const [key, result] of Object.entries(pathResults)) {
    record(`路径: ${key}`, result.ok ? SEVERITY.PASS : SEVERITY.ERROR, result.ok,
      result.ok ? result.resolved : result.error);
  }
}

function checkNpmModules() {
  for (const pkg of CRITICAL_NPM_PACKAGES) {
    try {
      require.resolve(pkg, { paths: [ROOT] });
      record(`npm: ${pkg}`, SEVERITY.PASS, true, 'OK');
    } catch (e) {
      record(`npm: ${pkg}`, SEVERITY.ERROR, false, `未安装: ${e.message}`);
    }
  }
}

function checkTimeZone() {
  const tzVerified = process.env.__OPENCLAW_TZ_VERIFIED__;
  check(
    !!tzVerified,
    '时区验证',
    'WARN',
    tzVerified ? `已验证(tz=${tzVerified})` : '未设置 __OPENCLAW_TZ_VERIFIED__'
  );
}

function checkNodeBuiltins() {
  const builtins = dep.checkBuiltinModules();
  for (const [mod, result] of Object.entries(builtins)) {
    if (!result.ok) {
      record(`内置模块: ${mod}`, SEVERITY.ERROR, false, '解析失败');
    }
  }
}

function checkEnvironment() {
  const envVars = ['NODE_ENV', 'PATH', 'HOME', 'USERPROFILE', 'COMPUTERNAME'];
  for (const v of envVars) {
    const val = process.env[v];
    check(!!val, `环境变量: ${v}`, 'WARN', val ? `已设置` : `未设置`);
  }
}

function checkGatewayPort() {
  const port = 18791;
  try {
    const net = require('net');
    const server = net.createServer();
    server.listen(port, '127.0.0.1', () => {
      server.close();
      record(`网关端口: ${port}`, SEVERITY.PASS, true, '端口可用');
    });
    server.on('error', (err) => {
      record(`网关端口: ${port}`, SEVERITY.WARN, false, `端口被占用: ${err.message}`);
    });
  } catch (e) {
    record(`网关端口: ${port}`, SEVERITY.WARN, false, `检测失败: ${e.message}`);
  }
}

function generateReport(result) {
  const passedCount = result.results.filter(r => r.ok).length;
  const failedCount = result.results.filter(r => !r.ok).length;
  const bySeverity = {};
  for (const r of result.results) {
    const s = r.severity;
    bySeverity[s] = (bySeverity[s] || 0) + 1;
  }

  return {
    ts: new Date().toISOString(),
    nodeVersion: process.version,
    pid: process.pid,
    total: result.total,
    passed: passedCount,
    failed: failedCount,
    passedRate: result.total > 0 ? (passedCount / result.total * 100).toFixed(1) + '%' : '0%',
    maxSeverity: result.maxSeverity,
    severityDistribution: bySeverity,
    summary: result.passed ? '全部检查通过' : `${failedCount} 项异常待处理`,
  };
}

function run() {
  results.length = 0;

  checkNodeVersion();
  checkFiles();
  checkDirectories();
  checkDependencyPaths();
  checkNpmModules();
  checkTimeZone();
  checkNodeBuiltins();
  checkEnvironment();

  const maxSeverity = results.reduce((max, r) => r.severity > max ? r.severity : max, 0);
  const passed = maxSeverity < SEVERITY.ERROR;

  const result = {
    passed,
    maxSeverity,
    total: results.length,
    results: results.map(r => ({
      name: r.name,
      severity: Object.keys(SEVERITY).find(k => SEVERITY[k] === r.severity) || 'UNKNOWN',
      ok: r.ok,
      detail: r.detail,
    })),
  };

  const report = generateReport(result);

  // 记录到健康审计
  audit.recordHealthRun(result);

  // 输出汇总
  console.log(`\n[health-check] 启动自检完成 — ${report.passed}/${report.total} 通过 (severity=${report.maxSeverity})`);
  if (report.failed > 0) {
    for (const r of result.results) {
      if (!r.ok) {
        console.log(`  [${r.severity}] ${r.name} — ${r.detail}`);
      }
    }
  }

  return result;
}

module.exports = {
  run,
  checkNodeVersion,
  SEVERITY,
};
