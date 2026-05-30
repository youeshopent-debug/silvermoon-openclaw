const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  console.log('Pages:', pages.length);
  for (const p of pages) {
    const url = p.url();
    console.log(`  ${url.substring(0,80)}`);
  }

  // Find or create Facebook page
  let fbPage = pages.find(p => p.url().includes('facebook.com/SilverMoonBank'));
  if (!fbPage) {
    fbPage = await browser.newPage();
    await fbPage.goto('https://www.facebook.com/SilverMoonBank', { waitUntil: 'networkidle2', timeout: 30000 });
  }

  await fbPage.bringToFront();
  await fbPage.waitForTimeout(3000);
  console.log('Current URL:', fbPage.url());

  // Check if logged in
  const pageTitle = await fbPage.title();
  console.log('Title:', pageTitle);

  // Try to find the post creation box and type
  // Facebook uses aria-label on the post composer
  try {
    // Wait for the post composer (the "What's on your mind?" box)
    const composerSelectors = [
      'div[aria-label="What\'s on your mind?"]',
      'div[aria-label="What’s on your mind?"]',
      'div[role="textbox"][aria-label*="mind"]',
      'div[contenteditable="true"][aria-label*="mind"]',
      'div[role="button"]:has(span:contains("What"))',
    ];

    for (const sel of composerSelectors) {
      const el = await fbPage.$(sel);
      if (el) {
        console.log('Found composer:', sel);
        await el.click();
        await fbPage.waitForTimeout(1000);
        break;
      }
    }

    // Type the post content
    const postContent = `🧘 Breathe. Reset. Rise.

Your nervous system is your most underrated performance tool. Train it, don't drain it.

→ Try Deep Calm breathing protocol: deepcalm-ai.com

#DeepCalm #NervousSystem #Breathwork #Resilience #Biohacking`;

    // Find the active text editor
    const editorSelectors = [
      'div[contenteditable="true"][aria-label*="post"]',
      'div[contenteditable="true"][aria-label*="write"]',
      'div[contenteditable="true"][aria-label*="mind"]',
      'div[contenteditable="true"] div[data-block="true"]',
    ];

    let typed = false;
    for (const sel of editorSelectors) {
      const el = await fbPage.$(sel);
      if (el) {
        console.log('Found editor:', sel);
        await el.type(postContent, { delay: 30 });
        typed = true;
        break;
      }
    }

    if (!typed) {
      // Fallback: try to get all contenteditable divs
      const editors = await fbPage.$$('div[contenteditable="true"]');
      if (editors.length > 0) {
        console.log(`Found ${editors.length} contenteditable divs, using first`);
        await editors[0].type(postContent, { delay: 30 });
        typed = true;
      }
    }

    if (typed) {
      console.log('Content typed successfully');
    } else {
      console.log('Could not find editor - taking screenshot');
      await fbPage.screenshot({ path: 'C:\\Users\\User\\Desktop\\fb_state.png' });
    }

  } catch (e) {
    console.error('Post error:', e.message);
    await fbPage.screenshot({ path: 'C:\\Users\\User\\Desktop\\fb_error.png' });
  }

  await browser.disconnect();
  console.log('Done');
})();
