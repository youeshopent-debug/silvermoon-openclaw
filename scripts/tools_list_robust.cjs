// 稳健版 tools/list — 自动处理 bridge 重启/断连
const http = require('http');
const BASE = 'http://127.0.0.1:12306';

function uid() { return require('crypto').randomUUID(); }

function httpPost(url, body, sessionId) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(data),
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        const sid = res.headers['mcp-session-id'] || null;
        try {
          resolve({ status: res.statusCode, sessionId: sid, body: JSON.parse(buf) });
        } catch {
          resolve({ status: res.statusCode, sessionId: sid, body: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); }).on('error', reject);
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForBridge(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await httpGet(BASE + '/ping');
      if (res.includes('pong')) return true;
    } catch {}
    await wait(800);
  }
  throw new Error('Bridge did not come back within ' + timeoutMs + 'ms');
}

async function main() {
  console.log('=== Step 0: 等待 bridge 就绪 ===');
  await waitForBridge();
  console.log('bridge 就绪');

  let sid = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`\n=== 尝试 #${attempt} ===`);

    // Step 1: initialize
    console.log('  [1/3] initialize...');
    const r1 = await httpPost(BASE + '/mcp', {
      jsonrpc: '2.0', id: uid(), method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'silvermoon', version: '1.0.0' } },
    });

    if (r1.status !== 200) {
      console.log(`  ⚠️  initialize 失败 (${r1.status}), 等待 bridge...`);
      await waitForBridge();
      continue;
    }

    sid = r1.sessionId;
    console.log(`  ✅  sessionId: ${sid}`);
    if (r1.body?.result) {
      console.log(`  Server: ${r1.body.result.serverInfo?.name} v${r1.body.result.serverInfo?.version}`);
    }

    await wait(500);

    // Step 2: tools/list (跳过 notifications/initialized — 通知会崩 bridge)
    console.log('  [2/2] tools/list...');
    let r2;
    try {
      r2 = await httpPost(BASE + '/mcp', { jsonrpc: '2.0', id: uid(), method: 'tools/list', params: {} }, sid);
    } catch (e) {
      console.log(`  ⚠️  bridge 断连: ${e.message}, 等待重启...`);
      await waitForBridge();
      continue;
    }

    console.log(`  status: ${r2.status}`);

    if (r2.body?.result) {
      const tools = r2.body.result.tools || [];
      console.log(`\n✅ 成功！共 ${tools.length} 个工具:`);
      tools.forEach((t, i) => {
        console.log(`  [${i}] ${t.name}`);
        console.log(`      描述: ${t.description || '(无)'}`);
        if (t.inputSchema?.properties) {
          const props = Object.keys(t.inputSchema.properties);
          console.log(`      参数: ${props.join(', ') || '(无)'}`);
        }
        console.log('');
      });
      return;
    }

    if (r2.body?.error) {
      console.log(`  ⚠️  RPC Error: ${r2.body.error.message}`);
    }

    await wait(1000);
  }

  console.error('\n❌ 所有重试均失败');
  process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
