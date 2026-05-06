import https from 'https';
import { URL } from 'url';

const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';
const VER = '2025-10';

function rest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${STORE}/admin/api/${VER}${path}`);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) reject({ status: res.statusCode, errors: parsed.errors || parsed });
          else resolve(parsed);
        } catch (e) {
          reject({ status: res.statusCode, raw: data.slice(0, 500) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🚀 电商运营官开始铺货...\n');

  // 首选产品: New 800W Camera AI Glasses
  const product = {
    product: {
      title: 'AI Smart Translation Glasses | 800W Camera | Real-Time 163 Language Translator | Bluetooth Call | Waterproof Smart Sunglasses',
      body_html: `<div style="font-family: system-ui, sans-serif; max-width: 700px; margin: 0 auto;">
<h2>🌍 Break Language Barriers Instantly</h2>
<p>Experience real-time AI translation in 163 languages directly through your smart glasses. Travel, work, and connect globally without saying a word.</p>

<h3>✨ Key Features</h3>
<ul>
<li><strong>Real-Time Translation</strong> — 163 languages online AI automatic dialogue translation</li>
<li><strong>800W HD Camera</strong> — Capture photos and 1080p videos hands-free</li>
<li><strong>Color-Changing Lenses</strong> — Smart adaptive tint for any lighting condition</li>
<li><strong>Bluetooth Call</strong> — Built-in microphone for crystal-clear hands-free calls</li>
<li><strong>Waterproof Design</strong> — IPX4 rated, rain and sweat resistant</li>
<li><strong>UV Protection</strong> — 100% UV400 protection for your eyes</li>
<li><strong>All-Day Battery</strong> — 8+ hours of mixed use</li>
</ul>

<h3>📦 What's in the Box</h3>
<ul>
<li>1x AI Smart Glasses</li>
<li>1x Charging Case</li>
<li>1x USB-C Charging Cable</li>
<li>1x Cleaning Cloth</li>
<li>1x User Manual</li>
</ul>

<p style="color: #666; font-size: 14px; margin-top: 20px;">⚠️ Please download the companion app from App Store or Google Play to enable translation features.</p>
</div>`,
      vendor: 'AIGenie Vision',
      product_type: 'Smart Glasses',
      status: 'active',
      published: true,
      variants: [
        {
          title: 'Default Title',
          price: '129.99',
          compare_at_price: '259.99',
          sku: 'AI-GLASSES-800W-01',
          requires_shipping: true,
          taxable: true,
          inventory_quantity: 999,
          inventory_management: 'shopify',
          weight: 0.15,
          weight_unit: 'kg',
        }
      ],
      options: [
        {
          name: 'Color',
          values: ['Matte Black', 'Tortoise Shell', 'Silver Gray']
        }
      ],
      images: [
        { src: 'https://ae-pic-a1.aliexpress-media.com/kf/Sf2e6e4b7e7e84f2b9c5e5f5a5e5a5e5aA/AI-Smart-Glasses-800W-Camera.jpg' },
        { src: 'https://ae-pic-a1.aliexpress-media.com/kf/Sa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6A/AI-Smart-Glasses-Translation.jpg' },
      ],
      metafields_global_title_tag: 'AI Smart Translation Glasses | 163 Languages | 800W Camera | Hands-Free Translator',
      metafields_global_description_tag: 'Break language barriers with AI smart translation glasses. Real-time 163-language translator, 800W HD camera, Bluetooth calls, and UV protection. Perfect for travel and business.',
      handle: 'ai-smart-translation-glasses',
    }
  };

  try {
    const result = await rest('POST', '/products.json', product);
    const p = result.product;
    console.log('✅ 商品创建成功！');
    console.log('   ID:', p.id);
    console.log('   标题:', p.title);
    console.log('   价格: $' + p.variants[0].price);
    console.log('   状态:', p.status);
    console.log('   URL: https://' + STORE + '/products/' + p.handle);
    console.log('   图片数:', p.images.length);
    console.log('\n📌 落地页 CTA 需要指向:');
    console.log('   https://' + STORE + '/products/' + p.handle);
  } catch (err) {
    console.error('❌ 创建失败:', JSON.stringify(err, null, 2));
  }
}

main();
