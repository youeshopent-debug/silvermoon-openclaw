const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.goto('http://localhost:4312/cultivation.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  
  // Analyze the canvas content
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Try WebGL - fallback
    const gl = canvas.getContext('webgl');
    return {
      width: canvas.width,
      height: canvas.height,
      hasWebGL: !!gl,
      canvasInDOM: document.body.contains(canvas),
      phaserGame: !!window.game
    };
  });
  console.log('CANVAS_INFO:', JSON.stringify(canvasInfo));
  
  // Check DOM elements
  const domInfo = await page.evaluate(() => {
    return {
      elements: document.querySelectorAll('*').length,
      gameWrap: document.getElementById('game-wrap') ? true : false,
      loadingScreen: document.getElementById('loading-screen') ? true : false,
      controlPanel: document.querySelector('.control-panel') || document.querySelector('#control-panel') ? true : false,
      phaserCanvas: document.querySelector('canvas') ? true : false,
    };
  });
  console.log('DOM_INFO:', JSON.stringify(domInfo));
  
  await page.screenshot({ path: 'C:/Users/User/.openclaw/tmp_scene.png', fullPage: true });
  console.log('SCREENSHOT_SAVED');
  await browser.close();
})();
