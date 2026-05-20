const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  // Create an HTML page that shows the image
  await page.setContent(`<html><body style="margin:0;background:#000;">
    <img id="img" style="max-width:1400px;" crossorigin="anonymous" 
      src="https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/3d2e4cbf5bbe46a9bc127f6ac2545e5b~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1784360151&x-signature=xyEpz%2FZncOeHxxtO5ILGf4sJpxU%3D" />
    <p id="info" style="color:white;font-family:sans-serif">Loading...</p>
  </body></html>`);
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const img = document.getElementById('img');
    return {
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
      loaded: img.complete && img.naturalWidth > 0,
      displayW: img.offsetWidth,
      displayH: img.offsetHeight,
    };
  });
  console.log('IMAGE_INFO:', JSON.stringify(info));
  await page.screenshot({ path: 'C:/Users/User/.openclaw/tmp_img_preview.png' });
  console.log('SCREENSHOT_SAVED');
  await browser.close();
})();
