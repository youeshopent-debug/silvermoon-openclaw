import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const A = '/admin/api/2024-01';
function req(m, p, b = null) {
  return new Promise((ok, no) => {
    const opts = { hostname: S, path: A + p, method: m, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.on('error', no); if (b) r.write(JSON.stringify(b)); r.end();
  });
}

async function main() {
  // ============================================================
  // 1. 首页模板 — 用 Horizon 主题原生 section 类型
  // ============================================================
  console.log('=== 1. 写入首页模板 ===');
  const homepage = {
    "sections": {
      // Hero Banner — 品牌主视觉
      "hero_main": {
        "type": "slideshow",
        "blocks": {
          "slide_1": {
            "type": "slide",
            "name": "AI Smart Translation Glasses",
            "settings": {
              "image": "",
              "image_overlay": true,
              "overlay_opacity": 40,
              "heading": "AI Smart Translation Glasses",
              "description": "Real-time 163-language translation | 800W Camera | Bluetooth | Waterproof",
              "button_label": "Shop Now",
              "button_link": "/products/ai-smart-translation-glasses",
              "color_scheme": "scheme-6"
            }
          }
        },
        "block_order": ["slide_1"],
        "settings": {
          "height": "large",
          "show_arrows": true,
          "show_dots": true,
          "section_width": "full-width",
          "padding-block-start": 0,
          "padding-block-end": 0
        }
      },
      // Marquee — 品牌标语滚动
      "marquee_brand": {
        "type": "marquee",
        "settings": {
          "text": "FREE WORLDWIDE SHIPPING  |  30-DAY SATISFACTION GUARANTEE  |  AI-POWERED INNOVATION",
          "speed": 30,
          "direction": "left",
          "color_scheme": "scheme-2",
          "padding-block-start": 16,
          "padding-block-end": 16
        }
      },
      // Featured Product — 主推产品
      "featured_product": {
        "type": "featured-product",
        "settings": {
          "product": "ai-smart-translation-glasses",
          "color_scheme": "scheme-1",
          "section_width": "page-width",
          "padding-block-start": 48,
          "padding-block-end": 48
        }
      },
      // Product List — 所有产品
      "product_list": {
        "type": "product-list",
        "blocks": {
          "static-header": {
            "type": "_product-list-content",
            "name": "Our Collection",
            "static": true,
            "settings": {
              "content_direction": "row",
              "horizontal_alignment": "space-between",
              "vertical_alignment": "center",
              "gap": 12,
              "width": "fill",
              "padding-block-start": 0,
              "padding-block-end": 24
            },
            "blocks": {
              "title_block": {
                "type": "_product-list-text",
                "name": "Collection Title",
                "settings": {
                  "text": "<h2>Featured Products</h2>",
                  "alignment": "left",
                  "type_preset": "h2"
                }
              }
            },
            "block_order": ["title_block"]
          },
          "static-product-card": {
            "type": "_product-card",
            "name": "Product Card",
            "static": true,
            "settings": { "product_card_gap": 4, "padding-block-start": 0, "padding-block-end": 0 },
            "blocks": {
              "gallery": { "type": "_product-card-gallery", "name": "Media", "settings": { "image_ratio": "adapt" } },
              "title": { "type": "product-title", "name": "Title", "settings": { "alignment": "left", "type_preset": "rte" } },
              "price": { "type": "price", "name": "Price", "settings": { "type_preset": "h6", "alignment": "left" } }
            },
            "block_order": ["gallery", "title", "price"]
          }
        },
        "settings": {
          "collection": "all",
          "layout_type": "grid",
          "max_products": 8,
          "columns": 4,
          "mobile_columns": "2",
          "color_scheme": "scheme-1",
          "section_width": "page-width",
          "padding-block-start": 48,
          "padding-block-end": 48
        }
      }
    },
    "order": ["hero_main", "marquee_brand", "featured_product", "product_list"]
  };

  const r1 = await req('PUT', '/themes/140905709667/assets.json', {
    asset: { key: 'templates/index.json', value: JSON.stringify(homepage) }
  });
  console.log(`  首页模板: ${r1.asset ? '✅ 写入成功' : '❌ 失败: ' + JSON.stringify(r1.errors)}`);

  // ============================================================
  // 2. 主题配色 — 科技感深色系
  // ============================================================
  console.log('\n=== 2. 更新配色方案 ===');
  // Read current settings
  const cur = await req('GET', '/themes/140905709667/assets.json?asset%5Bkey%5D=config%2Fsettings_data.json');
  if (cur.asset) {
    let cfg = JSON.parse(cur.asset.value);
    // Update color schemes
    if (cfg.current && cfg.current.colors_scheme) {
      // scheme-1 (default background)
      if (cfg.current.colors_scheme.scheme_1) {
        cfg.current.colors_scheme.scheme_1.color_scheme_bg = '#0a0a0f';
        cfg.current.colors_scheme.scheme_1.color_scheme_heading_foreground = '#ffffff';
        cfg.current.colors_scheme.scheme_1.color_scheme_foreground = '#cccccc';
        cfg.current.colors_scheme.scheme_1.color_scheme_accent_1 = '#00d4ff';
        cfg.current.colors_scheme.scheme_1.color_scheme_accent_2 = '#00ff88';
      }
      // scheme-2 (marquee/accent)
      if (cfg.current.colors_scheme.scheme_2) {
        cfg.current.colors_scheme.scheme_2.color_scheme_bg = '#00d4ff';
        cfg.current.colors_scheme.scheme_2.color_scheme_foreground = '#0a0a0f';
      }
      // scheme-6 (hero overlay)
      if (cfg.current.colors_scheme.scheme_6) {
        cfg.current.colors_scheme.scheme_6.color_scheme_bg = '#1a1a2e';
        cfg.current.colors_scheme.scheme_6.color_scheme_heading_foreground = '#ffffff';
        cfg.current.colors_scheme.scheme_6.color_scheme_foreground = '#e0e0e0';
      }
    }
    const r2 = await req('PUT', '/themes/140905709667/assets.json', {
      asset: { key: 'config/settings_data.json', value: JSON.stringify(cfg) }
    });
    console.log(`  配色方案: ${r2.asset ? '✅ 更新成功' : '❌ 失败'}`);
  } else {
    console.log('  ⚠️ 无法读取当前配色配置');
  }

  // ============================================================
  // 3. 导航菜单 — 创建主菜单
  // ============================================================
  console.log('\n=== 3. 创建导航菜单 ===');
  // First check existing menus
  const existing = await req('GET', '/menus.json');
  const menusList = existing.menus || [];
  
  // Check if main-menu exists
  const mainMenu = menusList.find(m => m.handle === 'main-menu');
  if (mainMenu) {
    const r3 = await req('PUT', `/menus/${mainMenu.id}.json`, {
      menu: {
        id: mainMenu.id,
        items: [
          { title: 'Home', url: '/' },
          { title: 'AI Translation Glasses', url: '/products/ai-smart-translation-glasses' },
          { title: 'About Us', url: '/pages/about-us' },
          { title: 'FAQ', url: '/pages/faq' },
          { title: 'Contact', url: '/pages/contact-us' }
        ]
      }
    });
    console.log(`  主菜单更新: ${r3.menu ? '✅' : '❌'}`);
  } else {
    // Create new main-menu
    const r3 = await req('POST', '/menus.json', {
      menu: {
        handle: 'main-menu',
        title: 'Main Menu',
        items: [
          { title: 'Home', url: '/' },
          { title: 'AI Translation Glasses', url: '/products/ai-smart-translation-glasses' },
          { title: 'About Us', url: '/pages/about-us' },
          { title: 'FAQ', url: '/pages/faq' },
          { title: 'Contact', url: '/pages/contact-us' }
        ]
      }
    });
    console.log(`  主菜单创建: ${r3.menu ? '✅' : '❌ ' + JSON.stringify(r3.errors)}`);
  }

  // Footer menu
  const footerMenu = menusList.find(m => m.handle === 'footer');
  if (footerMenu) {
    await req('PUT', `/menus/${footerMenu.id}.json`, {
      menu: {
        id: footerMenu.id,
        items: [
          { title: 'Refund Policy', url: '/pages/refund-policy' },
          { title: 'Terms of Service', url: '/pages/terms-of-service' },
          { title: 'Contact Us', url: '/pages/contact-us' }
        ]
      }
    });
    console.log('  Footer菜单: ✅ 更新');
  } else {
    await req('POST', '/menus.json', {
      menu: { handle: 'footer', title: 'Footer Menu', items: [
        { title: 'Refund Policy', url: '/pages/refund-policy' },
        { title: 'Terms of Service', url: '/pages/terms-of-service' },
        { title: 'Contact Us', url: '/pages/contact-us' }
      ]}
    });
    console.log('  Footer菜单: ✅ 创建');
  }

  // ============================================================
  // 4. 店铺名称更新
  // ============================================================
  console.log('\n=== 4. 店铺名称 ===');
  const shopInfo = await req('GET', '/shop.json');
  console.log(`  当前名称: ${shopInfo.shop.name}`);

  // ============================================================
  // 5. 最终验证
  // ============================================================
  console.log('\n=== 5. 最终验证 ===');
  const pages = await req('GET', '/pages.json?limit=50');
  console.log(`  页面: ${pages.pages.filter(p=>p.published).length}/${pages.pages.length} 已发布`);
  const prods = await req('GET', '/products.json?limit=10');
  for (const p of prods.products) {
    console.log(`  产品: ${p.title} | $${p.variants?.[0]?.price} | 图片: ${p.images?.length||0}张`);
  }
  const menus = await req('GET', '/menus.json');
  for (const m of menus.menus || []) {
    console.log(`  菜单: ${m.title} (${m.handle}) — ${m.items?.length||0} 项`);
    m.items?.forEach(item => console.log(`    → ${item.title}: ${item.url}`));
  }
  const home = await req('GET', '/themes/140905709667/assets.json?asset%5Bkey%5D=templates%2Findex.json');
  const secs = home.asset ? Object.keys(JSON.parse(home.asset.value).sections||{}) : [];
  console.log(`  首页区块: ${secs.join(', ')}`);

  console.log('\n✅ 设计完成！访问: https://aigenie-hub.myshopify.com/');
}
main().catch(console.error);
