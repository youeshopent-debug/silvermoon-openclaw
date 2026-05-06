import https from 'https';
const T = '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';
const S = 'aigenie-hub.myshopify.com';

function gql(query, vars = {}) {
  return new Promise((ok, no) => {
    const body = JSON.stringify({ query, variables: vars });
    const opts = {
      hostname: S, path: '/admin/api/2025-07/graphql.json', method: 'POST',
      headers: { 'X-Shopify-Access-Token': T, 'Content-Type': 'application/json' }
    };
    const r = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => ok(JSON.parse(d))); });
    r.on('error', no); r.write(body); r.end();
  });
}

async function main() {
  // Main menu: items as direct array
  console.log('=== 更新 Main Menu ===');
  const r1 = await gql(`
    mutation {
      menuUpdate(
        id: "gid://shopify/Menu/220493578339"
        title: "Main menu"
        items: [
          { title: "Home", url: "/" }
          { title: "AI Translation Glasses", url: "/products/ai-smart-translation-glasses" }
          { title: "About Us", url: "/pages/about-us" }
          { title: "FAQ", url: "/pages/faq" }
          { title: "Contact", url: "/pages/contact-us" }
        ]
      ) {
        menu { id title items { title url } }
        userErrors { field message }
      }
    }
  `);
  const mu = r1.data?.menuUpdate;
  if (mu?.userErrors?.length) {
    console.log('  ❌', JSON.stringify(mu.userErrors));
  } else if (mu?.menu) {
    console.log('  ✅ Main Menu:');
    mu.menu.items.forEach(i => console.log(`    → ${i.title}: ${i.url}`));
  } else {
    console.log('  ⚠️', JSON.stringify(r1).slice(0, 400));
  }

  // Footer menu
  console.log('\n=== 更新 Footer Menu ===');
  const r2 = await gql(`
    mutation {
      menuUpdate(
        id: "gid://shopify/Menu/220493611107"
        title: "Footer menu"
        items: [
          { title: "Refund Policy", url: "/pages/refund-policy" }
          { title: "Terms of Service", url: "/pages/terms-of-service" }
          { title: "Contact Us", url: "/pages/contact-us" }
          { title: "About Us", url: "/pages/about-us" }
        ]
      ) {
        menu { id title items { title url } }
        userErrors { field message }
      }
    }
  `);
  const fu = r2.data?.menuUpdate;
  if (fu?.userErrors?.length) {
    console.log('  ❌', JSON.stringify(fu.userErrors));
  } else if (fu?.menu) {
    console.log('  ✅ Footer Menu:');
    fu.menu.items.forEach(i => console.log(`    → ${i.title}: ${i.url}`));
  } else {
    console.log('  ⚠️', JSON.stringify(r2).slice(0, 400));
  }

  // Verify
  console.log('\n=== 最终验证 ===');
  const v = await gql(`{ menus(first:5) { edges { node { id title handle items { title url } } } } }`);
  for (const e of v.data.menus.edges) {
    const m = e.node;
    console.log(`\n📋 ${m.title} (${m.handle}):`);
    m.items.forEach(i => console.log(`  → ${i.title}: ${i.url}`));
  }
}
main().catch(console.error);
