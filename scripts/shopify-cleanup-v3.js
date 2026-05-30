const https = require('https');
const TOKEN = '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';
const STORE = 'aigenie-hub.myshopify.com';
const COLLECTIONS = {
  ELECTRONICS: 296891809891,
  TECH_GEAR: 296831320163,
  AI_WORKFLOWS: 296831221859,
  DEV_TOOLS: 296831254627,
  DIGITAL_GUIDES: 296831287395,
  HOME_PAGE: 296819097699
};

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const buf = body ? Buffer.from(JSON.stringify(body), 'utf-8') : null;
    const opts = {
      hostname: 'aigenie-hub.myshopify.com',
      path: `/admin/api/2024-04${path}`,
      method,
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
  console.log('📦 获取数据...');
  const r = await api('GET', '/products.json?limit=50');
  const products = r.data.products || [];
  const cr = await api('GET', '/custom_collections.json?limit=20');
  const collections = cr.data.custom_collections || [];
  const colr = await api('GET', '/collects.json?limit=250');
  const collects = colr.data.collects || [];

  console.log(`   产品: ${products.length}, 集合: ${collections.length}, 分配: ${collects.length}`);

  // ── 分组重复产品 ──
  const groups = {};
  for (const p of products) {
    const key = p.title.slice(0, 40);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const toDelete = []; // { id, title }
  for (const [name, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    // 保留第一个（ID最小=最旧），删后面的
    group.sort((a, b) => a.id - b.id);
    const kept = group.shift();
    for (const dup of group) {
      toDelete.push({ id: dup.id, title: dup.title });
    }
    console.log(`\n  📌 保留: [${kept.id}] ${kept.title.slice(0, 50)}`);
    for (const dup of group) {
      console.log(`  🗑️ 删除: [${dup.id}] ${dup.title.slice(0, 50)}`);
    }
  }

  // ── 先删 collects ──
  console.log('\n1️⃣ 清理关联 (collects)...');
  for (const d of toDelete) {
    const related = collects.filter(c => c.product_id === d.id);
    for (const c of related) {
      const r2 = await api('DELETE', `/collects/${c.id}`);
      if (r2.status === 200) console.log(`   🗑️ collect ${c.id} (product ${d.id})`);
      else console.log(`   ⚠️ collect ${c.id} → ${r2.status}`);
    }
  }

  // ── 删除产品 ──
  console.log('\n2️⃣ 删除重复产品...');
  for (const d of toDelete) {
    const r2 = await api('DELETE', `/products/${d.id}`);
    if (r2.status === 200) console.log(`   ✅ [${d.id}] ${d.title.slice(0, 40)}`);
    else console.log(`   ⚠️ [${d.id}] → ${r2.status}: ${typeof r2.data === 'string' ? r2.data.slice(0, 100) : JSON.stringify(r2.data).slice(0, 100)}`);
  }

  // ── AI 眼镜 ──
  console.log('\n3️⃣ AI Smart Translation Glasses 颜色选项...');
  const glasses = products.find(p => p.title.includes('AI Smart Translation Glasses'));
  if (glasses) {
    console.log(`   产品ID: ${glasses.id}, 当前选项: ${JSON.stringify(glasses.options[0]?.values)}`);

    // 先更新 options
    const colors = ['Matte Black', 'Glossy White', 'Transparent Smoke', 'Tortoise Shell'];
    const upOpts = await api('PUT', `/products/${glasses.id}`, {
      product: { id: glasses.id, options: [{ name: 'Color', values: colors, position: 1 }] }
    });
    console.log(`   更新 options: ${upOpts.status}`);

    // 等一秒让 Shopify 处理
    await new Promise(r => setTimeout(r, 1000));

    // 获取当前变体
    const g2 = await api('GET', `/products/${glasses.id}.json`);
    const currentVariants = g2.data.product?.variants || [];

    if (currentVariants.length === 0) {
      // 没有变体，直接创建
      for (const color of colors) {
        const r3 = await api('POST', `/products/${glasses.id}/variants`, {
          variant: { product_id: glasses.id, option1: color, price: '129.99', inventory_management: 'shopify', inventory_quantity: 100 }
        });
        console.log(`   创建 ${color}: ${r3.status}${r3.status === 201 ? ' ✅' : ' ❌'}`);
      }
    } else if (currentVariants.length === 1) {
      // 只有一个变体，更新它
      const v = currentVariants[0];
      const r3 = await api('PUT', `/variants/${v.id}`, {
        variant: { id: v.id, option1: 'Matte Black', price: '129.99', inventory_quantity: 100 }
      });
      console.log(`   更新 Matte Black: ${r3.status}${r3.status === 200 ? ' ✅' : ''}`);

      // 创建其余颜色
      for (let i = 1; i < colors.length; i++) {
        const r4 = await api('POST', `/products/${glasses.id}/variants`, {
          variant: { product_id: glasses.id, option1: colors[i], price: '129.99', inventory_management: 'shopify', inventory_quantity: 100 }
        });
        console.log(`   创建 ${colors[i]}: ${r4.status}${r4.status === 201 ? ' ✅' : r4.status === 303 ? ' 🔄' : ' ❌'}`);
      }
    } else {
      // 多个变体，逐个处理
      console.log(`   已有 ${currentVariants.length} 个变体`);
    }

    // 最终确认
    const g3 = await api('GET', `/products/${glasses.id}.json`);
    const finalVariants = g3.data.product?.variants || [];
    console.log(`\n   最终变体数: ${finalVariants.length}`);
    for (const v of finalVariants) {
      console.log(`     - ${v.option1}: $${v.price} (qty: ${v.inventory_quantity})`);
    }
  }

  console.log('\n✅ 完成！');
}
main().catch(e => console.error('❌', e));
