const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.setContent(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh">
    <img id="img" crossorigin="anonymous" 
      src="https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/da858406fa244e5cbead29993a6cca0e~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1784360277&x-signature=Oyq1wLsuKrGKZgHjGahY9lR5YO8%3D" />
  </body></html>`);
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const img = document.getElementById('img');
    return {
      w: img.naturalWidth, h: img.naturalHeight, ratio: (img.naturalWidth/img.naturalHeight).toFixed(2),
      loaded: img.complete && img.naturalWidth > 0
    };
  });
  console.log('IMG2:', JSON.stringify(info));
  await page.screenshot({ path: 'C:/Users/User/.openclaw/tmp_img2_preview.png' });
  console.log('SCREENSHOT_SAVED');
  await browser.close();
})();
