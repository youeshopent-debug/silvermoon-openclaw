const ShopifyAPI = require('./lib/shopify-api');
const THEME_ID = 140905709667; // Horizon

async function main() {
  try {
    // 1. Get theme.liquid structure
    console.log('=== theme.liquid ===');
    const theme = await ShopifyAPI.getThemeAsset(THEME_ID, 'layout/theme.liquid');
    const content = theme.asset.value;
    // Check if there's a </head> tag to inject CSS
    console.log('Has </head>:', content.includes('</head>'));
    console.log('Liquid length:', content.length);
    // Show last 100 chars to see structure
    console.log('Tail:', content.slice(-200));

    // 2. Get settings_data.json (theme settings)
    console.log('\n=== settings_data.json ===');
    let settings;
    try {
      settings = await ShopifyAPI.getThemeAsset(THEME_ID, 'config/settings_data.json');
      const parsed = JSON.parse(settings.asset.value);
      const currentPreset = parsed.current;
      console.log('Current preset:', currentPreset ? 'present' : 'none');
      // Show colors
      if (currentPreset) {
        const colorKeys = Object.keys(currentPreset).filter(k => k.startsWith('color') || k.startsWith('gradient'));
        console.log('Color settings:', colorKeys.slice(0, 20));
      }
    } catch(e) {
      console.log('No settings_data.json:', e.message?.slice(0, 100));
    }

    // 3. Get homepage sections (index.json)
    console.log('\n=== sections/index.json (homepage) ===');
    try {
      const sections = await ShopifyAPI.getThemeAsset(THEME_ID, 'sections/index.json');
      console.log('Content:', sections.asset.value?.slice(0, 500));
    } catch(e) {
      // Template-based, try templates/index.json
      console.log('No sections/index.json, trying templates...');
    }

    // 4. Get template info
    console.log('\n=== templates ===');
    const assets = await ShopifyAPI.listThemeAssets(THEME_ID);
    const templates = assets.assets.filter(a => a.key.startsWith('templates/'));
    const sections = assets.assets.filter(a => a.key.startsWith('sections/'));
    console.log('Templates:', templates.map(t => t.key).join(', '));
    console.log('Sections:', sections.map(s => s.key).join(', '));

    // 5. Get homepage template
    try {
      const indexJSON = await ShopifyAPI.getThemeAsset(THEME_ID, 'templates/index.json');
      console.log('\n=== templates/index.json ===');
      console.log(indexJSON.asset.value?.slice(0, 1000));
    } catch(e) {
      try {
        const indexLiquid = await ShopifyAPI.getThemeAsset(THEME_ID, 'templates/index.liquid');
        console.log('\n=== templates/index.liquid ===');
        console.log(indexLiquid.asset.value?.slice(0, 1000));
      } catch(e2) {
        console.log('No index template found');
      }
    }
  } catch (err) {
    console.error('❌ 失败:', JSON.stringify(err, null, 2));
  }
}

main();
