const puppeteer = require('puppeteer');
const path = require('path');

const BANNER_PATH = path.resolve(__dirname, 'twitter_banner.png');
const PROFILE_URL = 'https://x.com/lau_sii96989';
const BIO = 'SilverMoon Bank 银月钱庄 🏦 | 大马开发者出海收款指南 | Stripe/Lemon Squeezy 实战 | AI 产业报告';
const LOCATION = 'Malaysia';
const WEBSITE = 'https://silvermoon.lemonsqueezy.com';

const TWEET_TEXT = `🚀 大马开发者出海必看！

刚上线 4 份实战资料：
📘 AI 产业全景报告（2025-2033）
💳 Stripe/Lemon Squeezy 收款指南
📝 Stripe 申诉邮件模板
🔧 域名验证 404 修复手册

全部基于实战经验，SGD 15.60 起
👉 https://silvermoon.lemonsqueezy.com`;

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Step 1: Go to Twitter
  console.log('Navigating to Twitter...');
  await page.goto('https://x.com/login', { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('Please log in manually in the browser window...');
  console.log('Waiting 120 seconds for you to log in...');
  await new Promise(r => setTimeout(r, 120000));

  // Step 2: Go to profile settings
  console.log('Navigating to profile settings...');
  await page.goto('https://x.com/settings/profile', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  // Step 3: Update Bio
  console.log('Updating Bio...');
  try {
    const bioInput = await page.$('textarea[data-testid="bioInput"]');
    if (bioInput) {
      await bioInput.click({ clickCount: 3 });
      await bioInput.type(BIO, { delay: 30 });
      console.log('Bio updated');
    }
  } catch (e) { console.log('Bio update failed:', e.message); }

  // Step 4: Update Location
  console.log('Updating Location...');
  try {
    const locInput = await page.$('input[data-testid="locationInput"]');
    if (locInput) {
      await locInput.click({ clickCount: 3 });
      await locInput.type(LOCATION, { delay: 20 });
      console.log('Location updated');
    }
  } catch (e) { console.log('Location update failed:', e.message); }

  // Step 5: Update Website
  console.log('Updating Website...');
  try {
    const webInput = await page.$('input[data-testid="websiteInput"]');
    if (webInput) {
      await webInput.click({ clickCount: 3 });
      await webInput.type(WEBSITE, { delay: 20 });
      console.log('Website updated');
    }
  } catch (e) { console.log('Website update failed:', e.message); }

  // Step 6: Upload Banner
  console.log('Uploading Banner...');
  try {
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(BANNER_PATH);
      console.log('Banner uploaded');
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) { console.log('Banner upload failed:', e.message); }

  // Step 7: Save changes
  console.log('Saving changes...');
  try {
    const saveBtn = await page.$('button[data-testid="settingsDetailSave"]');
    if (saveBtn) {
      await saveBtn.click();
      console.log('Changes saved');
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (e) { console.log('Save failed:', e.message); }

  // Step 8: Post a tweet
  console.log('Posting tweet...');
  await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  try {
    const tweetBox = await page.$('div[data-testid="tweetTextarea_0"]');
    if (tweetBox) {
      await tweetBox.type(TWEET_TEXT, { delay: 15 });
      await new Promise(r => setTimeout(r, 2000));
      const postBtn = await page.$('button[data-testid="tweetButton"]');
      if (postBtn) {
        await postBtn.click();
        console.log('Tweet posted!');
      }
    }
  } catch (e) { console.log('Tweet failed:', e.message); }

  console.log('Done! Browser will stay open for review.');
  // Keep browser open for manual review
})();
