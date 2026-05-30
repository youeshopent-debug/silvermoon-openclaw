// 银月钱庄 · LLM 链路调试脚本
// 直接测试 askHermes 的推理链，看卡在哪一步

const http = require('http');

// 1. 测试 Ollama 本地请求
function testOllama() {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const bodyData = JSON.stringify({
      model: 'gemma4:e4b',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });
    const req = http.request('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyData) },
      timeout: 10_000,
    }, (resp) => {
      let body = '';
      resp.on('data', (c) => body += c);
      resp.on('end', () => {
        if (resp.statusCode !== 200) return rej(new Error(`Ollama ${resp.statusCode}: ${body.slice(0,200)}`));
        try { const j = JSON.parse(body); res({ ok: true, ms: Date.now() - t0, content: (j.message?.content || '').slice(0, 100) }); } catch (e) { rej(e); }
      });
    });
    req.on('error', (e) => rej({ ok: false, ms: Date.now() - t0, error: e.code || e.message }));
    req.on('timeout', () => { req.destroy(); rej({ ok: false, ms: Date.now() - t0, error: 'timeout' }); });
    req.write(bodyData);
    req.end();
  });
}

// 2. 测试 Groq API
function testGroq() {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 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',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: ctrl.signal,
    }).then(r => r.json()).then(j => {
      clearTimeout(timer);
      res({ ok: true, ms: Date.now() - t0, content: (j.choices?.[0]?.message?.content || '').slice(0, 100) });
    }).catch(e => {
      clearTimeout(timer);
      rej({ ok: false, ms: Date.now() - t0, error: e.code || e.message });
    });
  });
}

// 3. 测试 Telegram API
function testTelegram() {
  return new Promise((res) => {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    fetch(`https://api.telegram.org/bot8627247747:AAHLCNrw2vIbEZme2zlXDlRr-OXJxPfWmEI/getMe`, {
      signal: ctrl.signal,
    }).then(r => r.json()).then(j => {
      clearTimeout(timer);
      res({ ok: true, ms: Date.now() - t0, data: j });
    }).catch(e => {
      clearTimeout(timer);
      res({ ok: false, ms: Date.now() - t0, error: e.code || e.message });
    });
  });
}

async function main() {
  console.log('=== 银月钱庄 LLM 链路调试 ===\n');

  // Step 1: Ollama
  console.log('[1/3] 测试 Ollama gemma4:e4b...');
  try {
    const r = await testOllama();
    console.log(`  ✅ ${r.ms}ms: ${r.content}`);
  } catch (e) {
    console.log(`  ❌ ${e.ms || '?'}ms: ${e.error || e}`);
  }

  // Step 2: Groq
  console.log('[2/3] 测试 Groq API...');
  try {
    const r = await testGroq();
    console.log(`  ✅ ${r.ms}ms: ${r.content}`);
  } catch (e) {
    console.log(`  ❌ ${e.ms || '?'}ms: ${e.error || e}`);
  }

  // Step 3: Telegram
  console.log('[3/3] 测试 Telegram API...');
  const r = await testTelegram();
  if (r.ok) {
    console.log(`  ✅ ${r.ms}ms: bot=${r.data?.result?.username} id=${r.data?.result?.id}`);
  } else {
    console.log(`  ❌ ${r.ms}ms: ${r.error}`);
  }

  console.log('\n=== 调试完成 ===');
}

main().catch(console.error);
