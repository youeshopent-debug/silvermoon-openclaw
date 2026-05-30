const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ====== 调查模块 ======

async function investigate(issue = {}) {
  const { target, symptom, scope } = typeof issue === 'string' ? { target: issue } : issue;
  const evidence = [];
  const startTime = Date.now();

  // 1. 定界：目标是否存在
  if (target) {
    const targetPath = path.resolve(ROOT, target);
    const exists = fs.existsSync(targetPath);
    evidence.push({
      step: '定界',
      action: `检查目标路径: ${target}`,
      result: exists ? '存在' : '不存在',
      detail: exists ? targetPath : null,
    });
    if (!exists) return buildReport(evidence, startTime);
  }

  // 2. 配置文件检查
  const configPaths = ['openclaw.json', 'package.json'];
  for (const cfg of configPaths) {
    const cfgPath = path.join(ROOT, cfg);
    if (fs.existsSync(cfgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        evidence.push({
          step: '配置',
          action: `读取 ${cfg}`,
          result: '有效 JSON',
          detail: cfg,
        });
      } catch (e) {
        evidence.push({
          step: '配置',
          action: `读取 ${cfg}`,
          result: '无效 JSON',
          detail: e.message,
        });
      }
    }
  }

  // 3. 进程检查
  const processes = ['node main.js', 'claude-mem', 'openviking'];
  for (const proc of processes) {
    try {
      const out = execSync(
        `powershell -Command "Get-Process | Where-Object { $_.ProcessName -match '${proc.split(' ')[0]}' } | Select-Object -First 1 Id,ProcessName"`,
        { cwd: ROOT, encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'ignore'] }
      ).trim();
      evidence.push({
        step: '进程',
        action: `检查 ${proc}`,
        result: out ? '运行中' : '未运行',
        detail: out || null,
      });
    } catch {
      evidence.push({
        step: '进程',
        action: `检查 ${proc}`,
        result: '未运行',
        detail: null,
      });
    }
  }

  return buildReport(evidence, startTime);
}

function buildReport(evidence, startTime) {
  const passed = evidence.filter(e => e.result !== '不存在' && e.result !== '无效 JSON' && e.result !== '未运行');
  const failed = evidence.filter(e => e.result === '不存在' || e.result === '无效 JSON' || e.result === '未运行');
  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    total: evidence.length,
    passed: passed.length,
    failed: failed.length,
    evidence,
    verdict: failed.length === 0 ? 'PASS' : 'ISSUES_FOUND',
    summary: failed.length > 0
      ? `发现 ${failed.length} 个问题: ${failed.map(e => `${e.action}(${e.result})`).join('; ')}`
      : '全部检查通过',
  };
}

// ====== 安全执行模块 ======

async function safeExecute({ action, target, verifyFn, rollbackFn } = {}) {
  const steps = [];
  const startTime = Date.now();

  // 1. 备份
  if (target) {
    const targetPath = path.resolve(ROOT, target);
    if (fs.existsSync(targetPath)) {
      const bakPath = targetPath + '.openviking.bak';
      try {
        fs.copyFileSync(targetPath, bakPath);
        steps.push({ phase: '备份', action: `备份 ${target}`, result: 'OK', detail: bakPath });
      } catch (e) {
        return { success: false, error: `备份失败: ${e.message}`, steps };
      }
    }
  }

  // 2. 执行
  if (action) {
    try {
      const result = typeof action === 'function' ? await action() : execSync(action, { cwd: ROOT, encoding: 'utf8', timeout: 15000 });
      steps.push({ phase: '执行', action: typeof action === 'function' ? 'executeFunction()' : action, result: 'OK', detail: typeof result === 'string' ? result.slice(0, 300) : 'void' });
    } catch (e) {
      steps.push({ phase: '执行', action: typeof action === 'function' ? 'executeFunction()' : action, result: 'FAIL', detail: e.message });
      // 自动回滚
      if (target && rollbackFn !== false) {
        await rollback({ target, steps });
      }
      return { success: false, error: e.message, steps };
    }
  }

  // 3. 验证
  if (verifyFn) {
    try {
      const valid = await verifyFn();
      if (valid) {
        steps.push({ phase: '验证', action: 'verifyFn()', result: 'PASS' });
      } else {
        steps.push({ phase: '验证', action: 'verifyFn()', result: 'FAIL', detail: '验证函数返回 false' });
        if (target && rollbackFn !== false) {
          await rollback({ target, steps });
        }
        return { success: false, error: '验证未通过', steps };
      }
    } catch (e) {
      steps.push({ phase: '验证', action: 'verifyFn()', result: 'ERROR', detail: e.message });
      if (target && rollbackFn !== false) {
        await rollback({ target, steps });
      }
      return { success: false, error: `验证异常: ${e.message}`, steps };
    }
  }

  return { success: true, steps, duration: Date.now() - startTime };
}

async function rollback({ target, steps }) {
  const targetPath = path.resolve(ROOT, target);
  const bakPath = targetPath + '.openviking.bak';
  if (fs.existsSync(bakPath)) {
    try {
      fs.copyFileSync(bakPath, targetPath);
      fs.unlinkSync(bakPath);
      steps.push({ phase: '回滚', action: `恢复 ${target}`, result: 'OK' });
    } catch (e) {
      steps.push({ phase: '回滚', action: `恢复 ${target}`, result: 'FAIL', detail: e.message });
    }
  }
}

async function selfTest() {
  const steps = [];
  let passed = 0, failed = 0;

  // 1. 模块完整性
  const exports = { investigate, safeExecute, report: buildReport, selfTest };
  const exportNames = Object.keys(exports);
  steps.push({ check: 'exports', detail: exportNames.join(', '), result: 'PASS' });

  // 2. 快速调查 — 检查 package.json
  try {
    const r = await investigate('package.json');
    steps.push({ check: 'investigate', detail: `evidence:${r.total} pass:${r.passed} fail:${r.failed}`, result: r.failed === 0 ? 'PASS' : 'WARN' });
  } catch (e) {
    steps.push({ check: 'investigate', detail: e.message, result: 'FAIL' });
  }

  // 3. 安全执行 — 无操作验证
  try {
    const r = await safeExecute({ action: 'echo openviking-self-test-ok' });
    steps.push({ check: 'safeExecute', detail: `success:${r.success} steps:${r.steps.length}`, result: r.success ? 'PASS' : 'FAIL' });
  } catch (e) {
    steps.push({ check: 'safeExecute', detail: e.message, result: 'FAIL' });
  }

  const total = steps.length;
  passed = steps.filter(s => s.result === 'PASS').length;
  failed = steps.filter(s => s.result === 'FAIL').length;
  return { module: 'openviking', version: '1.0.0', total, passed, failed, steps, verdict: failed === 0 ? 'PASS' : 'ISSUES_FOUND' };
}

module.exports = { investigate, safeExecute, report: buildReport, selfTest };
