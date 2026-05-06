const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'https://aigenie-hub.myshopify.com';
const OUT = path.join(__dirname, '_shop_screenshots');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { url: '/', name: '01-homepage' },
  { url: '/collections/all', name: '02-collections-all' },
  { url: '/products/ai-smart-translation-glasses', name: '03-vision' },
  { url: '/products/3-in-1-ai-translator-earbuds-144-languages-noise-cancelling-bluetooth-5-4-headset-instant-translator-smart-voice-real-time', name: '04-buds-pro' },
  { url: '/products/ai-scan-translate-pen-instant-text-scanner-in-112-languages', name: '05-scanpen-pro' },
  { url: '/products/ai-voice-recorder-pen-auto-transcription-in-20-languages', name: '06-recorderpen' },
  { url: '/products/ai-smart-writing-pad-digitize-your-handwriting-instantly', name: '07-notepad' },
  { url: '/products/6-5-inch-full-screen-superfine-handwriting-lcd-writing-tablet-meeting-content-magnetic-sketch-pad-liquid-crystal-drawings-board', name: '08-writepad' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log(`Screenshots → ${OUT}`);
  for (const p of PAGES) {
    const page = await browser.newPage();
    const url = BASE + p.url;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: true });
      console.log(`  ✅ ${p.name}`);
    } catch (e) {
      console.log(`  ❌ ${p.name}: ${e.message}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(`\nDone! ${PAGES.length} screenshots saved.`);
})();
