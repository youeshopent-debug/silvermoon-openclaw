const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const CHROME_PORT = parseInt(process.env.SOCIAL_CHROME_PORT || '9223', 10);
const CHROME_HOST = process.env.SOCIAL_CHROME_HOST || '127.0.0.1';
const USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR || 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data';
const PROFILE_DIR = process.env.CHROME_PROFILE_DIR || 'Profile 3';

const FB_PAGE_URL = process.env.FB_PAGE_URL || 'https://www.facebook.com/SilverMoonBank-';

const OUTPUT_LOG = path.join(__dirname, '..', 'data', 'social_publish_log.jsonl');

function appendLog(entry) {
  const dir = path.dirname(OUTPUT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(OUTPUT_LOG, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
}

async function launchBrowser() {
  try {
    const browser = await puppeteer.connect({
      browserURL: `http://${CHROME_HOST}:${CHROME_PORT}`,
      defaultViewport: null,
    });
    return { browser, connected: true };
  } catch {
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      userDataDir: USER_DATA_DIR,
      args: [
        `--profile-directory=${PROFILE_DIR}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    return { browser, connected: false };
  }
}

async function postToFacebook({ content, imagePath, pageUrl = FB_PAGE_URL }) {
  const result = { platform: 'facebook', success: false, error: null, postUrl: null };
  try {
    const { browser } = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(pageUrl || FB_PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);

    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="button"], button, a[role="button"]');
      for (const btn of btns) {
        if (btn.textContent.toLowerCase().includes('create') || btn.textContent.toLowerCase().includes('write') || btn.textContent.toLowerCase().includes('what\'s on your mind') || btn.textContent.toLowerCase().includes('在想什么')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (clicked) await page.waitForTimeout(2000);

    const editorSelector = ['div[role="textbox"]', 'div[contenteditable="true"]', 'textarea', '[data-lexical-editor]', '._5rpu'];
    let editor = null;
    for (const sel of editorSelector) {
      editor = await page.$(sel);
      if (editor) break;
    }

    if (editor) {
      await editor.click();
      await page.waitForTimeout(500);
      await editor.type(content, { delay: 30 });
    }

    if (imagePath && fs.existsSync(imagePath)) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(imagePath);
        await page.waitForTimeout(3000);
      }
    }

    const postBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('[role="button"], button');
      for (const btn of btns) {
        const t = btn.textContent.toLowerCase();
        if (t.includes('post') || t.includes('share') || t.includes('发布') || t.includes('分享')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (postBtn) {
      await page.waitForTimeout(3000);
      result.success = true;
      result.postUrl = pageUrl || FB_PAGE_URL;
    }

    await page.close();
    await browser.disconnect();
  } catch (err) {
    result.error = err.message;
  }
  appendLog(result);
  return result;
}

async function postToX({ content, imagePath }) {
  const result = { platform: 'x', success: false, error: null, postUrl: null };
  try {
    const { browser } = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('https://x.com/home', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);

    const editorSelector = ['div[role="textbox"]', '[data-testid="tweetTextarea_0"]', 'div[contenteditable="true"]', 'textarea'];
    let editor = null;
    for (const sel of editorSelector) {
      editor = await page.$(sel);
      if (editor) break;
    }

    if (editor) {
      await editor.click();
      await page.waitForTimeout(500);
      const lines = content.split('\n');
      for (const line of lines) {
        await editor.type(line, { delay: 15 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
    }

    if (imagePath && fs.existsSync(imagePath)) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(imagePath);
        await page.waitForTimeout(3000);
      }
    }

    const postBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('[data-testid="tweetButton"], [role="button"]');
      for (const btn of btns) {
        const t = btn.textContent.toLowerCase();
        if (t.includes('post') || t.includes('tweet') || t.includes('reply')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (postBtn) {
      await page.waitForTimeout(3000);
      result.success = true;
      result.postUrl = 'https://x.com/home';
    }

    await page.close();
    await browser.disconnect();
  } catch (err) {
    result.error = err.message;
  }
  appendLog(result);
  return result;
}

async function postToReddit({ title, content, imagePath, subreddit = 'healthtech' }) {
  const result = { platform: 'reddit', success: false, error: null, postUrl: null };
  try {
    const { browser } = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const submitUrl = `https://www.reddit.com/r/${subreddit}/submit`;
    await page.goto(submitUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);

    const titleInput = await page.$('input[name="title"], [data-placeholder="Title"], #title');
    if (titleInput) {
      await titleInput.click();
      await page.waitForTimeout(300);
      await titleInput.type(title || content.slice(0, 80), { delay: 20 });
    }

    const editor = await page.$('div[role="textbox"], [contenteditable="true"], textarea');
    if (editor) {
      await editor.click();
      await page.waitForTimeout(300);
      await editor.type(content, { delay: 15 });
    }

    if (imagePath && fs.existsSync(imagePath)) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(imagePath);
        await page.waitForTimeout(3000);
      }
    }

    const postBtn = await page.evaluate(() => {
      const btns = document.querySelectorAll('button[type="submit"], [role="button"]');
      for (const btn of btns) {
        const t = btn.textContent.toLowerCase();
        if (t.includes('post') || t.includes('submit') || t.includes('发布')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    if (postBtn) {
      await page.waitForTimeout(3000);
      result.success = true;
      result.postUrl = submitUrl;
    }

    await page.close();
    await browser.disconnect();
  } catch (err) {
    result.error = err.message;
  }
  appendLog(result);
  return result;
}

module.exports = {
  postToFacebook,
  postToX,
  postToReddit,
  launchBrowser,
  FB_PAGE_URL,
  OUTPUT_LOG,
};
