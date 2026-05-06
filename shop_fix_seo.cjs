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
  // 1. 读取当前产品验证
  const prod = await shopify('products/8005574623331.json');
  const p = prod.product;
  console.log('=== 当前 SEO 状态 ===');
  console.log('Title Tag:', p.metafields_global_title_tag || '❌ 未设置');
  console.log('Meta Desc:', p.metafields_global_description_tag || '❌ 未设置');

  // 2. 如果没设置，通过 metafields API 写入
  if (!p.metafields_global_title_tag || !p.metafields_global_description_tag) {
    console.log('\n通过 Metafields API 修复 SEO...');

    // 获取已有的 metafields
    const mfs = await shopify('products/8005574623331/metafields.json');
    console.log('已有 Metafields:', mfs.metafields.length);

    // 查找是否有 seo 相关的 metafield
    const seoMfs = mfs.metafields.filter(m => m.namespace === 'global');
    console.log('global namespace metafields:', seoMfs.length);

    // 删除旧的 global title/description metafields（如果有冲突）
    for (const m of seoMfs) {
      if (['title_tag', 'description_tag'].includes(m.key)) {
        console.log('删除旧 metafield:', m.key);
        await shopify(`products/8005574623331/metafields/${m.id}.json`, 'DELETE');
      }
    }

    // 写入 title_tag
    const titleRes = await shopify('products/8005574623331/metafields.json', 'POST', {
      metafield: {
        namespace: 'global',
        key: 'title_tag',
        value: 'AI Smart Translation Glasses | Real-Time Translator 100+ Languages',
        type: 'single_line_text_field'
      }
    });
    console.log('Title Tag 写入:', titleRes.metafield?.id ? '✅' : '❌');

    // 写入 description_tag
    const descRes = await shopify('products/8005574623331/metafields.json', 'POST', {
      metafield: {
        namespace: 'global',
        key: 'description_tag',
        value: 'Break language barriers instantly. AI-powered smart glasses with real-time translation in 100+ languages, 48h battery, 32g ultra-light design. Shop now.',
        type: 'single_line_text_field'
      }
    });
    console.log('Meta Desc 写入:', descRes.metafield?.id ? '✅' : '❌');
  }

  console.log('\n🎯 SEO 修复完成！');
}

main().catch(console.error);
