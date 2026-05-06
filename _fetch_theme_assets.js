const API = require('./lib/shopify-api');
const fs = require('fs');
const T = 140905709667;

async function main() {
  const outDir = '_theme_backup';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const keys = [
    'layout/theme.liquid',
    'config/settings_data.json',
    'templates/index.json',
    'sections/hero.liquid',
    'sections/header.liquid',
    'sections/footer.liquid',
    'sections/featured-product.liquid',
    'sections/media-with-content.liquid',
    'sections/marquee.liquid',
    'sections/slideshow.liquid',
  ];

  for (const key of keys) {
    try {
      const data = await API.getThemeAsset(T, key);
      const value = data.asset.value || data.asset.attachment;
      const filename = key.replace(/\//g, '-');
      fs.writeFileSync(`${outDir}/${filename}`, value || '(binary)');
      console.log(`✅ ${key} (${(value||'').length} chars)`);
    } catch(e) {
      console.log(`❌ ${key}: ${e.message?.slice(0,80)}`);
    }
  }
}

main().catch(console.error);
