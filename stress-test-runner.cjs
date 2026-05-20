'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.OPENCLAW_LINK_PORT || 18791);
const BASE = `http://127.0.0.1:${PORT}`;
const RESULTS_DIR = path.join(__dirname, 'stress_test_results');
const LOG_FILE = path.join(RESULTS_DIR, `stress_report_${Date.now()}.log`);

let passed = 0, failed = 0, skipped = 0;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function hr(title) {
  log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

function jsonReq(method, pathname, body, timeout = 45000) {
  return new Promise(r => {
    const start = Date.now();
    const opts = { hostname: '127.0.0.1', port: PORT, path: pathname, method, timeout };
    if (body) opts.headers = { 'Content-Type': 'application/json' };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let data = null;
        try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch {}
        r({ status: res.statusCode, data, elapsed: Date.now() - start, ok: res.statusCode < 500 });
      });
    });
    req.on('error', e => r({ status: 0, ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); r({ status: 0, ok: false, error: 'timeout' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(label, cond, detail) {
  if (cond) { log(`  ✅ ${label}`); passed++; }
  else { log(`  ❌ ${label} — ${detail || ''}`); failed++; }
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkAlive() {
  const r = await jsonReq('POST', '/api/actions/health-check', {}, 5000);
  return r.ok;
}

async function scenario_1_concurrent() {
  hr('Scenario 1: 并发负载 (100× /api/stress-test → DeepSeek)');
  const rounds = [{ ok: 0, err: 0 }];
  for (let r = 0; r < 5; r++) {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => jsonReq('GET', '/api/stress-test'))
    );
    const ok = results.filter(x => x.ok).length;
    const err = results.filter(x => !x.ok).length;
    const avg = Math.round(results.reduce((s, x) => s + (x.elapsed || 0), 0) / results.length);
    const max = Math.max(...results.map(x => x.elapsed || 0));
    log(`  Round ${r + 1}: ${ok} ok, ${err} err, avg=${avg}ms, max=${max}ms`);
    rounds.push({ ok, err });
    if (r === 0) assert('Round 1: >60% success', ok >= 12, `ok=${ok}/20`);
    await wait(200);
  }
  assert('Server alive after 100 stress requests', await checkAlive());
}

async function scenario_2_memory() {
  hr('Scenario 2: 内存压力 (30 large payloads → stress-test)');
  let ok = 0;
  for (let i = 0; i < 30; i++) {
    const r = await jsonReq('POST', '/api/stress-test', {
      content: 'x'.repeat(Math.min(5000, 100 + i * 50)),
      channelId: 'mem_' + i,
    });
    if (r.ok) ok++;
  }
  assert('>50% success under memory pressure', ok >= 15, `ok=${ok}/30`);
  assert('Server survives memory pressure', await checkAlive());
}

async function scenario_3_health_heavy() {
  hr('Scenario 3: 健康探活高强度 (200× health-check rapid fire)');
  let ok = 0;
  const timings = [];
  for (let i = 0; i < 200; i++) {
    const r = await jsonReq('POST', '/api/actions/health-check', {}, 3000);
    if (r.ok) ok++;
    timings.push(r.elapsed || 0);
  }
  const avg = Math.round(timings.reduce((s, v) => s + v, 0) / timings.length);
  const max = Math.max(...timings);
  const min = Math.min(...timings);
  log(`  Results: ${ok}/200 ok, avg=${avg}ms, min=${min}ms, max=${max}ms`);
  assert('Health-check: >95% success', ok >= 190, `ok=${ok}/200`);
}

async function scenario_4_long_run() {
  hr('Scenario 4: 长稳负载 (50× health-check over 10s)');
  let ok = 0;
  const timings = [];
  for (let i = 0; i < 50; i++) {
    const r = await jsonReq('POST', '/api/actions/health-check', {}, 5000);
    if (r.ok) ok++;
    timings.push(r.elapsed || 0);
    await wait(200);
  }
  const avg = Math.round(timings.reduce((s, v) => s + v, 0) / timings.length);
  const max = Math.max(...timings);
  const p95 = timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)];
  log(`  Results: ${ok}/50 ok, avg=${avg}ms, max=${max}ms, p95=${p95}ms`);
  assert('Long-run: >90% success', ok >= 45, `ok=${ok}/50`);
  assert('Server responsive after long run', await checkAlive());
}

async function scenario_5_concurrent_health() {
  hr('Scenario 5: 健康探活并发 (50 concurrent×3 rounds)');
  for (let r = 0; r < 3; r++) {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => jsonReq('POST', '/api/actions/health-check', {}, 5000))
    );
    const ok = results.filter(x => x.ok).length;
    const avg = Math.round(results.reduce((s, x) => s + (x.elapsed || 0), 0) / results.length);
    const max = Math.max(...results.map(x => x.elapsed || 0));
    log(`  Round ${r + 1}: ${ok}/50 ok, avg=${avg}ms, max=${max}ms`);
    assert(`Concurrent health round ${r + 1}: >90%`, ok >= 45, `ok=${ok}/50`);
  }
}

async function main() {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  log(`银月钱庄 · 连接稳定性压力测试报告`);
  log(`Started: ${new Date().toISOString()}`);
  log(`Target: ${BASE}`);
  log('');

  const alive = await checkAlive();
  if (!alive) {
    log('❌ 服务器不在线');
    log('Troubleshooting:');
    log('  1. Ensure main.js is running: node main.js');
    log('  2. Check port: OPENCLAW_LINK_PORT (default 18791)');
    process.exit(1);
  }
  log(`✅ 服务器在线 (${BASE})\n`);

  await scenario_1_concurrent();
  await scenario_2_memory();
  await scenario_3_health_heavy();
  await scenario_4_long_run();
  await scenario_5_concurrent_health();

  hr('综合评分');
  log(`  ✅ 通过: ${passed}`);
  log(`  ❌ 失败: ${failed}`);
  log(`  ⚠️  跳过: ${skipped}`);
  log(`  评分: ${failed === 0 ? 'PASS 🎉' : 'FAIL — 需审查'}`);
  log(`  报告: ${LOG_FILE}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  log(`FATAL: ${e.stack || e.message || e}`);
  process.exit(1);
});
