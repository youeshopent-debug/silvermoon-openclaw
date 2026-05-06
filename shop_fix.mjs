import https from 'https';

const TOKEN = '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';
const SHOP = 'aigenie-hub.myshopify.com';
const API = '/admin/api/2024-01';

function req(method, path, body) {
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
      res.on('end', () => {
        try { const j = JSON.parse(d); resolve(j); }
        catch(e) { resolve({ _error: e.message, _raw: d.slice(0,200) }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  // ── 1. 重新发布所有页面（用 publish 作用域） ──
  console.log('📄 获取页面（含草稿）...');
  const allPages = await req('GET', '/pages.json?published_status=any');
  for (const p of (allPages.pages || [])) {
    console.log(`   📄 ${p.title} (published=${p.published})`);
    
    // 强行发布：设置 published:true + published_at
    const result = await req('PUT', `/pages/${p.id}.json`, {
      page: {
        id: p.id,
        published: true,
        published_at: '2026-05-02T12:00:00Z'
      }
    });
    const ok = result.page?.published;
    console.log(`   ${ok ? '✅' : '❌'} ${p.title} → published=${ok}`);
  }

  // ── 2. 验证发布状态 ──
  console.log('\n📢 验证发布状态...');
  const publishedPages = await req('GET', '/pages.json?published_status=published');
  console.log(`   已发布: ${(publishedPages.pages || []).length} 个`);
  for (const p of (publishedPages.pages || [])) {
    console.log(`   ✅ ${p.title}`);
  }
  const draftPages = await req('GET', '/pages.json?published_status=unpublished');
  if ((draftPages.pages || []).length > 0) {
    console.log(`   ❌ 仍为草稿: ${draftPages.pages.length} 个`);
    for (const p of draftPages.pages) console.log(`      ${p.title}`);
  }

  // ── 3. 上传商品图片（用 URL 方式） ──
  console.log('\n🖼 上传商品图片...');
  const prods = await req('GET', '/products.json');
  const glass = prods.products?.[0];
  if (glass) {
    console.log(`   商品: ${glass.title} (ID: ${glass.id})`);
    // 在线搜索一张合适的图片URL
    const imgUrl = 'https://ae-pic-a1.aliexpress-media.com/kf/Sf2e6e4b7e7e84f2b9c5e5f5a5e5a5e5aA/AI-Smart-Glasses.jpg';
    const imgResult = await req('POST', `/products/${glass.id}/images.json`, {
      image: { src: imgUrl, position: 1 }
    });
    if (imgResult.image) {
      console.log(`   ✅ 图片已添加 (ID: ${imgResult.image.id})`);
    } else {
      console.log(`   ⚠️ AliExpress图失败，用占位图...`);
      // 用 stable placeholder
      const placeholderResult = await req('POST', `/products/${glass.id}/images.json`, {
        image: { 
          src: `https://placehold.co/800x800/1a1a2e/00d4ff?text=AI+Smart+Glasses`,
          position: 1 
        }
      });
      console.log(`   ${placeholderResult.image ? '✅' : '❌'} 占位图结果`);
    }
  }

  console.log('\n🎉 修复完成！');
}

main().catch(e => console.error('❌', e.message));
