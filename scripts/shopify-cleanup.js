const https = require('https');
const TOKEN = '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';
const STORE = 'aigenie-hub.myshopify.com';

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const buf = body ? Buffer.from(JSON.stringify(body), 'utf-8') : null;
    const opts = {
      hostname: STORE, path: `/admin/api/2024-04${path}`, method,
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Length'] = buf.length;
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (buf) req.write(buf);
    req.end();
  });
}

async function main() {
  // 1. 获取所有数据
  console.log('1️⃣ 获取数据...');
  const prod = await api('GET', '/products.json?limit=50');
  const products = prod.data.products || [];
  const coll = await api('GET', '/custom_collections.json?limit=20');
  const collections = coll.data.custom_collections || [];

  console.log(`   产品: ${products.length}`);
  console.log(`   集合: ${collections.map(c => `"${c.title}"(${c.id})`).join(', ')}`);

  // 确认集合的实际名字
  const electronicsColl = collections.find(c => c.title.includes('Electronics'));
  const techGearColl = collections.find(c => c.title === 'Tech Gear');

  // 2. 更新 AI 眼镜颜色选项 —— 不能先删变体，要保留一个
  console.log('\n2️⃣ 更新 AI Smart Translation Glasses...');
  const glasses = products.find(p => p.title.includes('AI Smart Translation Glasses'));
  if (glasses) {
    const colors = ['Matte Black', 'Glossy White', 'Transparent Smoke', 'Tortoise Shell'];
    const oldVariants = glasses.variants || [];
    console.log(`   旧变体: ${oldVariants.length} 个`);

    // 先更新产品 options
    const up = await api('PUT', `/products/${glasses.id}`, {
      product: { id: glasses.id, options: [{ name: 'Color', values: colors, position: 1 }] }
    });
    console.log(`   更新选项: ${up.status}${up.status === 200 ? ' ✅' : ' ❌'}`);

    // 更新第一个旧变体为 Matte Black
    if (oldVariants.length > 0) {
      const v1 = await api('PUT', `/variants/${oldVariants[0].id}`, {
        variant: { id: oldVariants[0].id, option1: 'Matte Black', price: '129.99', inventory_quantity: 100 }
      });
      console.log(`   变体1 (Matte Black): ${v1.status}`);
    }

    // 删除多余的旧变体
    for (let i = 1; i < oldVariants.length; i++) {
      await api('DELETE', `/products/${glasses.id}/variants/${oldVariants[i].id}`);
    }

    // 创建新变体（跳过第一个，已经更新了）
    for (let i = 1; i < colors.length; i++) {
      const r = await api('POST', `/products/${glasses.id}/variants`, {
        variant: { product_id: glasses.id, option1: colors[i], price: '129.99', inventory_management: 'shopify', inventory_quantity: 100 }
      });
      console.log(`   变体${i+1} (${colors[i]}): ${r.status}${r.status === 201 ? ' ✅' : ' ❌'}`);
    }
  }

  // 3. 分配产品到集合
  console.log('\n3️⃣ 分配产品到集合...');
  const collects = await api('GET', '/collects.json?limit=250');
  const collectMap = {};
  (collects.data.collects || []).forEach(c => {
    if (!collectMap[c.product_id]) collectMap[c.product_id] = [];
    collectMap[c.product_id].push(c.collection_id);
  });

  if (!electronicsColl) { console.log('   ❌ Electronics 集合没找到'); }
  else {
    for (const p of products) {
      if (p.status !== 'active') continue;
      const isElec = ['AI Smart Translation Glasses', '3-in-1 AI Translator Earbuds', 'AI Smart Translation Earbuds', 'AI Scan & Translate Pen', 'AI Voice Recorder Pen', 'AI Smart Writing Pad', '6.5-inch Full Screen'].some(k => p.title.startsWith(k));
      if (!isElec) continue;

      if (!(collectMap[p.id] || []).includes(electronicsColl.id)) {
        const r = await api('POST', '/collects.json', { collect: { product_id: p.id, collection_id: electronicsColl.id } });
        console.log(`   ${p.title.slice(0, 35)}... → Electronics: ${r.status}`);
      } else { console.log(`   ℹ️ ${p.title.slice(0, 35)}... 已在 Electronics`); }

      if (techGearColl && !(collectMap[p.id] || []).includes(techGearColl.id)) {
        const r = await api('POST', '/collects.json', { collect: { product_id: p.id, collection_id: techGearColl.id } });
        console.log(`   ${p.title.slice(0, 35)}... → Tech Gear: ${r.status}`);
      }
    }
  }

  console.log('\n✅ 完成！');
}
main().catch(e => console.error('❌', e));
