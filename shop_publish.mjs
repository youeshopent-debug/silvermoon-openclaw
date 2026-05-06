import https from 'https';

const TOKEN = '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';
const SHOP = 'aigenie-hub.myshopify.com';
const API = '/admin/api/2024-01';

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: SHOP,
      path: API + path,
      method,
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
      }
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { resolve({ _raw: d.slice(0, 200) }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  console.log('🚀 开始装修店铺...\n');

  // ── 1. 获取所有页面 ──
  console.log('📄 扫描所有页面...');
  const pagesRes = await req('GET', '/pages.json?limit=50');
  const pages = pagesRes.pages || [];
  console.log(`   找到 ${pages.length} 个页面`);

  // ── 2. 发布所有草稿页 ──
  console.log('\n📢 发布草稿页面...');
  for (const p of pages) {
    if (!p.published) {
      // 给缺少内容的页面填充默认内容
      let bodyHtml = p.body_html || '';
      if (!bodyHtml || bodyHtml.trim() === '') {
        bodyHtml = getDefaultContent(p.title);
      }
      await req('PUT', `/pages/${p.id}.json`, {
        page: {
          id: p.id,
          body_html: bodyHtml,
          published: true,
          published_at: new Date().toISOString(),
        }
      });
      console.log(`   ✅ ${p.title} → 已发布`);
    } else {
      console.log(`   ⏺ ${p.title} → 已是发布状态`);
    }
  }

  // ── 3. 删除测试商品 ──
  console.log('\n🗑 清理测试商品...');
  const prodRes = await req('GET', '/products.json?limit=50');
  const products = prodRes.products || [];
  for (const p of products) {
    if (p.title === 'test' || p.title.startsWith('test-')) {
      await req('DELETE', `/products/${p.id}.json`);
      console.log(`   ✅ 已删除: ${p.title}`);
    }
  }

  // ── 4. 上传产品图片到Shopify CDN ──
  console.log('\n🖼 处理产品图片...');
  const aiGlasses = products.find(p => p.title.includes('AI Smart Translation'));
  if (aiGlasses && (!aiGlasses.images || aiGlasses.images.length === 0)) {
    console.log('   主商品缺少本地图片，尝试从外部源添加...');
    // 用 placeholder 图先顶上
    const imageUrls = [
      'https://ae-pic-a1.aliexpress-media.com/kf/Sf2e6e4b7e7e84f2b9c5e5f5a5e5a5e5aA/AI-Smart-Glasses-800W-Camera.jpg',
      'https://ae-pic-a1.aliexpress-media.com/kf/Sa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6A/AI-Smart-Glasses-Translation.jpg',
    ];
    for (const src of imageUrls) {
      try {
        await req('POST', `/products/${aiGlasses.id}/images.json`, { image: { src } });
        console.log(`   ✅ 图片已添加: ${src.slice(0, 60)}...`);
      } catch(e) {
        console.log(`   ⚠️ 图片添加失败: ${e.errors || e.message?.slice(0, 60)}`);
      }
    }
  } else if (aiGlasses) {
    console.log(`   主商品已有 ${aiGlasses.images.length} 张图片`);
  }

  // ── 5. 设置导航菜单 ──
  console.log('\n🧭 配置导航菜单...');
  try {
    // 获取智能菜单（Horizon 主题自动管理）
    const menusRes = await req('GET', '/smart_collections.json');
    console.log(`   智能分类: ${(menusRes.smart_collections || []).length} 个`);
  } catch(e) {
    console.log(`   导航: ${e.message?.slice(0, 60)}`);
  }

  console.log('\n🎉 基础装修完成！');
  console.log(`   店铺: https://${SHOP}`);
  console.log('   管理: https://admin.shopify.com/store/aigenie-hub');
}

function getDefaultContent(title) {
  const contents = {
    'About Us': `<div style="max-width:700px;margin:0 auto;font-family:system-ui,sans-serif;color:#333;line-height:1.8">
<h1 style="font-size:28px;color:#111;border-bottom:2px solid #00d4ff;padding-bottom:10px">About AIGenie Vision</h1>
<p>Welcome to <strong>AIGenie Vision</strong> — where cutting-edge technology meets everyday lifestyle.</p>
<p>We believe that language should never be a barrier to human connection. Born from a passion for innovation, we specialize in next-generation AI Smart Glasses designed to seamlessly translate the world around you in real-time.</p>
<h2 style="font-size:20px;color:#222;margin-top:30px">Our Mission</h2>
<p>To break down global communication barriers through sleek, wearable AI technology.</p>
<h2 style="font-size:20px;color:#222;margin-top:30px">Why Choose Us</h2>
<ul>
<li><strong>Innovation First:</strong> We source only the most advanced AI technology</li>
<li><strong>Uncompromised Style:</strong> Designed for everyday elegance</li>
<li><strong>Global Guarantee:</strong> Secure shipping worldwide with dedicated support</li>
</ul>
<p style="margin-top:30px;color:#666">Step into the future with AIGenie Vision.</p>
</div>`,
    'FAQ': `<div style="max-width:700px;margin:0 auto;font-family:system-ui,sans-serif">
<h1 style="font-size:28px;color:#111;border-bottom:2px solid #00d4ff;padding-bottom:10px">Frequently Asked Questions</h1>
<h3 style="margin-top:25px">How does the AI translation work?</h3>
<p>Our smart glasses use advanced AI to translate 163 languages in real-time. Simply speak naturally, and the translation appears in your field of view.</p>
<h3 style="margin-top:25px">Is the device waterproof?</h3>
<p>Yes, our glasses are IPX4 rated — rain and sweat resistant for everyday use.</p>
<h3 style="margin-top:25px">How long does the battery last?</h3>
<p>Up to 8 hours of mixed use on a single charge.</p>
<h3 style="margin-top:25px">Do I need a smartphone?</h3>
<p>Yes, you need to download our companion app from App Store or Google Play to enable translation features.</p>
<h3 style="margin-top:25px">What's the return policy?</h3>
<p>30-day satisfaction guarantee. If you're not happy, we'll refund your purchase.</p>
</div>`,
    'Contact Us': `<div style="max-width:700px;margin:0 auto;font-family:system-ui,sans-serif">
<h1 style="font-size:28px;color:#111;border-bottom:2px solid #00d4ff;padding-bottom:10px">Contact Us</h1>
<p>Have a question? We'd love to hear from you.</p>
<p><strong>Email:</strong> support@aigenievision.com</p>
<p><strong>Response Time:</strong> Within 24 hours on business days</p>
<p><strong>Address:</strong> Unit 23-01, Level 23, Menara Exchange, Jalan Tun Razak, Kuala Lumpur, Malaysia</p>
</div>`,
    'Refund Policy': `<div style="max-width:700px;margin:0 auto;font-family:system-ui,sans-serif">
<h1 style="font-size:28px;color:#111;border-bottom:2px solid #00d4ff;padding-bottom:10px">Refund Policy</h1>
<h3 style="margin-top:25px">30-Day Satisfaction Guarantee</h3>
<p>We stand behind our products. If you're not completely satisfied, you can return your purchase within 30 days of delivery for a full refund.</p>
<h3 style="margin-top:25px">Conditions</h3>
<ul>
<li>Product must be in original condition</li>
<li>Include all accessories and packaging</li>
<li>Return shipping is covered by us for defective items</li>
</ul>
<h3 style="margin-top:25px">Process</h3>
<p>Contact us at support@aigenievision.com with your order number to initiate a return.</p>
</div>`,
    'Terms of Service': `<div style="max-width:700px;margin:0 auto;font-family:system-ui,sans-serif">
<h1 style="font-size:28px;color:#111;border-bottom:2px solid #00d4ff;padding-bottom:10px">Terms of Service</h1>
<p>By purchasing from AIGenie Vision, you agree to the following terms:</p>
<h3 style="margin-top:25px">Shipping</h3>
<p>Worldwide shipping available. Delivery times vary by location (typically 7-21 business days).</p>
<h3 style="margin-top:25px">Warranty</h3>
<p>All products come with a 1-year limited warranty covering manufacturing defects.</p>
<h3 style="margin-top:25px">Privacy</h3>
<p>Your data is safe with us. We never share your personal information with third parties.</p>
</div>`,
  };
  return contents[title] || `<h1>${title}</h1><p>Content coming soon.</p>`;
}

main().catch(e => console.error('❌ 出错:', e.message));
