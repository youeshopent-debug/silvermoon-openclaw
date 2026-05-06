import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';
const BASE = `https://${S}`;

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

async function main() {
  // Build menu items with URL type
  const mainItems = [
    { title: "Home", url: `${BASE}/`, type: "FRONTPAGE" },
    { title: "AI Translation Glasses", url: `${BASE}/products/ai-smart-translation-glasses`, type: "HTTP" },
    { title: "About Us", url: `${BASE}/pages/about-us`, type: "HTTP" },
    { title: "FAQ", url: `${BASE}/pages/faq`, type: "HTTP" },
    { title: "Contact", url: `${BASE}/pages/contact-us`, type: "HTTP" }
  ];
  const footerItems = [
    { title: "Refund Policy", url: `${BASE}/pages/refund-policy`, type: "HTTP" },
    { title: "Terms of Service", url: `${BASE}/pages/terms-of-service`, type: "HTTP" },
    { title: "Contact Us", url: `${BASE}/pages/contact-us`, type: "HTTP" },
    { title: "About Us", url: `${BASE}/pages/about-us`, type: "HTTP" }
  ];

  function buildMutation(id, title, items) {
    const itemsStr = items.map(i =>
      `{title: "${i.title}", url: "${i.url}", type: ${i.type}}`
    ).join('\n');
    return `mutation {
      menuUpdate(id: "${id}", title: "${title}", items: [${itemsStr}]) {
        menu { id title items { title url } }
        userErrors { field message }
      }
    }`;
  }

  console.log('=== 更新 Main Menu ===');
  const r1 = await gql(buildMutation("gid://shopify/Menu/220493578339", "Main menu", mainItems));
  const mu = r1.data?.menuUpdate;
  if (mu?.userErrors?.length) console.log('  ❌', JSON.stringify(mu.userErrors));
  else if (mu?.menu) { console.log('  ✅ Main Menu:'); mu.menu.items.forEach(i => console.log(`    → ${i.title}: ${i.url}`)); }
  else console.log('  ⚠️', JSON.stringify(r1).slice(0, 400));

  console.log('\n=== 更新 Footer Menu ===');
  const r2 = await gql(buildMutation("gid://shopify/Menu/220493611107", "Footer menu", footerItems));
  const fu = r2.data?.menuUpdate;
  if (fu?.userErrors?.length) console.log('  ❌', JSON.stringify(fu.userErrors));
  else if (fu?.menu) { console.log('  ✅ Footer Menu:'); fu.menu.items.forEach(i => console.log(`    → ${i.title}: ${i.url}`)); }
  else console.log('  ⚠️', JSON.stringify(r2).slice(0, 400));

  // Verify
  console.log('\n=== 验证 ===');
  const v = await gql(`{ menus(first:5) { edges { node { id title handle items { title url } } } } }`);
  for (const e of v.data.menus.edges) {
    const m = e.node;
    console.log(`${m.title} (${m.handle}):`);
    m.items.forEach(i => console.log(`  → ${i.title}: ${i.url}`));
  }
  console.log('\n✅ 导航菜单搞定！');
}
main().catch(console.error);
