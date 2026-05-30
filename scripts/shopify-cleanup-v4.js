const https = require('https');
const TOKEN = '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';
const HOST = 'aigenie-hub.myshopify.com';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = {
      hostname: HOST, path: '/admin/api/2024-04/graphql.json', method: 'POST',
      headers: {
        'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('Parse failed: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('📦 获取全部产品...');
  let products = [];
  let cursor = null;
  while (true) {
    const q = `query($cursor: String) {
      products(first: 50, after: $cursor) {
        edges { cursor node { id title status options { name values } variants(first: 10) { edges { node { id title selectedOptions { name value } price inventoryQuantity } } } } }
        pageInfo { hasNextPage }
      }
    }`;
    const r = await gql(q, { cursor });
    if (r.errors) { console.error('GraphQL Error:', JSON.stringify(r.errors)); return; }
    const edges = r.data.products.edges;
    products.push(...edges.map(e => ({ ...e.node, gid: e.node.id, id: parseInt(e.node.id.split('/').pop()) })));
    if (!r.data.products.pageInfo.hasNextPage) break;
    cursor = edges[edges.length - 1].cursor;
  }
  console.log(`   产品数: ${products.length}`);

  // ── 分组找重复 ──
  const groups = {};
  for (const p of products) {
    const key = p.title.slice(0, 40);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const toDelete = [];
  for (const [name, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    group.sort((a, b) => a.id - b.id);
    const kept = group.shift();
    console.log(`\n  📌 保留: [${kept.id}] ${kept.title.slice(0, 50)}`);
    for (const dup of group) {
      console.log(`  🗑️ 删除: [${dup.id}] ${dup.title.slice(0, 50)}`);
      toDelete.push(dup);
    }
  }

  // ── 删除重复产品 ──
  console.log('\n1️⃣ 删除重复产品...');
  for (const d of toDelete) {
    const q = `mutation($id: ID!) { productDelete(input: { id: $id }) { deletedProductId userErrors { field message } } }`;
    const r = await gql(q, { id: d.gid });
    const err = r.data?.productDelete?.userErrors;
    if (err && err.length > 0) {
      console.log(`   ❌ [${d.id}] ${err.map(e => e.message).join('; ')}`);
    } else {
      console.log(`   ✅ [${d.id}] ${d.title.slice(0, 40)}`);
    }
  }

  // ── AI 眼镜 ──
  console.log('\n2️⃣ AI Smart Translation Glasses...');
  const glasses = products.find(p => p.title.includes('AI Smart Translation Glasses'));
  if (glasses) {
    const existingVariants = glasses.variants.edges.map(e => e.node);
    const colors = ['Matte Black', 'Glossy White', 'Transparent Smoke', 'Tortoise Shell'];
    console.log(`   当前: ${existingVariants.length} 变体, 选项: ${JSON.stringify(glasses.options)}`);

    // 更新 options
    console.log('   更新颜色选项...');
    const optQ = `mutation($id: ID!, $options: [OptionInput!]!) {
      productUpdate(input: { id: $id, options: $options }) {
        product { id options { name values } }
        userErrors { field message }
      }
    }`;
    const optR = await gql(optQ, {
      id: glasses.gid,
      options: [{ name: 'Color', values: colors, position: 1 }]
    });
    const optErr = optR.data?.productUpdate?.userErrors;
    if (optErr && optErr.length > 0) {
      console.log(`   ❌ ${optErr.map(e => e.message).join('; ')}`);
    } else {
      console.log(`   ✅ ${JSON.stringify(optR.data.productUpdate.product.options)}`);
    }

    // 获取 locations
    const locQ = `query { locations(first: 5) { edges { node { id name } } } }`;
    const locR = await gql(locQ);
    const locations = locR.data?.locations?.edges?.map(e => e.node) || [];
    const locId = locations.length > 0 ? locations[0].id : null;

    // 删除旧变体
    if (existingVariants.length > 0) {
      console.log('   删除旧变体...');
      const oldIds = existingVariants.map(v => v.id);
      const delQ = `mutation($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
          userErrors { field message }
        }
      }`;
      const delR = await gql(delQ, { productId: glasses.gid, variantsIds: oldIds });
      const delErr = delR.data?.productVariantsBulkDelete?.userErrors;
      if (delErr && delErr.length > 0) {
        console.log(`   ⚠️ ${delErr.map(e => e.message).join('; ')}`);
      } else {
        console.log(`   ✅ 已删除 ${oldIds.length} 变体`);
      }
    }

    // 创建新变体
    console.log('   创建新变体...');
    const variantsInput = colors.map(c => ({
      optionValues: [{ optionName: 'Color', name: c }],
      price: '129.99',
      ...(locId ? { inventoryQuantities: [{ locationId: locId, quantity: 100 }] } : {})
    }));
    const createQ = `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants { id selectedOptions { name value } price }
        userErrors { field message }
      }
    }`;
    const createR = await gql(createQ, { productId: glasses.gid, variants: variantsInput });
    const createErr = createR.data?.productVariantsBulkCreate?.userErrors;
    if (createErr && createErr.length > 0) {
      console.log(`   ❌ ${createErr.map(e => e.message).join('; ')}`);
    } else {
      const created = createR.data.productVariantsBulkCreate.productVariants;
      console.log(`   ✅ 已创建 ${created.length} 变体:`);
      created.forEach(v => console.log(`     - ${v.selectedOptions?.map(o => o.value).join(', ')}: $${v.price}`));
    }

    // 最终确认
    const finalQ = `query($id: ID!) {
      product(id: $id) {
        id title options { name values }
        variants(first: 10) { edges { node { id selectedOptions { name value } price inventoryQuantity } } }
      }
    }`;
    const finalR = await gql(finalQ, { id: glasses.gid });
    const final = finalR.data?.product;
    if (final) {
      console.log(`\n   最终状态:`);
      console.log(`   选项: ${JSON.stringify(final.options)}`);
      for (const e of final.variants.edges) {
        const v = e.node;
        console.log(`   - ${v.selectedOptions?.map(o => o.value).join(', ')}: $${v.price} (qty: ${v.inventoryQuantity})`);
      }
    }
  }

  console.log('\n✅ 完成！');
}
main().catch(e => console.error('❌', e));
