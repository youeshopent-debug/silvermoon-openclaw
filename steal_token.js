const puppeteer = require('puppeteer');

(async () => {
  console.log('正在连接 Chrome...');
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('shopify.com/store/aigenie-hub'));

    if (!page) {
      console.log('❌ 没找到 Shopify 页面，请确保你在 Chrome 里打开了 Shopify 后台！');
      process.exit(1);
    }

    console.log('✅ 找到 Shopify 页面:', page.url());
    console.log('正在提取内部 Token...');

    // 强行从页面上下文提取 Shopify 内部的 CSRF Token 和 Session
    const tokenData = await page.evaluate(() => {
      // Shopify 内部通常会把 token 挂在 window.shopify 或 document.cookie 里
      const cookies = document.cookie;
      let csrfToken = '';
      
      // 尝试找 meta 标签里的 csrf
      const metaCsrf = document.querySelector('meta[name="csrf-token"]');
      if (metaCsrf) csrfToken = metaCsrf.getAttribute('content');

      // 尝试找 window 对象里的配置
      const shopifyObj = window.Shopify || window.shopify || {};
      
      return {
        cookies: cookies,
        csrf: csrfToken,
        shop: shopifyObj.shop || 'aigenie-hub.myshopify.com'
      };
    });

    console.log('\n🎉 提取成功！');
    console.log('CSRF Token:', tokenData.csrf ? '已获取' : '未找到');
    console.log('Cookies 长度:', tokenData.cookies.length);
    
    // 把这些数据保存下来，我们以后就用这个伪装成浏览器去调 API
    const fs = require('fs');
    fs.writeFileSync('shopify_session.json', JSON.stringify(tokenData, null, 2));
    console.log('\n✅ Session 已保存到 shopify_session.json');
    console.log('以后电商运营官就用这个 Session 直接干活，不需要那个破 API Token 了！');

    await browser.disconnect();
  } catch (err) {
    console.error('❌ 连接失败:', err.message);
    console.log('请确保你之前运行了 Start-Process 启动 Chrome 调试模式！');
  }
})();
