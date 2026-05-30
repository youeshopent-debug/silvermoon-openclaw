const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TTS_DIR = path.join(__dirname, '..', 'tmp', 'tg_tts');
fs.mkdirSync(TTS_DIR, { recursive: true });

// uvx 安装在用户 local bin 目录下
const UVX = 'C:\\Users\\User\\.local\\bin\\uvx.exe';

function runTTS(text, idx) {
  const out = path.join(TTS_DIR, `concurrent_${idx}.mp3`);
  return new Promise(resolve => {
    const proc = spawn(UVX, [
      'edge-tts', '--text', text,
      '--write-media', out,
      '--voice', 'zh-CN-XiaoxiaoNeural',
    ], { timeout: 20_000, windowsHide: true });
    const timer = setTimeout(() => {
      proc.kill();
      resolve(`${idx}: TIMEOUT`);
    }, 20_000);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      clearTimeout(timer);
      const size = fs.existsSync(out) ? fs.statSync(out).size : 0;
      resolve(`${idx}: exit=${code} size=${size} stderr=${stderr.trim().slice(0, 200)}`);
    });
    proc.on('error', e => {
      clearTimeout(timer);
      resolve(`${idx}: error=${e.message}`);
    });
  });
}

async function main() {
  const texts = [
    '并发测试消息编号0，这是一条模拟压力测试',
    '并发测试消息编号1，检查多路TTS同时输出',
    '并发测试消息编号2，Edge TTS并行稳定性验证',
  ];
  console.log(`[${new Date().toISOString()}] 并发测试启动，3路并发的TTS请求...`);
  const results = await Promise.all(texts.map((t, i) => runTTS(t, i)));
  results.forEach(r => console.log(r));
  console.log(`[${new Date().toISOString()}] 并发测试完成`);
}

main().catch(e => console.error(e));
