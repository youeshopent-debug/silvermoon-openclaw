const api = require('./lib/shopify-api');

(async () => {
  try {
    // 1. 查 Main menu
    const resp = await api.graphql(`{menus(first:10){edges{node{id title items{id title url type}}}}}`);
    const menus = resp.data.menus.edges;
    const mainMenu = menus.find(e => e.node.title === 'Main menu');
    if (!mainMenu) { console.log('Main menu not found'); return; }

    const menuId = mainMenu.node.id;
    console.log('Found Main menu:', menuId);

    // 2. 美杜莎导航结构（8项）
    const newItems = [
      { title: "Home", url: "https://aigenie-hub.myshopify.com/", type: "HTTP" },
      { title: "AI Workflows", url: "https://aigenie-hub.myshopify.com/collections/ai-workflows", type: "HTTP" },
      { title: "Developer Tools", url: "https://aigenie-hub.myshopify.com/collections/developer-tools", type: "HTTP" },
      { title: "Digital Guides", url: "https://aigenie-hub.myshopify.com/collections/digital-guides", type: "HTTP" },
      { title: "Tech Gear", url: "https://aigenie-hub.myshopify.com/collections/tech-gear", type: "HTTP" },
      { title: "About Us", url: "https://aigenie-hub.myshopify.com/pages/about-us", type: "HTTP" },
      { title: "FAQ", url: "https://aigenie-hub.myshopify.com/pages/faq", type: "HTTP" },
      { title: "Contact", url: "https://aigenie-hub.myshopify.com/pages/contact", type: "HTTP" }
    ];

    const itemsStr = newItems.map(it =>
      `{title: "${it.title}", url: "${it.url}", type: ${it.type}}`
    ).join(',');

    const mutation = `mutation { menuUpdate(id: "${menuId}", title: "Main menu", items: [${itemsStr}]) { menu { id title items { id title url type } } userErrors { field message } } }`;

    console.log('Updating nav...');
    const result = await api.graphql(mutation);
    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.data?.menuUpdate?.userErrors?.length > 0) {
      console.log('UserErrors:', JSON.stringify(result.data.menuUpdate.userErrors));
    } else {
      const items = result.data?.menuUpdate?.menu?.items || [];
      console.log('SUCCESS! New nav items:', items.map(i => i.title).join(' | '));
    }
  } catch (e) {
    console.error('Error:', e);
  }
})();
