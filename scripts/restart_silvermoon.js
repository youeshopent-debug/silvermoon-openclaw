const { execSync, spawn } = require('child_process');
const path = require('path');
const http = require('http');

// 找 main.js 的 PID，只杀它，不自杀
try {
  const pids = execSync(
    `powershell -Command "Get-WmiObject Win32_Process -Filter {Name='node.exe' AND CommandLine LIKE '%main.js%'} | Select-Object -ExpandProperty ProcessId"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  ).trim();
  if (pids) {
    pids.split('\n').filter(Boolean).forEach(pid => {
      try { execSync(`taskkill /f /pid ${pid.trim()}`, { stdio: 'pipe' }); } catch {}
    });
    console.log('已清理旧 main.js 进程');
  } else {
    console.log('无运行中的 main.js');
  }
} catch (e) {
  console.log('扫描 main.js 进程时:', e.message);
}

// 等一秒确保端口释放
setTimeout(() => {
  const child = spawn('node', ['main.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    detached: false,
  });
  console.log('银月已启动，PID:', child.pid);

  // 等 5 秒检查是否上线
  setTimeout(() => {
    http.get('http://127.0.0.1:18791/health', (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => console.log('银月状态:', d));
    }).on('error', (e) => console.log('银月仍未上线:', e.message));
  }, 5000);
}, 1000);
