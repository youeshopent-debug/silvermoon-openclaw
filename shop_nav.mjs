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
  // 1. Update Main Menu
  console.log('=== 更新 Main Menu ===');
  const mainMenu = await gql(`
    mutation menuUpdate($id: ID!, $menu: MenuUpdateInput!) {
      menuUpdate(id: $id, menu: $menu) {
        menu { id title items { title url } }
        userErrors { field message }
      }
    }
  `, {
    id: "gid://shopify/Menu/220493578339",
    menu: {
      title: "Main menu",
      items: [
        { title: "Home", url: "/" },
        { title: "AI Translation Glasses", url: "/products/ai-smart-translation-glasses" },
        { title: "About Us", url: "/pages/about-us" },
        { title: "FAQ", url: "/pages/faq" },
        { title: "Contact", url: "/pages/contact-us" }
      ]
    }
  });
  console.log('  Raw response:', JSON.stringify(mainMenu).slice(0, 500));
  const mu = mainMenu.data?.menuUpdate;
  if (mu?.userErrors?.length) {
    console.log('  ❌ Errors:', JSON.stringify(mu.userErrors));
  } else if (mu?.menu) {
    console.log('  ✅ Main Menu items:');
    mu.menu.items.forEach(i => console.log(`    → ${i.title} — ${i.url}`));
  } else {
    console.log('  ⚠️ Unexpected response structure');
  }

  // 2. Update Footer Menu
  console.log('\n=== 更新 Footer Menu ===');
  const footerMenu = await gql(`
    mutation menuUpdate($id: ID!, $menu: MenuUpdateInput!) {
      menuUpdate(id: $id, menu: $menu) {
        menu { id title items { title url } }
        userErrors { field message }
      }
    }
  `, {
    id: "gid://shopify/Menu/220493611107",
    menu: {
      title: "Footer menu",
      items: [
        { title: "Refund Policy", url: "/pages/refund-policy" },
        { title: "Terms of Service", url: "/pages/terms-of-service" },
        { title: "Contact Us", url: "/pages/contact-us" },
        { title: "About Us", url: "/pages/about-us" }
      ]
    }
  });
  const fu = footerMenu.data?.menuUpdate;
  if (fu?.userErrors?.length) {
    console.log('  ❌ Errors:', JSON.stringify(fu.userErrors));
  } else {
    console.log('  ✅ Footer Menu items:');
    fu.menu.items.forEach(i => console.log(`    → ${i.title} — ${i.url}`));
  }

  // 3. Verify final state
  console.log('\n=== 最终验证 ===');
  const verify = await gql(`{ menus(first:5) { edges { node { id title handle items { title url } } } } }`);
  for (const edge of verify.data.menus.edges) {
    const m = edge.node;
    console.log(`\n📋 ${m.title} (${m.handle}):`);
    m.items.forEach(i => console.log(`  → ${i.title}: ${i.url}`));
  }
  console.log('\n✅ 导航菜单配置完成！');
}
main().catch(console.error);
