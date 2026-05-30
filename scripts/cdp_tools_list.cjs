// cdP 直连工具列表 + 浏览器操作
// 用法: node scripts/cdp_tools_list.cjs [command] [args...]
// 命令: list | info | eval "<js-code>" | screenshot | navigate <url>

const http = require('http');
const CDP = 'http://127.0.0.1:9222';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Parse failed: ' + data.slice(0,200))); }
      });
    }).on('error', reject);
  });
}

async function getTargets() {
  const version = await fetchJson(`${CDP}/json/version`);
  const tabs = await fetchJson(`${CDP}/json/list`);
  return { version, tabs };
}

async function main() {
  const cmd = process.argv[2] || 'list';
  const arg = process.argv[3] || '';

  try {
    switch (cmd) {
      case 'list': {
        const { version, tabs } = await getTargets();
        console.log('=== Chrome 版本 ===');
        console.log(`  Browser: ${version.Browser}`);
        console.log(`  User-Agent: ${version['User-Agent']}`);
        console.log('');
        console.log(`=== 标签页 (${tabs.length}个) ===`);
        tabs.forEach((t, i) => {
          console.log(`  [${i}] ${t.title || '(无标题)'}`);
          console.log(`       URL: ${t.url || '(空白页)'}`);
          console.log(`       ID: ${t.id}`);
          console.log('');
        });
        break;
      }
      case 'info': {
        const { version } = await getTargets();
        console.log(JSON.stringify(version, null, 2));
        break;
      }
      case 'eval': {
        const tabs = await fetchJson(`${CDP}/json/list`);
        const target = tabs[0];
        if (!target) { console.error('❌ 无可用标签页'); process.exit(1); }
        const wsUrl = target.webSocketDebuggerUrl;
        console.log(`目标标签: ${target.title}`);
        console.log(`执行 JS: ${arg}`);
        console.log('(CDP eval 需 WebSocket 连接，当前仅演示目标信息)');
        console.log(`WebSocket URL: ${wsUrl}`);
        break;
      }
      default:
        console.log(`未知命令: ${cmd}`);
        console.log('可用命令: list | info | eval "<code>"');
    }
  } catch (e) {
    console.error('❌ CDP 连接失败:', e.message);
    console.error('   请确认 Chrome 以 --remote-debugging-port=9222 启动');
    process.exit(1);
  }
}

main();
