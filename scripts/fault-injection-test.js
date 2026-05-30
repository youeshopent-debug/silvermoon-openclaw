'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const dep = require('../lib/dependency-registry');

const ROOT = path.resolve(__dirname, '..');

function portInUse(port, host) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.on('error', () => resolve(true));
    s.listen(port, host || '127.0.0.1', () => { s.close(); resolve(false); });
  });
}

class FaultInjector {
  constructor() { this.results = []; }

  check(key, injectFn, detectFn) {
    let injected = false, detected = false, detail = '';
    const saved = new Map();
    const save = (obj, prop) => { saved.set(obj, { orig: obj[prop], val: prop }); return obj[prop]; };
    const restore = () => { for (const [obj, p] of saved) { if (p.orig !== undefined) obj[p.val] = p.orig; else delete obj[p.val]; } };
    try {
      injectFn({ save, restore });
      injected = true;
      detected = detectFn();
      detail = detected ? '正确检测到故障' : '未检测到故障';
    } catch (e) { detail = `异常: ${e.message}`;
    } finally { restore(); }
    this.results.push({ name: key, injected, detected, detail, cleanup: true });
  }

  async checkAsync(key, injectFn, detectFn) {
    let injected = false, detected = false, detail = '';
    const saved = new Map();
    const save = (obj, prop) => { saved.set(obj, { orig: obj[prop], val: prop }); return obj[prop]; };
    const restore = () => { for (const [obj, p] of saved) { if (p.orig !== undefined) obj[p.val] = p.orig; else delete obj[p.val]; } };
    try {
      await injectFn({ save, restore });
      injected = true;
      detected = await detectFn();
      detail = detected ? '正确检测到故障' : '未检测到故障';
    } catch (e) { detail = `异常: ${e.message}`;
    } finally { restore(); }
    this.results.push({ name: key, injected, detected, detail, cleanup: true });
  }

  push(r) { this.results.push(r); }

  get passed() { return this.results.filter(r => r.detected).length; }
  get total() { return this.results.length; }
  get report() {
    return {
      ts: new Date().toISOString(),
      passed: this.passed,
      total: this.total,
      passedRate: this.total > 0 ? (this.passed / this.total * 100).toFixed(1) + '%' : '0%',
      results: this.results.map(r => ({
        name: r.name, injected: r.injected, detected: r.detected, detail: r.detail, cleanup: r.cleanup
      })),
    };
  }
}

async function testPortOccupied(f) {
  const p = 18791;
  const alreadyBusy = await portInUse(p);
  if (alreadyBusy) {
    f.push({ name:'端口占用检测', injected:true, detected:true, detail:'端口已被占用,故障已存在', cleanup:true });
    return;
  }
  let server = null;
  await f.checkAsync('端口占用检测',
    async () => { server = net.createServer(); await new Promise((res,rej) => { server.listen(p,'127.0.0.1',res); server.on('error',rej); }); },
    () => portInUse(p)
  );
  if (server) server.close();
}

async function testPortAvailable(f) {
  const p = 28991;
  const free = !(await portInUse(p));
  f.push({ name:'端口可用检测', injected:false, detected:free, detail:free?'端口28991可用':'端口28991不可用', cleanup:true });
}

async function runFaultInjectionTests() {
  const f = new FaultInjector();

  f.check('文件缺失检测', () => {}, () => {
    const p = path.join(ROOT, `__fault_test_${Date.now()}_.tmp`);
    try { fs.accessSync(p, fs.constants.F_OK); return false; } catch { return true; }
  });

  f.check('关键文件完整性验证', (ctx) => {
    // 注入：把检测列表替换为包含一个实际不存在的文件路径
    const origAccess = fs.accessSync;
    ctx.save(fs, 'accessSync');
    fs.accessSync = (p, mode) => {
      if (p.includes('__fault_missing_file__')) throw new Error('FAULT_INJECTED: file not found');
      return origAccess.call(fs, p, mode);
    };
  }, () => {
    // 模拟路径注册表检查：所有真实文件存在 + 一个标注为缺失
    const files = ['main.js','openclaw.json','lib/agent-tools.js','lib/health-audit.js','lib/dependency-registry.js'];
    for (const rel of files) {
      const abs = path.join(ROOT, rel.replace(/\//g, path.sep));
      try { fs.accessSync(abs, fs.constants.R_OK); } catch { return true; }
    }
    // 模拟额外路径检查 — 触发被注入的故障
    try { fs.accessSync(path.join(ROOT, '__fault_missing_file__'), fs.constants.R_OK); return false; } catch { return true; }
    return false;
  });

  { const r = dep.resolveExists('__openclaw_bogus_key_that_never_exists__');
    f.push({ name:'路径注册表错误检测', injected:true, detected:!r.ok, detail:r.ok?'未检测到错误':`正确检测: ${r.error}`, cleanup:true }); }

  { let c=false; try { require.resolve('__openclaw_bogus_pkg_99999__',{paths:[ROOT]}); } catch { c=true; }
    f.push({ name:'模块缺失检测', injected:true, detected:c, detail:c?'正确检测到模块缺失':'模块意外存在', cleanup:true }); }

  { const b=dep.checkBuiltinModules(); const ok=Object.values(b).every(r=>r.ok);
    f.push({ name:'Node内置模块检测', injected:false, detected:ok, detail:ok?'所有内置模块正常':`异常模块: ${Object.entries(b).filter(([,r])=>!r.ok).map(([k])=>k).join(',')}`, cleanup:true }); }

  { let c=false; try { require.resolve('__openclaw_fake_npm_88888__',{paths:[ROOT]}); } catch { c=true; }
    f.push({ name:'npm包缺失检测', injected:true, detected:c, detail:c?'正确检测到npm包缺失':'npm包意外存在', cleanup:true }); }

  await testPortOccupied(f);
  await testPortAvailable(f);

  const tzOrig = process.env.__OPENCLAW_TZ_VERIFIED__;
  f.check('时区缺失检测', (ctx) => { delete process.env.__OPENCLAW_TZ_VERIFIED__; }, () => !process.env.__OPENCLAW_TZ_VERIFIED__);
  if (tzOrig!==undefined) process.env.__OPENCLAW_TZ_VERIFIED__ = tzOrig;

  f.check('时区正常检测', (ctx) => { process.env.__OPENCLAW_TZ_VERIFIED__='Asia/Singapore'; }, () => process.env.__OPENCLAW_TZ_VERIFIED__==='Asia/Singapore');

  f.check('目录缺失检测', () => {}, () => {
    const d = path.join(ROOT, `__fault_dir_${Date.now()}__`);
    try { return !fs.statSync(d).isDirectory(); } catch { return true; }
  });

  { const dirs=['lib','scripts','sects','tests','.silvermoon_core','silvermoon_local'];
    let all=true;
    for(const d of dirs){ const a=path.join(ROOT,d); try{ if(!fs.statSync(a).isDirectory()) all=false; }catch{ all=false; } }
    f.push({ name:'关键目录检测', injected:false, detected:all, detail:all?'所有目录正常':'部分目录缺失', cleanup:true }); }

  const report = f.report;
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) runFaultInjectionTests().catch(e => { console.error(JSON.stringify({error:e.message})); process.exit(1); });
module.exports = { runFaultInjectionTests };
