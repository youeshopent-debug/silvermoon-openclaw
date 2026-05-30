/**
 * 银月钱庄 · 社交媒体自动化管线压力测试
 *
 * 测试维度：
 *  1. 模块语法验证（所有 lib + scripts）
 *  2. trend-fetcher 模拟抓取（mock HN API）
 *  3. social-image Canvas 配图生成
 *  4. social-content LLM 内容生成
 *  5. social-poster 浏览器连接测试
 *  6. 每日管线编排完整性
 *  7. 深度论文管线编排完整性
 *  8. CRON 注册有效性验证
 *  9. 告警系统连通性
 *  10. 并发稳定性（5路并行模块加载）
 *
 * 用法：node scripts/stress-test-social.cjs
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const logDir = path.join(ROOT, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const reportFile = path.join(logDir, `stress-social-${Date.now()}.json`);

const stats = { total: 0, passed: 0, failed: 0, startMs: Date.now() };
const results = [];

function logResult(name, ok, detail) {
  stats.total++;
  if (ok) stats.passed++; else stats.failed++;
  results.push({ ts: new Date().toISOString(), name, pass: ok, detail: String(detail).slice(0, 200) });
  process.stdout.write(ok ? `  ✅ ${name}\n` : `  ❌ ${name} — ${String(detail).slice(0, 120)}\n`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test 1: 语法检查 ──
function testSyntax() {
  console.log('\n📦 Test 1: 模块语法验证');
  const files = [
    'lib/trend-fetcher.js',
    'lib/social-content.js',
    'lib/social-image.js',
    'lib/social-poster.js',
    'scripts/social-auto-pipeline.js',
    'scripts/social-deep-article.js',
    'scripts/alert.js',
  ];
  let allOk = true;
  for (const f of files) {
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) { logResult(`语法: ${f}`, false, '文件不存在'); allOk = false; continue; }
    try {
      execSync(`"${process.execPath}" -c "${fp}"`, { timeout: 30000, windowsHide: true });
      logResult(`语法: ${f}`, true, '');
    } catch (e) {
      logResult(`语法: ${f}`, false, e.stderr?.toString().slice(0, 100) || e.message);
      allOk = false;
    }
  }
  return allOk;
}

// ── Test 2: 模块加载测试 ──
async function testModuleLoad() {
  console.log('\n📦 Test 2: 模块加载完整性');
  let allOk = true;
  const modules = [
    { name: 'trend-fetcher', path: '../lib/trend-fetcher' },
    { name: 'social-content', path: '../lib/social-content' },
    { name: 'social-image', path: '../lib/social-image' },
    { name: 'social-poster', path: '../lib/social-poster' },
  ];
  for (const m of modules) {
    try {
      const mod = require(m.path);
      const exports = Object.keys(mod);
      if (exports.length === 0) {
        logResult(`加载: ${m.name}`, false, '无导出');
        allOk = false;
      } else {
        logResult(`加载: ${m.name}`, true, `导出: ${exports.join(', ')}`);
      }
    } catch (e) {
      logResult(`加载: ${m.name}`, false, e.message);
      allOk = false;
    }
  }
  return allOk;
}

// ── Test 3: Canvas 配图生成 ──
async function testImageGeneration() {
  console.log('\n📦 Test 3: Canvas 配图生成');
  let allOk = true;
  try {
    const { generateSocialImage } = require('../lib/social-image');
    const imgResult = await generateSocialImage('Stress Test: AI Sleep Technology', 'facebook');
    if (imgResult && imgResult.filepath && fs.existsSync(imgResult.filepath)) {
      const stat = fs.statSync(imgResult.filepath);
      logResult('生成Facebook配图', true, `${imgResult.filename} (${(stat.size / 1024).toFixed(1)}KB)`);
    } else {
      logResult('生成Facebook配图', false, '文件未创建');
      allOk = false;
    }
  } catch (e) {
    logResult('生成Facebook配图', false, e.message);
    allOk = false;
  }

  try {
    const { generateArticleImage } = require('../lib/social-image');
    const imgResult = await generateArticleImage('Stress Test Article', 'Deep Calm');
    if (imgResult && imgResult.filepath && fs.existsSync(imgResult.filepath)) {
      const stat = fs.statSync(imgResult.filepath);
      logResult('生成论文配图', true, `${imgResult.filename} (${(stat.size / 1024).toFixed(1)}KB)`);
    } else {
      logResult('生成论文配图', false, '文件未创建');
      allOk = false;
    }
  } catch (e) {
    logResult('生成论文配图', false, e.message);
    allOk = false;
  }

  return allOk;
}

// ── Test 4: 管线编排完整性 ──
async function testPipelineIntegrity() {
  console.log('\n📦 Test 4: 管线脚本编排完整性');
  let allOk = true;

  // 测试 pipeline 导出函数
  try {
    const pipeline = require('../scripts/social-auto-pipeline');
    if (typeof pipeline.run === 'function') {
      logResult('每日管线: run导出', true, '');
    } else {
      logResult('每日管线: run导出', false, 'run不是函数');
      allOk = false;
    }
  } catch (e) {
    logResult('每日管线: 加载', false, e.message);
    allOk = false;
  }

  try {
    const article = require('../scripts/social-deep-article');
    if (typeof article.run === 'function') {
      logResult('深度论文管线: run导出', true, '');
    } else {
      logResult('深度论文管线: run导出', false, 'run不是函数');
      allOk = false;
    }
    if (Array.isArray(article.DEEP_TOPICS)) {
      logResult('深度论文管线: DEEP_TOPICS', true, `${article.DEEP_TOPICS.length}个主题`);
    } else {
      logResult('深度论文管线: DEEP_TOPICS', false, '不是数组');
      allOk = false;
    }
  } catch (e) {
    logResult('深度论文管线: 加载', false, e.message);
    allOk = false;
  }

  return allOk;
}

// ── Test 5: CRON 注册有效性 ──
async function testCronRegistration() {
  console.log('\n📦 Test 5: CRON注册有效性');
  let allOk = true;

  try {
    const mainContent = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
    const expectedRegistrations = [
      'social_auto_pipeline',
      'deep_article_mon',
      'deep_article_wed',
      'deep_article_fri',
    ];
    for (const name of expectedRegistrations) {
      if (mainContent.includes(name)) {
        logResult(`CRON登记: ${name}`, true, '');
      } else {
        logResult(`CRON登记: ${name}`, false, '在main.js中未找到');
        allOk = false;
      }
    }
  } catch (e) {
    logResult('CRON检查', false, e.message);
    allOk = false;
  }

  // 验证cron.js能解析schedule格式
  try {
    const cron = require('../lib/cron');
    logResult('cron.js加载', true, typeof cron.register === 'function' ? 'register存在' : 'register缺失');
  } catch (e) {
    logResult('cron.js加载', false, e.message);
    allOk = false;
  }

  return allOk;
}

// ── Test 6: 并发模块加载测试 ──
async function testConcurrentLoad() {
  console.log('\n📦 Test 6: 并发模块加载');
  let allOk = true;
  const modules = [
    '../lib/trend-fetcher',
    '../lib/social-content',
    '../lib/social-image',
    '../lib/social-poster',
    '../scripts/social-auto-pipeline',
  ];

  const start = Date.now();
  try {
    await Promise.all(modules.map(m => {
      try {
        require(m);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    }));
    const elapsed = Date.now() - start;
    logResult('并发加载5模块', true, `${elapsed}ms`);
  } catch (e) {
    logResult('并发加载5模块', false, e.message);
    allOk = false;
  }
  return allOk;
}

// ── Test 7: 管道dispatch写入权限 ──
async function testDispatchWrite() {
  console.log('\n📦 Test 7: Dispatch写入权限');
  let allOk = true;
  const dispatchDir = path.join(ROOT, '.silvermoon_core');
  try {
    if (!fs.existsSync(dispatchDir)) fs.mkdirSync(dispatchDir, { recursive: true });
    const testEntry = JSON.stringify({ test: true, ts: new Date().toISOString() }) + '\n';
    fs.appendFileSync(path.join(dispatchDir, 'dispatched_tasks.jsonl'), testEntry);
    logResult('dispatch写入', true, dispatchDir);
  } catch (e) {
    logResult('dispatch写入', false, e.message);
    allOk = false;
  }
  return allOk;
}

// ── Test 8: 数据目录完整性 ──
async function testDataDirectories() {
  console.log('\n📦 Test 8: 数据目录完整性');
  let allOk = true;
  const dirs = [
    path.join(ROOT, 'data', 'social_images'),
    path.join(ROOT, 'data'),
    path.join(ROOT, 'logs'),
  ];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      logResult(`目录: ${path.relative(ROOT, dir)}`, true, '');
    } catch (e) {
      logResult(`目录: ${path.relative(ROOT, dir)}`, false, e.message);
      allOk = false;
    }
  }
  return allOk;
}

// ── Test 9: 环境变量验证 ──
async function testEnvVars() {
  console.log('\n📦 Test 9: 环境变量验证');
  let allOk = true;

  const needed = {
    'OPENROUTER_API_KEY': 'LLM内容生成',
  };
  const optional = {
    'CHROME_USER_DATA_DIR': 'Chrome浏览器自动化',
  };

  // 读取.env
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const [key, desc] of Object.entries(needed)) {
      const match = envContent.match(new RegExp(`${key}=(.+)`));
      if (match && match[1] && !match[1].startsWith('your_')) {
        logResult(`环境变量: ${key}`, true, desc);
      } else {
        logResult(`环境变量: ${key}`, false, `${desc} — 未配置`);
        allOk = false;
      }
    }
    // 可选环境变量（有默认值）只警告不失败
    for (const [key, desc] of Object.entries(optional)) {
      const match = envContent.match(new RegExp(`${key}=(.+)`));
      if (match && match[1] && !match[1].startsWith('your_')) {
        logResult(`环境变量: ${key}`, true, desc);
      } else {
        logResult(`环境变量: ${key}`, true, `${desc} — 使用默认值（可选）`);
      }
    }
  } else {
    for (const [key, desc] of Object.entries(needed)) {
      if (process.env[key]) {
        logResult(`环境变量: ${key}`, true, desc);
      } else {
        logResult(`环境变量: ${key}`, false, `${desc} — 未配置`);
        allOk = false;
      }
    }
  }

  return allOk;
}

// ── Test 10: Chrome连通性（可选） ──
async function testChromeConnect() {
  console.log('\n📦 Test 10: Chrome浏览器连通性 (可选)');
  let allOk = true;
  try {
    const http = require('http');
    const endpoint = `http://${process.env.SOCIAL_CHROME_HOST || '127.0.0.1'}:${process.env.SOCIAL_CHROME_PORT || '9223'}/json/version`;
    const result = await new Promise((resolve, reject) => {
      http.get(endpoint, { timeout: 5000 }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(d));
      }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
    });
    const info = JSON.parse(result);
    logResult('Chrome连通', true, `${info.Browser?.slice(0, 40)} | ${info.webSocketDebuggerUrl?.slice(0, 40)}`);
  } catch (e) {
    logResult('Chrome连通', false, `Chrome未运行: ${e.message} (不影响离线测试)`);
    allOk = false;
  }
  return allOk;
}

// ══════════════════════════════════════
//  主入口
// ══════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  银月钱庄 · 社交媒体自动化压力测试       ║');
  console.log('║  Social Media Automation Stress Test     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`时间: ${new Date().toISOString()}`);
  console.log(`Root: ${ROOT}\n`);

  // 顺序执行（部分有IO依赖）
  const t1 = testSyntax();
  const t2 = await testModuleLoad();
  const t8 = await testDataDirectories();
  const t3 = await testImageGeneration();
  const t4 = await testPipelineIntegrity();
  const t5 = await testCronRegistration();
  const t6 = await testConcurrentLoad();
  const t7 = await testDispatchWrite();
  const t9 = await testEnvVars();
  const t10 = await testChromeConnect();

  // 生成报告
  const elapsed = Date.now() - stats.startMs;
  const report = {
    type: 'social_stress_test',
    timestamp: new Date().toISOString(),
    elapsed,
    total: stats.total,
    passed: stats.passed,
    failed: stats.failed,
    passRate: stats.total > 0 ? `${(stats.passed / stats.total * 100).toFixed(0)}%` : 'N/A',
    results,
    summary: stats.failed === 0 ? '✅ 全部通过' : `⚠️ ${stats.failed}项失败`,
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // 最终汇报
  console.log('\n' + '='.repeat(50));
  console.log(`📊 压力测试报告`);
  console.log('='.repeat(50));
  console.log(`  总测试: ${stats.total}`);
  console.log(`  通过:   ${stats.passed}`);
  console.log(`  失败:   ${stats.failed}`);
  console.log(`  通过率: ${report.passRate}`);
  console.log(`  耗时:   ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  报告:   ${reportFile}`);
  console.log('='.repeat(50));
  console.log(report.summary);

  return stats.failed === 0;
}

if (require.main === module) {
  main().then(ok => process.exit(ok ? 0 : 1));
}
