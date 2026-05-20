const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.goto('http://localhost:4312/cultivation.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  // Sample colors across the canvas to understand the scene
  const analysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl');
    // Can't read pixels from WebGL directly in this context
    // Let's check the scene visually through DOM
    const scene = window.game ? 'has game ref' : 'no game ref';
    
    // Check what's rendered by looking at the canvas
    return {
      scene,
      canvasW: canvas.width,
      canvasH: canvas.height,
      // Check CSS styles
      loadingHidden: document.getElementById('loading-screen')?.classList.contains('hidden'),
      gameWrapStyle: document.getElementById('game-wrap')?.style.cssText || 'none',
    };
  });
  console.log('ANALYSIS:', JSON.stringify(analysis));
  
  // Also take a detailed DOM snapshot
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    // Create a fallback 2D context to read pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1280;
    tempCanvas.height = 720;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    
    // Sample colors at key positions
    const samples = {};
    const positions = [
      { name: 'top-left', x: 10, y: 10 },
      { name: 'top-center', x: 640, y: 10 },
      { name: 'center', x: 640, y: 360 },
      { name: 'bottom-center', x: 640, y: 700 },
      { name: 'mountains', x: 640, y: 200 },
      { name: 'floor-center', x: 640, y: 500 },
      { name: 'left-area', x: 300, y: 450 },
      { name: 'right-area', x: 980, y: 450 },
      { name: 'star-pos', x: 640, y: 400 },
    ];
    
    for (const pos of positions) {
      const [r, g, b, a] = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      samples[pos.name] = `rgba(${r},${g},${b},${a/255})`;
    }
    
    // Count dark vs bright pixels
    const allData = ctx.getImageData(0, 0, 100, 100).data;
    let darkCount = 0, brightCount = 0;
    for (let i = 0; i < allData.length; i += 4) {
      const brightness = (allData[i] + allData[i+1] + allData[i+2]) / 3;
      if (brightness < 50) darkCount++;
      else if (brightness > 200) brightCount++;
    }
    
    // Check the characters/agents area by looking for non-background pixels
    return { samples, darkIn100x100: darkCount, brightIn100x100: brightCount, totalPixels: allData.length / 4 };
  });
  
  console.log('COLOR_ANALYSIS:', JSON.stringify(analysis));
  
  await browser.close();
})();
