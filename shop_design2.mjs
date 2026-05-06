import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const A = '/admin/api/2024-01';
function req(m, p, b = null) {
  return new Promise((ok, no) => {
    const opts = { hostname: S, path: A + p, method: m, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { ok(JSON.parse(d)); } catch(e) { ok({ _raw: d.slice(0,300), _status: res.statusCode }); } }); });
    r.on('error', no); if (b) r.write(JSON.stringify(b)); r.end();
  });
}

async function main() {
  console.log('=== 1. 首页模板（修正 block 类型）===');
  const homepage = {
    sections: {
      hero_main: {
        type: "slideshow",
        blocks: {
          slide_1: {
            type: "_slide",
            settings: {
              image: "",
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
            type: "_product-list-content",
            name: "Our Collection",
            static: true,
            settings: { content_direction: "row", horizontal_alignment: "space-between", vertical_alignment: "center", gap: 12, width: "fill", padding_block_top: 0, padding_block_bottom: 24 },
            blocks: {
              title_block: { type: "_product-list-text", name: "Collection Title", settings: { text: "<h2>Featured Products</h2>", alignment: "left", type_preset: "h2" } }
            },
            block_order: ["title_block"]
          },
          "static-product-card": {
            type: "_product-card", name: "Product Card", static: true,
            settings: { product_card_gap: 4, padding_block_top: 0, padding_block_bottom: 0 },
            blocks: {
              gallery: { type: "_product-card-gallery", name: "Media", settings: { image_ratio: "adapt" } },
              title: { type: "product-title", name: "Title", settings: { alignment: "left", type_preset: "rte" } },
              price: { type: "price", name: "Price", settings: { type_preset: "h6", alignment: "left" } }
            },
            block_order: ["gallery", "title", "price"]
          }
        },
        settings: { collection: "all", layout_type: "grid", max_products: 8, columns: 4, mobile_columns: "2", color_scheme: "scheme-1", section_width: "page-width", padding_block_top: 48, padding_block_bottom: 48 }
      }
    },
    order: ["hero_main", "marquee_brand", "featured_product", "product_list"]
  };

  const r1 = await req('PUT', '/themes/140905709667/assets.json', {
    asset: { key: 'templates/index.json', value: JSON.stringify(homepage) }
  });
  console.log(`  首页模板: ${r1.asset ? '✅' : '❌ ' + JSON.stringify(r1.errors || r1)}`);

  console.log('\n=== 2. 最终验证 ===');
  const pages = await req('GET', '/pages.json?limit=50');
  console.log(`  页面: ${pages.pages.filter(p=>p.published_at).length}/${pages.pages.length} 有 published_at`);
  for (const p of pages.pages) console.log(`    ${p.published_at ? '✅' : '❌'} ${p.title}`);

  const prods = await req('GET', '/products.json?limit=10');
  for (const p of prods.products) console.log(`  产品: ${p.title} | $${p.variants?.[0]?.price} | 图片: ${p.images?.length||0}张 | ${p.status}`);

  const home = await req('GET', '/themes/140905709667/assets.json?asset%5Bkey%5D=templates%2Findex.json');
  const secs = home.asset ? Object.keys(JSON.parse(home.asset.value).sections||{}) : [];
  console.log(`  首页区块: ${secs.join(', ')}`);

  console.log('\n✅ 设计完成！访问: https://aigenie-hub.myshopify.com/');
}
main().catch(console.error);
