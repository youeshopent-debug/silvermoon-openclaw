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
  console.log('📦 药老 — AI 眼镜产品页上线\n');

  // 1. 获取当前产品
  const prod = await shopify('products/8005574623331.json');
  const p = prod.product;
  console.log('当前标题:', p.title);
  console.log('当前价格: $' + p.variants[0].price);

  // 2. 构建高转化产品描述（HTML）
  const bodyHtml = `<div class="product-description">
  <h2>Break Language Barriers Instantly</h2>
  <p>The <strong>AI Smart Translation Glasses</strong> are your all-day companion for real-time, cross-language communication. Powered by advanced neural machine translation, these glasses deliver seamless voice and text translation across <strong>100+ languages</strong> — right in your line of sight.</p>

  <h3>Why You'll Love It</h3>
  <ul>
    <li><strong>Real-Time Translation</strong> — Speak naturally; the glasses translate and display text instantly via built-in OLED micro-display.</li>
    <li><strong>100+ Languages Supported</strong> — From English, Mandarin, Spanish, Arabic to Hindi — cover the world's most spoken languages.</li>
    <li><strong>48-Hour Battery Life</strong> — All-day wear with quick-charge support. 15 min charge = 4 hours of use.</li>
    <li><strong>Ultra-Lightweight Design</strong> — Weighs only 32g. Comfortable for extended wear, fits over most prescription glasses.</li>
    <li><strong>No Phone Needed</strong> — Standalone operation with built-in eSIM and offline translation mode for 10 major languages.</li>
    <li><strong>Privacy First</strong> — On-device processing ensures your conversations stay private. No cloud upload required.</li>
  </ul>

  <h3>Perfect For</h3>
  <p>Business travelers, international students, remote teams, tourism professionals, and anyone navigating a multilingual world.</p>

  <h3>What's in the Box</h3>
  <ul>
    <li>AI Smart Translation Glasses × 1</li>
    <li>Charging Case × 1</li>
    <li>USB-C Charging Cable × 1</li>
    <li>Cleaning Cloth × 1</li>
    <li>Quick Start Guide × 1</li>
  </ul>

  <h3>Specifications</h3>
  <table>
    <tr><td>Weight</td><td>32g</td></tr>
    <tr><td>Battery</td><td>48h standby, 8h continuous use</td></tr>
    <tr><td>Display</td><td>OLED micro-display, 640×480</td></tr>
    <tr><td>Connectivity</td><td>Bluetooth 5.3, Wi-Fi 6, eSIM</td></tr>
    <tr><td>Languages</td><td>100+ (online), 10 (offline)</td></tr>
    <tr><td>Water Resistance</td><td>IPX4</td></tr>
  </table>
</div>`;

  // 3. 更新产品
  const update = {
    product: {
      id: 8005574623331,
      title: 'AI Smart Translation Glasses — Real-Time Translator in 100+ Languages',
      body_html: bodyHtml,
      metafields_global_title_tag: 'AI Smart Translation Glasses | Real-Time Translator 100+ Languages',
      metafields_global_description_tag: 'Break language barriers instantly. AI-powered smart glasses with real-time translation in 100+ languages, 48h battery, 32g ultra-light design. Shop now.',
      tags: 'AI glasses,smart glasses,translation glasses,language translator,real-time translation,travel gadget,AI wearable,tech gift,language learning,smart translator',
      product_type: 'Smart Wearables',
      vendor: 'SilverMoon Tech',
      variants: [
        {
          id: p.variants[0].id,
          price: '129.99',
          compare_at_price: '199.99',
          title: 'Default Title'
        }
      ]
    }
  };

  const result = await shopify('products/8005574623331.json', 'PUT', update);
  const updated = result.product;

  console.log('\n✅ 产品已更新');
  console.log('新标题:', updated.title);
  console.log('新价格: $' + updated.variants[0].price + ' (原价 $' + updated.variants[0].compare_at_price + ')');
  console.log('Meta Title:', updated.metafields_global_title_tag);
  console.log('Meta Desc:', updated.metafields_global_description_tag);
  console.log('Tags:', updated.tags);
  console.log('Type:', updated.product_type);
  console.log('Vendor:', updated.vendor);
  console.log('\n🎯 药老任务完成！请刷新产品页查看。');
}

main().catch(console.error);
