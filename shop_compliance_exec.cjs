const https = require('https');
const token = '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';
const store = 'aigenie-hub.myshopify.com';

function shopify(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: store,
      path: '/admin/api/2024-01/' + endpoint,
      method,
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('海波东 — 合规落地执行\n');

  // === 1. 更新产品描述追加合规声明 ===
  console.log('1/3 更新产品合规声明...');
  const prod = await shopify('products/8005574623331.json');
  const p = prod.product;
  let body = p.body_html;

  const complianceHtml = `\n<div class="compliance-section" style="margin-top:40px;padding-top:20px;border-top:1px solid #2a2a2d;font-size:13px;color:#999;">
  <h3 style="color:#36F4A4;font-size:16px;">Regulatory Compliance</h3>
  <p><strong>FCC (USA):</strong> This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) This device may not cause harmful interference, and (2) this device must accept any interference received, including interference that may cause undesired operation.</p>
  <p><strong>CE (EU):</strong> This device complies with the requirements of RED 2014/53/EU and RoHS Directive 2011/65/EU.</p>
  <p><strong>Battery Safety:</strong> Contains a lithium polymer battery. Dispose per local regulations. Do not expose above 60°C.</p>
  <p><strong>Privacy:</strong> On-device translation only. No cloud upload. Camera captures text for translation only — no recording by default. See our <a href="/pages/privacy">Privacy Policy</a> for details.</p>
</div>`;

  if (body.includes('compliance-section')) {
    console.log('   合规声明已存在，跳过');
  } else {
    await shopify('products/8005574623331.json', 'PUT', {
      product: { id: 8005574623331, body_html: body + complianceHtml }
    });
    console.log('   ✅ 合规声明已追加');
  }

  // === 2. 创建 Privacy Policy 页面 ===
  console.log('\n2/3 创建 Privacy Policy 页面...');
  const privacyContent = `<div class="page-content">
<h1>Privacy Policy</h1>
<p><em>Last updated: May 2, 2026</em></p>

<h2>1. Camera & Recording</h2>
<p>Our AI Smart Translation Glasses include a built-in camera used exclusively for real-time translation of text (e.g., menus, signs). The camera:</p>
<ul>
  <li><strong>DOES NOT</strong> record or store video/audio by default</li>
  <li><strong>ONLY</strong> captures images when you manually press the translation button</li>
  <li><strong>DOES NOT</strong> upload images to external servers without your explicit consent</li>
  <li><strong>PROCESSES</strong> translation locally on the device (no cloud transmission)</li>
</ul>

<h2>2. Information We Collect</h2>
<p>When you make a purchase, we collect your name, email, shipping address, and payment information (processed securely by Shopify Payments). We do not store credit card details.</p>

<h2>3. Your Rights (GDPR)</h2>
<p>If you are in the European Economic Area (EEA), you have the right to:</p>
<ul>
  <li>Access any data stored on the device</li>
  <li>Request deletion of all locally stored data</li>
  <li>Withdraw consent at any time by factory resetting the glasses</li>
</ul>

<h2>4. Data Storage</h2>
<p>Translation history is stored locally on the device and is automatically cleared after 24 hours. No personal data is transmitted to SilverMoon Bank servers.</p>

<h2>5. Contact</h2>
<p>For privacy inquiries: hello@silvermoon.bank</p>
</div>`;

  const pages = await shopify('pages.json');
  const existingPrivacy = pages.pages.find(pg => pg.handle === 'privacy');
  if (existingPrivacy) {
    console.log('   Privacy 页面已存在 (ID: ' + existingPrivacy.id + ')，更新内容');
    await shopify('pages/' + existingPrivacy.id + '.json', 'PUT', {
      page: {
        id: existingPrivacy.id,
        title: 'Privacy Policy',
        body_html: privacyContent,
        handle: 'privacy',
        published: true
      }
    });
    console.log('   ✅ Privacy 页面已更新');
  } else {
    await shopify('pages.json', 'POST', {
      page: {
        title: 'Privacy Policy',
        body_html: privacyContent,
        handle: 'privacy',
        published: true
      }
    });
    console.log('   ✅ Privacy 页面已创建');
  }

  // === 3. 创建 Return & Refund Policy 页面 ===
  console.log('\n3/3 创建 Return & Refund Policy 页面...');
  const refundContent = `<div class="page-content">
<h1>Return & Refund Policy</h1>
<p><em>Last updated: May 2, 2026</em></p>

<h2>30-Day Return Window</h2>
<p>You have 30 days from delivery to request a return. Items must be returned in original condition with all accessories and packaging.</p>

<h2>Returnless Refund (for orders under $50)</h2>
<p>For orders under USD $50, we issue a full refund without requiring you to return the item. You will receive the refund within 5 business days to your original payment method.</p>

<h2>Return Shipping (for orders over $50)</h2>
<p>We provide a prepaid return label. The return shipping cost ($8.99) will be deducted from your refund. We recommend using trackable shipping — we are not responsible for lost return packages.</p>

<h2>Defective Products</h2>
<p>If the product arrives defective or damaged, contact us within 7 days of delivery. We will issue a full refund or replacement with no return required.</p>

<h2>Non-Returnable Items</h2>
<ul>
  <li>Products damaged by misuse, water, or unauthorized modification</li>
  <li>Products without the original serial number</li>
  <li>Free promotional items</li>
</ul>

<h2>Processing Time</h2>
<p>Refunds are processed within 5-7 business days after we receive the return. Your bank may take additional 3-5 business days to post the refund.</p>

<h2>Contact</h2>
<p>For return requests: hello@silvermoon.bank</p>
</div>`;

  const existingRefund = pages.pages.find(pg => pg.handle === 'return-refund-policy');
  if (existingRefund) {
    console.log('   Return & Refund 页面已存在 (ID: ' + existingRefund.id + ')，更新内容');
    await shopify('pages/' + existingRefund.id + '.json', 'PUT', {
      page: {
        id: existingRefund.id,
        title: 'Return & Refund Policy',
        body_html: refundContent,
        handle: 'return-refund-policy',
        published: true
      }
    });
    console.log('   ✅ Return & Refund 页面已更新');
  } else {
    await shopify('pages.json', 'POST', {
      page: {
        title: 'Return & Refund Policy',
        body_html: refundContent,
        handle: 'return-refund-policy',
        published: true
      }
    });
    console.log('   ✅ Return & Refund 页面已创建');
  }

  console.log('\n合规落地完成！请刷新店铺验证：');
  console.log('   https://aigenie-hub.myshopify.com/');
  console.log('   https://aigenie-hub.myshopify.com/pages/privacy');
  console.log('   https://aigenie-hub.myshopify.com/pages/return-refund-policy');
}

main().catch(console.error);
