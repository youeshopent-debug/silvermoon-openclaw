import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const BASE = `https://${S}`;

function rest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: S, path: '/admin/api/2024-01' + path, method,
      headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' }
    };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ _error: e.message, _raw: d.slice(0,200) }); } }); });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

function gql(query) {
  return new Promise((ok, no) => {
    const body = JSON.stringify({ query });
    const opts = {
      hostname: S, path: '/admin/api/2025-07/graphql.json', method: 'POST',
      headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' }
    };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.on('error', no); r.write(body); r.end();
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  银月钱庄 · 店铺最终化');
  console.log('═══════════════════════════════════════\n');

  // ── 1. 上传产品图 ──
  console.log('📦 步骤1：上传产品图');
  const prods = await rest('GET', '/products.json');
  const glass = prods.products?.[0];
  if (!glass) { console.log('❌ 未找到产品！'); return; }
  console.log(`   产品: ${glass.title} (ID: ${glass.id})`);

  // 先删除旧图
  if (glass.images?.length > 0) {
    for (const img of glass.images) {
      await rest('DELETE', `/products/${glass.id}/images/${img.id}`);
      console.log(`   🗑 删除旧图: ${img.id}`);
    }
  }

  // 多 URL 尝试上传产品图
  const imgUrls = [
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    'https://picsum.photos/seed/glasses1/800/800',
    'https://picsum.photos/seed/glasses2/800/800'
  ];

  for (let i = 0; i < imgUrls.length; i++) {
    const r = await rest('POST', `/products/${glass.id}/images.json`, {
      image: { src: imgUrls[i], position: i + 1 }
    });
    if (r.image) console.log(`   ✅ 图${i+1} 已上传 (ID: ${r.image.id})`);
    else console.log(`   ⚠️ 图${i+1} 失败: ${r.errors ? JSON.stringify(r.errors).slice(0,80) : 'unknown'}`);
    await delay(500);
  }

  // ── 2. 更新产品 SEO 描述 ──
  console.log('\n📝 步骤2：更新产品 SEO 描述');
  const seoDesc = `Break language barriers with AI-powered smart glasses. Real-time translation in 163 languages, 800W HD camera, Bluetooth calling, and waterproof design — all in a stylish sunglass form factor.

🌍 Real-Time AI Translation — 163 languages online automatic dialogue translation
📸 800W HD Camera — Capture hands-free photos and 1080p video
🔄 Smart Color-Changing Lenses — Adaptive tint for any lighting
🎧 Bluetooth Calling — Built-in mic for crystal-clear calls
💧 IPX4 Waterproof — Rain and sweat resistant
🕶️ UV400 Protection — 100% eye protection
🔋 8+ Hours Battery — All-day mixed use

Includes: Smart Glasses × 1, Charging Case × 1, USB-C Cable × 1, Cleaning Cloth × 1, User Manual × 1

⚠️ Companion app required (iOS/Android) for translation features.`;

  const updateResult = await rest('PUT', `/products/${glass.id}.json`, {
    product: {
      id: glass.id,
      body_html: seoDesc.replace(/\n/g, '<br>'),
      tags: 'AI glasses, smart glasses, translation glasses, wearable tech, AI translation, smart sunglasses, language translator'
    }
  });
  if (updateResult.product) console.log('   ✅ SEO 描述已更新');
  else console.log('   ❌ 描述更新失败');

  // ── 3. 更新首页模板（Hero 图） ──
  console.log('\n🎨 步骤3：更新首页 Hero Banner');
  const heroImg = 'https://picsum.photos/seed/herotech/1920/800';

  // 先获取当前 homepage 模板
  const themeJson = await rest('GET', '/themes.json');
  const mainTheme = themeJson.themes?.find(t => t.role === 'main');
  if (!mainTheme) { console.log('❌ 未找到主题'); return; }

  const homeJson = await rest('GET', `/themes/${mainTheme.id}/assets.json?asset[key]=templates/index.json`);
  const existing = homeJson.asset?.value;

  let homepage;
  if (existing) {
    try { homepage = JSON.parse(existing); }
    catch(e) { console.log('   ⚠️ 解析失败，重建模板'); }
  }

  if (!homepage) {
    homepage = {
      sections: {
        hero_main: {
          type: "slideshow",
          blocks: {
            slide_1: {
              type: "_slide",
              settings: {
                image: heroImg,
                overlay_opacity: 40,
                heading: "AI Smart Translation Glasses",
                description: "Real-time 163-language translation | 800W Camera | Bluetooth | Waterproof Smart Sunglasses",
                button_label: "Shop Now",
                button_link: "/products/ai-smart-translation-glasses"
              }
            }
          },
          block_order: ["slide_1"],
          settings: {
            display_mode: "full_frame",
            section_width: "full-width",
            section_height: "large",
            show_arrows: true,
            show_dots: true,
            color_scheme: "scheme-6",
            padding_block_top: 0,
            padding_block_bottom: 0
          }
        },
        marquee_brand: {
          type: "marquee",
          settings: {
            text: "FREE WORLDWIDE SHIPPING  |  30-DAY SATISFACTION GUARANTEE  |  AI-POWERED INNOVATION",
            speed: 30,
            direction: "left",
            color_scheme: "scheme-2",
            padding_block_top: 16,
            padding_block_bottom: 16
          }
        },
        featured_product: {
          type: "featured-product",
          settings: {
            product: "ai-smart-translation-glasses",
            color_scheme: "scheme-1",
            section_width: "page-width",
            padding_block_top: 48,
            padding_block_bottom: 48
          }
        },
        product_list: {
          type: "product-list",
          blocks: {
            "static-header": {
              type: "header",
              settings: {
                title: "Featured Products",
                description: "Discover our cutting-edge AI wearable tech"
              }
            },
            "static-product-card": {
              type: "product-card",
              settings: {
                product: "ai-smart-translation-glasses",
                show_rating: true,
                show_price: true,
                show_vendor: false
              }
            }
          },
          block_order: ["static-header", "static-product-card"],
          settings: {
            collection: "all",
            layout_type: "grid",
            max_products: 8,
            columns: 4,
            mobile_columns: "2",
            color_scheme: "scheme-1",
            section_width: "page-width",
            padding_block_top: 48,
            padding_block_bottom: 48
          }
        }
      },
      order: ["hero_main", "marquee_brand", "featured_product", "product_list"]
    };
  } else {
    // 只更新 slide 的 image 字段
    if (homepage.sections?.hero_main?.blocks?.slide_1?.settings) {
      homepage.sections.hero_main.blocks.slide_1.settings.image = heroImg;
    }
  }

  const themeResult = await rest('PUT', `/themes/${mainTheme.id}/assets.json`, {
    asset: {
      key: 'templates/index.json',
      value: JSON.stringify(homepage)
    }
  });
  if (themeResult.asset) console.log('   ✅ 首页模板已更新（含 Hero 图）');
  else console.log('   ❌ 首页更新失败:', JSON.stringify(themeResult).slice(0,200));

  // ── 4. 修复导航菜单 ──
  console.log('\n🧭 步骤4：修复导航菜单');
  const menuQuery = await gql(`{ menus(first:5) { edges { node { id title handle } } } }`);
  const menus = menuQuery.data?.menus?.edges || [];
  let mainMenuId, footerMenuId;
  for (const e of menus) {
    if (e.node.handle === 'main-menu') mainMenuId = e.node.id;
    if (e.node.handle === 'footer') footerMenuId = e.node.id;
  }
  console.log(`   Main Menu ID: ${mainMenuId || '未找到'}`);
  console.log(`   Footer Menu ID: ${footerMenuId || '未找到'}`);

  if (mainMenuId) {
    const items = [
      {title:"Home", url:`${BASE}/`, type:"FRONTPAGE"},
      {title:"AI Translation Glasses", url:`${BASE}/products/ai-smart-translation-glasses`, type:"HTTP"},
      {title:"About Us", url:`${BASE}/pages/about-us`, type:"HTTP"},
      {title:"FAQ", url:`${BASE}/pages/faq`, type:"HTTP"},
      {title:"Contact", url:`${BASE}/pages/contact-us`, type:"HTTP"}
    ];
    const is = items.map(i => `{title:"${i.title}", url:"${i.url}", type:${i.type}}`).join('\n');
    const r = await gql(`mutation { menuUpdate(id: "${mainMenuId}", items: [${is}]) { menu { id title items { title url } } userErrors { field message } } }`);
    if (r.data?.menuUpdate?.menu) console.log('   ✅ Main Menu 已更新');
    else console.log('   ❌', JSON.stringify(r.errors || r.data?.menuUpdate?.userErrors).slice(0,200));
  }

  if (footerMenuId) {
    const items = [
      {title:"Refund Policy", url:`${BASE}/pages/refund-policy`, type:"HTTP"},
      {title:"Terms of Service", url:`${BASE}/pages/terms-of-service`, type:"HTTP"},
      {title:"Contact Us", url:`${BASE}/pages/contact-us`, type:"HTTP"},
      {title:"About Us", url:`${BASE}/pages/about-us`, type:"HTTP"}
    ];
    const is = items.map(i => `{title:"${i.title}", url:"${i.url}", type:${i.type}}`).join('\n');
    const r = await gql(`mutation { menuUpdate(id: "${footerMenuId}", items: [${is}]) { menu { id title items { title url } } userErrors { field message } } }`);
    if (r.data?.menuUpdate?.menu) console.log('   ✅ Footer Menu 已更新');
    else console.log('   ❌', JSON.stringify(r.errors || r.data?.menuUpdate?.userErrors).slice(0,200));
  }

  // ── 5. 重新发布所有页面 ──
  console.log('\n📄 步骤5：页面发布确认');
  const allPages = await rest('GET', '/pages.json?published_status=any');
  for (const p of (allPages.pages || [])) {
    const r = await rest('PUT', `/pages/${p.id}.json`, {
      page: { id: p.id, published: true, published_at: new Date().toISOString() }
    });
    console.log(`   ${r.page?.published ? '✅' : '❌'} ${p.title}`);
  }

  // ── 6. 验证 ──
  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ 验证结果');
  console.log('═══════════════════════════════════════\n');

  const updatedProd = await rest('GET', `/products/${glass.id}.json`);
  console.log(`📦 产品: ${updatedProd.product?.title}`);
  console.log(`  图片: ${updatedProd.product?.images?.length || 0} 张`);
  console.log(`  价格: $${updatedProd.product?.variants?.[0]?.price}`);
  console.log(`  Compare: $${updatedProd.product?.variants?.[0]?.compare_at_price}`);

  const verifyPages = await rest('GET', '/pages.json?published_status=published');
  console.log(`\n📄 已发布页面: ${(verifyPages.pages || []).length} 个`);

  const verifyMenus = await gql(`{ menus(first:5) { edges { node { title handle items { title url } } } } }`);
  for (const e of (verifyMenus.data?.menus?.edges || [])) {
    const m = e.node;
    console.log(`\n🧭 ${m.title} (${m.handle}):`);
    (m.items || []).forEach(i => console.log(`  → ${i.title}: ${i.url}`));
  }

  console.log(`\n🌐 前台网址: ${BASE}/`);
  console.log('\n🎉 全部搞定！');
}

main().catch(e => console.error('❌ 致命错误:', e.message));
