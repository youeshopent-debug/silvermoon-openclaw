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
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ _error: e.message, _raw: d.slice(0,300) }); }});
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  // ── 1. 获取主主题ID ──
  const themesRes = await req('GET', '/themes.json');
  const mainTheme = themesRes.themes.find(t => t.role === 'main');
  if (!mainTheme) { console.log('❌ 找不到主主题'); return; }
  console.log(`📦 主题: ${mainTheme.name} (ID: ${mainTheme.id})`);

  // ── 2. 读首页 JSON 模板 ──
  const tmplRes = await req('GET', `/themes/${mainTheme.id}/assets.json?asset[key]=templates/index.json`);
  const tmplKey = `templates/index.json`;
  let currentTemplate = null;
  
  try {
    const assetRes = await req('GET', `/themes/${mainTheme.id}/assets.json?asset[key]=${encodeURIComponent(tmplKey)}`);
    currentTemplate = assetRes.asset?.value ? JSON.parse(assetRes.asset.value) : null;
    console.log(`📄 当前首页模板: ${currentTemplate ? '已读取' : '空模板'}`);
  } catch(e) {
    // 可能没有 json 模板，用默认
  }

  // ── 3. 生成首页 JSON 区块配置 ──
  const homepageJson = {
    "sections": {
      "announcement_bar": {
        "type": "announcement-bar",
        "settings": {
          "show_announcement": true,
          "announcement_text": "🌏 FREE WORLDWIDE SHIPPING | 30-DAY SATISFACTION GUARANTEE",
          "announcement_link": "/pages/faq",
          "color_bg": "#1a1a2e",
          "color_text": "#ffffff"
        }
      },
      "hero_banner": {
        "type": "image-banner",
        "settings": {
          "image": null,
          "image_overlay_opacity": 0.3,
          "text_color": "#ffffff",
          "content_alignment": "center",
          "desktop_content_position": "middle-center",
          "show_text_below": false,
          "adapt_height_first_image": true,
          "min_height": 500,
          "max_height": 700
        },
        "blocks": {
          "heading": {
            "type": "heading",
            "settings": { "heading": "AI Translation Glasses", "heading_size": "h1" }
          },
          "text": {
            "type": "text",
            "settings": { "text": "Real-time translation in 163 languages. 800W camera. Bluetooth calling. Waterproof. The future of communication is here.", "text_style": "body" }
          },
          "button": {
            "type": "button",
            "settings": { "button_label": "SHOP NOW — $129.99", "button_link": "/products/ai-smart-translation-glasses", "button_style": "primary" }
          }
        },
        "block_order": ["heading", "text", "button"]
      },
      "featured_product": {
        "type": "featured-product",
        "settings": {
          "product": "ai-smart-translation-glasses",
          "show_secondary_image": true,
          "show_vendor": false,
          "show_rating": true,
          "show_price": true,
          "padding_top": 40,
          "padding_bottom": 40
        }
      },
      "rich_text_features": {
        "type": "rich-text",
        "settings": {
          "heading": "Why AIGenie Vision?",
          "text": "<strong>🔊 Real-Time Translation</strong> — 163 languages at your command<br><strong>📸 800W Camera</strong> — Capture moments hands-free<br><strong>🎧 Bluetooth Call</strong> — Crystal clear audio<br><strong>💧 Waterproof</strong> — IPX4 rated for all weather",
          "content_alignment": "center",
          "button_label": "Learn More",
          "button_link": "/pages/about-us",
          "padding_top": 40,
          "padding_bottom": 40
        }
      },
      "footer": {
        "type": "footer",
        "settings": {
          "show_payment_icons": true,
          "show_currency_selector": true,
          "show_language_selector": true
        }
      }
    },
    "order": ["announcement_bar", "hero_banner", "featured_product", "rich_text_features", "footer"]
  };

  // ── 4. 写入首页模板 ──
  const writeRes = await req('PUT', `/themes/${mainTheme.id}/assets.json`, {
    asset: {
      key: tmplKey,
      value: JSON.stringify(homepageJson, null, 2)
    }
  });
  console.log(`✅ 首页模板已写入`);

  // ── 5. 更新主题设置（颜色/字体） ──
  const settingsKey = 'config/settings_data.json';
  let settingsRes;
  try {
    settingsRes = await req('GET', `/themes/${mainTheme.id}/assets.json?asset[key]=${encodeURIComponent(settingsKey)}`);
  } catch(e) {}
  
  if (settingsRes?.asset?.value) {
    let settings = JSON.parse(settingsRes.asset.value);
    // 更新品牌色
    if (settings.current) {
      settings.current.color_schemes = settings.current.color_schemes || {};
      settings.current.color_schemes.scheme_1 = {
        "primary": "#00d4ff",
        "secondary": "#1a1a2e",
        "tertiary": "#0a0a0f",
        "background": "#ffffff",
        "text": "#111111",
        "button": "#00d4ff",
        "button_text": "#111111",
        "accent": "#00ff88"
      };
    }
    
    const writeSettings = await req('PUT', `/themes/${mainTheme.id}/assets.json`, {
      asset: { key: settingsKey, value: JSON.stringify(settings, null, 2) }
    });
    console.log(`✅ 主题配色已更新`);
  }

  // ── 6. 创建主导航菜单 ──
  console.log(`\n🧭 设置导航菜单...`);
  try {
    const menus = await req('GET', '/menus.json');
    const mainMenu = (menus.menus || []).find(m => m.handle === 'main-menu');
    if (mainMenu) {
      await req('PUT', `/menus/${mainMenu.id}.json`, {
        menu: {
          id: mainMenu.id,
          items: [
            { title: 'Home', type: 'page_link', url: '/' },
            { title: 'AI Glasses', type: 'product_link', url: '/products/ai-smart-translation-glasses' },
            { title: 'About', type: 'page_link', url: '/pages/about-us' },
            { title: 'FAQ', type: 'page_link', url: '/pages/faq' },
            { title: 'Contact', type: 'page_link', url: '/pages/contact-us' },
          ]
        }
      });
      console.log(`   ✅ 主导航已更新`);
    }
  } catch(e) {
    console.log(`   ⚠️ 导航: ${e.message?.slice(0,80)}`);
  }

  console.log(`\n🎉 首页装修完成！`);
  console.log(`   前台: https://${SHOP}`);
  console.log(`   后台: https://admin.shopify.com/store/aigenie-hub`);
}

main().catch(e => console.error('❌', e.message));
