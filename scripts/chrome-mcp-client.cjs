// chrome-mcp-client.cjs — OpenClaw 通过 mcp-chrome 操控已登录 Chrome
// 依赖：mcp-chrome-bridge 服务在 http://127.0.0.1:12306 运行中
//       需先在 Chrome 加载扩展并点击 "Connect"

const BRIDGE_URL = 'http://127.0.0.1:12306';

async function ping() {
  try {
    const res = await fetch(`${BRIDGE_URL}/ping`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

let _mcpSessionId = null;  // Streamable HTTP session ID, set after initialize

// MCP Streamable HTTP：发送 JSON-RPC 请求
async function mcpCall(method, params) {
  // 第一次调用任何 MCP 方法前先 initialize
  if (method === 'tools/list' || method.startsWith('chrome_') || method === 'get_windows_and_tabs' || method === 'search_tabs_content' || method === 'chrome_inject_script') {
    if (!_mcpSessionId) {
      const initBody = {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'chrome-mcp-client', version: '1.0.0' }
        }
      };
      const initRes = await fetch(`${BRIDGE_URL}/mcp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
        body: JSON.stringify(initBody), signal: AbortSignal.timeout(10000)
      });

      // 关键！Streamable HTTP 的 sessionId 在 response header mcp-session-id 中，不在 body
      _mcpSessionId = initRes.headers.get('mcp-session-id') || null;
      await initRes.json(); // drain body

      // 发 initialized notification
      const notiBody = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };
      await fetch(`${BRIDGE_URL}/mcp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
        body: JSON.stringify(notiBody), signal: AbortSignal.timeout(5000)
      });
    }
  }

  // 根据方法名选择 JSON-RPC 方法：tools/list 是标准方法，其他是 tools/call
  const isList = method === 'tools/list';
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: isList ? 'tools/list' : 'tools/call',
    params: isList ? {} : { name: method, arguments: params }
  };

  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (_mcpSessionId) headers['Mcp-Session-Id'] = _mcpSessionId;

  const res = await fetch(`${BRIDGE_URL}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const data = await res.json();
  if (data.error) throw new Error(`MCP error: ${data.error.message || JSON.stringify(data.error)}`);
  // Streamable HTTP 可能返回 result.content 数组
  if (data.result && data.result.content) {
    return data.result.content.map(c => c.text).join('\n');
  }
  return data.result || data;
}

// ============================================================
// 高频封装
// ============================================================

// 获取工具列表（测试 MCP 连接）
async function toolsList() {
  return mcpCall('tools/list', {});
}

// 导航到 URL
async function navigate(url) {
  return mcpCall('chrome_navigate', { url });
}

// 获取页面 HTML/文本内容
async function getContent() {
  return mcpCall('chrome_get_web_content', {});
}

// 页面截图（返回 base64）
async function screenshot({ selector, fullPage } = {}) {
  return mcpCall('chrome_screenshot', { selector, fullPage });
}

// 点击元素
async function click(selector) {
  return mcpCall('chrome_click_element', { selector });
}

// 填表单
async function fill(selector, value) {
  return mcpCall('chrome_fill_or_select', { selector, value });
}

// 获取窗口和标签页
async function listTabs() {
  return mcpCall('get_windows_and_tabs', {});
}

// 切换标签页
async function switchTab(tabId) {
  return mcpCall('chrome_switch_tab', { tabId });
}

// 关闭标签页
async function closeTabs(tabIds) {
  return mcpCall('chrome_close_tabs', { tabIds });
}

// 语义搜索标签页内容
async function searchTabs(query) {
  return mcpCall('search_tabs_content', { query });
}

// 模拟键盘输入
async function keyboard(text) {
  return mcpCall('chrome_keyboard', { text });
}

// 注入脚本到页面
async function injectScript(code) {
  return mcpCall('chrome_inject_script', { code });
}

// ============================================================
// 阿里系专用：搜索产品图片 URL
// ============================================================
async function searchAlibabaProductImages(keyword) {
  const url = `https://www.alibaba.com/products/${encodeURIComponent(keyword)}.html`;

  await navigate(url);
  await new Promise(r => setTimeout(r, 4000));

  // 提取页面中所有产品图片 URL
  const result = await injectScript(`
    (() => {
      const images = [];
      document.querySelectorAll('img[src*="alicdn"], .organic-gallery-inner img, [class*="product"] img, img[src*=".jpg"]').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || '';
        if (src && src.startsWith('http') && images.length < 50) {
          images.push(src.replace(/_[0-9]+x[0-9]+\.jpg/, '.jpg').replace(/_[0-9]+x[0-9]+\.png/, '.png'));
        }
      });
      return JSON.stringify(images);
    })()
  `);

  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

// ============================================================
// 1688 专用：搜索产品图片 URL
// ============================================================
async function search1688ProductImages(keyword) {
  const url = `https://www.1688.com/chanpin/${encodeURIComponent(keyword)}.html`;

  await navigate(url);
  await new Promise(r => setTimeout(r, 4000));

  const result = await injectScript(`
    (() => {
      const images = [];
      document.querySelectorAll('img[src*="alicdn"], .offer-list-item-img img, .sm-offer-list-item-img img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || '';
        if (src && src.startsWith('http') && images.length < 50) {
          images.push(src.replace(/_[0-9]+x[0-9]+\.jpg/, '.jpg').replace(/_[0-9]+x[0-9]+\.png/, '.png'));
        }
      });
      return JSON.stringify(images);
    })()
  `);

  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

// ============================================================
// CLI 入口
// ============================================================
if (process.argv[1] && (process.argv[1].endsWith('chrome-mcp-client.cjs') || process.argv[1].endsWith('chrome-mcp-client'))) {
  const cmd = process.argv[2];
  const arg = process.argv[3];

  (async () => {
    if (!await ping()) {
      console.error('❌ mcp-chrome 服务未运行');
      console.error('   请确保：');
      console.error('   1. Chrome 已打开，并加载了扩展');
      console.error('   2. 点击扩展图标 → Connect');
      console.error('   3. 服务会在 http://127.0.0.1:12306 监听');
      process.exit(1);
    }

    try {
      let result;
      switch (cmd) {
        case 'ping':
          result = '✅ mcp-chrome 服务运行正常';
          break;
        case 'tools-list':
          result = await toolsList();
          break;
        case 'tabs':
          result = await listTabs();
          break;
        case 'navigate':
          result = await navigate(arg);
          break;
        case 'screenshot':
          result = await screenshot();
          break;
        case 'content':
          result = await getContent();
          break;
        case 'click':
          result = await click(arg);
          break;
        case 'fill':
          result = await fill(arg, process.argv[4]);
          break;
        case 'search-tabs':
          result = await searchTabs(arg);
          break;
        case 'alibaba':
          result = await searchAlibabaProductImages(arg);
          break;
        case '1688':
          result = await search1688ProductImages(arg);
          break;
        default:
          console.error('用法: node chrome-mcp-client.cjs <命令> [参数]');
          console.error('命令: ping | tools-list | tabs | navigate <url> | screenshot | content | click <selector> | fill <selector> <value> | search-tabs <query> | alibaba <keyword> | 1688 <keyword>');
          process.exit(1);
      }
      console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } catch (err) {
      console.error('❌ 执行失败:', err.message);
      if (err.cause) console.error('   cause:', err.cause);
      if (err.code) console.error('   code:', err.code);
      if (err.type) console.error('   type:', err.type);
      console.error('   full:', JSON.stringify(Object.getOwnPropertyNames(err).reduce((o,k)=>(o[k]=err[k],o),{})));
      process.exit(1);
    }
  })();
}

module.exports = {
  ping, toolsList, navigate, getContent, screenshot, click, fill,
  listTabs, switchTab, closeTabs, searchTabs, keyboard, injectScript,
  searchAlibabaProductImages, search1688ProductImages, mcpCall
};
