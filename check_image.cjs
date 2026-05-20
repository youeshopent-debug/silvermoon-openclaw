const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const imgUrl = 'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/3d2e4cbf5bbe46a9bc127f6ac2545e5b~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1784360151&x-signature=xyEpz%2FZncOeHxxtO5ILGf4sJpxU%3D';
  // Check image dimensions
  const info = await page.evaluate(async (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height, loaded: true });
      img.onerror = () => resolve({ loaded: false, error: 'load failed' });
      img.src = url;
    });
  }, imgUrl);
  console.log('IMAGE_INFO:', JSON.stringify(info));
  await browser.close();
})();
