// 检测 Chrome CDP 是否可连接
const chrome = require('./lib/chrome-cdp-bridge');

(async () => {
  try {
    // Step 1: 检测端口 9222 是否开放
    const http = require('http');
    const jsonUrl = 'http://127.0.0.1:9222/json';
    
    await new Promise((resolve, reject) => {
      const req = http.get(jsonUrl, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try {
            const targets = JSON.parse(data);
            console.log('=== Chrome CDP 连接成功 ===');
            console.log(`打开的标签页数: ${targets.length}`);
            targets.forEach((t, i) => {
              console.log(`  [${i}] ${t.title?.substring(0, 60) || '(无标题)'} — ${t.url?.substring(0, 80) || '(无URL)'}`);
            });
            
            // 查找 flashshow 标签
            const flashshow = targets.find(t => t.url?.includes('shanjian.tv') || t.title?.includes('闪剪'));
            if (flashshow) {
              console.log(`\n✅ 闪剪标签页已找到:`);
              console.log(`   标题: ${flashshow.title}`);
              console.log(`   URL: ${flashshow.url}`);
            } else {
              console.log(`\n⚠️ 未找到闪剪标签页，可能需要手动导航`);
            }
            resolve();
          } catch (e) {
            reject(new Error('JSON解析失败: ' + e.message));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('连接超时')); });
    });
    
    // Step 2: 尝试用 puppeteer 连接
    console.log('\n正在尝试 puppeteer 连接...');
    await chrome.connect();
    const info = await chrome.getPageInfo();
    console.log(`当前标签: ${info.title}`);
    console.log(`URL: ${info.url}`);
    
    const tabs = await chrome.listTabs();
    const flashTab = tabs.find(t => t.url?.includes('shanjian.tv'));
    if (flashTab) {
      console.log(`\n✅ 闪剪标签页索引: ${flashTab.index}`);
      await chrome.switchTab(flashTab.index);
      const fi = await chrome.getPageInfo();
      console.log(`已切换至闪剪: ${fi.title}`);
      
      // 截图确认
      const shot = await chrome.screenshot('flashshow_check');
      console.log(`截图成功: ${shot.buffer.length} bytes`);
    } else {
      console.log('\n⚠️ 未找到闪剪标签，列出所有标签:');
      tabs.forEach((t, i) => console.log(`  [${i}] ${t.title} | ${t.url.substring(0, 60)}`));
    }
    
    await chrome.disconnect();
    console.log('\n✅ 测试完成，Chrome 可正常操控');
    process.exit(0);
  } catch (e) {
    console.error('\n❌ Chrome CDP 连接失败:');
    console.error(`   错误: ${e.message}`);
    console.error('\n可能原因:');
    console.error('  1. Chrome 未以调试模式启动 (缺少 --remote-debugging-port=9222)');
    console.error('  2. 端口 9222 被其他程序占用');
    console.error('  3. Chrome 已关闭');
    console.error('\n解决方案:');
    console.error('  运行 start_chrome_debug.cmd 启动调试 Chrome');
    process.exit(1);
  }
})();
