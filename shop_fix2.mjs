import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';

function rest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: S, path: '/admin/api/2024-01' + path, method, headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ _error: e.message }); } }); });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}

function gql(query) {
  return new Promise((ok, no) => {
    const opts = { hostname: S, path: '/admin/api/2025-07/graphql.json', method: 'POST', headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' } };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.on('error', no); r.write(JSON.stringify({ query })); r.end();
  });
}

async function main() {
  console.log('═══ 店铺修复 v2 ═══\n');

  // 1. 修复首页 Hero 区
  console.log('🎨 1. 修复 Hero Banner');
  const homeRes = await rest('GET', '/themes/140905709667/assets.json?asset[key]=templates/index.json');
  const tmpl = JSON.parse(homeRes.asset?.value || '{}');

  // 从产品图中取第一张的 Shopify CDN URL 做 hero
  const prod = await rest('GET', '/products/8005574623331.json');
  const heroUrl = prod.product?.images?.[0]?.src || '';

  tmpl.sections.hero_main.blocks.slide_1.settings = {
    image: heroUrl,
    overlay_opacity: 40,
    heading: 'AI Smart Translation Glasses',
    description: 'Real-time 163-language translation | 800W Camera | Bluetooth | Waterproof Smart Sunglasses',
    button_label: 'Shop Now',
    button_link: '/products/ai-smart-translation-glasses'
  };
  tmpl.sections.hero_main.settings = {
    display_mode: 'full_frame',
    section_width: 'full-width',
    section_height: 'large',
    show_arrows: true,
    show_dots: true,
    color_scheme: 'scheme-6',
    padding_block_top: 0,
    padding_block_bottom: 0
  };

  const r = await rest('PUT', `/themes/140905709667/assets.json`, {
    asset: { key: 'templates/index.json', value: JSON.stringify(tmpl) }
  });
  console.log(`   ${r.asset ? '✅' : '❌'} Hero 图: ${heroUrl.slice(0,60)}...`);

  // 2. 删除旧的 SVG 图片
  console.log('\n🗑  2. 清理旧 SVG 图');
  for (const img of prod.product.images) {
    if (img.src?.endsWith('.svg')) {
      await rest('DELETE', `/products/8005574623331/images/${img.id}`);
      console.log(`   ✅ 已删除 SVG: ${img.id}`);
    }
  }

  // 3. 添加颜色 variants
  console.log('\n🎨 3. 添加颜色选项');
  const colors = ['Matte Black', 'Pearl White', 'Ocean Blue'];
  const variants = colors.map((c, i) => ({
    option1: c,
    price: '129.99',
    compare_at_price: '259.99',
    inventory_management: null,
    requires_shipping: true,
    taxable: true
  }));

  // 先删除旧的 Default Title variant
  for (const v of prod.product.variants) {
    if (v.title === 'Default Title') {
      await rest('DELETE', `/products/8005574623331/variants/${v.id}`);
      console.log(`   🗑 删除 Default variant: ${v.id}`);
    }
  }

  // 更新产品 options
  const upd = await rest('PUT', `/products/8005574623331.json`, {
    product: {
      id: 8005574623331,
      options: [{ name: 'Color', values: colors, position: 1 }],
      variants: variants
    }
  });
  if (upd.product) console.log(`   ✅ 已添加 ${colors.length} 个颜色: ${colors.join(', ')}`);
  else console.log('   ❌', JSON.stringify(upd.errors).slice(0,100));

  // 4. 验证
  console.log('\n═══ 验证 ═══');
  const vProd = await rest('GET', '/products/8005574623331.json');
  console.log(`📦 ${vProd.product?.title}`);
  console.log(`  图片: ${vProd.product?.images?.length} 张`);
  console.log(`  颜色: ${vProd.product?.variants?.length} 个`);
  vProd.product?.variants?.forEach(v => console.log(`   → ${v.title}: $${v.price} (was $${v.compare_at_price})`));

  console.log('\n🎉 完成！');
}
main().catch(e => console.error(e.message));
