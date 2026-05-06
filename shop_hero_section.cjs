const https = require('https');
const token = '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';
const store = 'aigenie-hub.myshopify.com';
const themeId = '140905709667';

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
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Upload hero background image
  console.log('Uploading hero background image...');
  const uploadResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/hero-bg.jpg', src: 'https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80' }
  });
  console.log('Hero image:', uploadResult.asset ? uploadResult.asset.public_url : 'FAILED');

  // Build homepage template - clean version
  const tmpl = {
    sections: {
      hero_banner: {
        type: 'hero',
        blocks: {
          heading: {
            type: 'text',
            settings: { text: '<h1>AI Smart Translation Glasses</h1>', type_preset: 'h1', max_width: 'narrow' }
          },
          subtitle: {
            type: 'text',
            settings: { text: '<p>Real-time translation in 100+ languages. Crystal-clear OLED display. 48-hour battery life. The future of communication is here.</p>', type_preset: 'body', max_width: 'narrow', padding_block_end: 32 }
          },
          cta: {
            type: 'button',
            settings: { label: 'Shop Now — $129.99', link: '/products/ai-smart-translation-glasses', style: 'solid', color_scheme: 'accent-1' }
          }
        },
        block_order: ['heading', 'subtitle', 'cta'],
        settings: {
          horizontal_alignment_flex_direction_column: 'center',
          vertical_alignment_flex_direction_column: 'center',
          gap: 16,
          section_height: 'large',
          color_scheme: 'scheme-6',
          padding_block_start: 80,
          padding_block_end: 80,
          toggle_overlay: true,
          overlay_style: 'gradient'
        }
      },
      marquee_bar: {
        type: 'marquee',
        blocks: {
          item1: { type: 'text', settings: { text: '<p>FREE SHIPPING WORLDWIDE</p>', type_preset: 'body' } },
          item2: { type: 'text', settings: { text: '<p>30-DAY MONEY BACK GUARANTEE</p>', type_preset: 'body' } },
          item3: { type: 'text', settings: { text: '<p>AI-POWERED REAL-TIME TRANSLATION</p>', type_preset: 'body' } },
          item4: { type: 'text', settings: { text: '<p>1-CLICK CHECKOUT WITH SHOP PAY</p>', type_preset: 'body' } }
        },
        block_order: ['item1', 'item2', 'item3', 'item4'],
        settings: { color_scheme: 'scheme-6', padding_block_start: 24, padding_block_end: 24, full_width: true }
      },
      product_showcase: {
        type: 'featured-product',
        settings: { product: 'ai-smart-translation-glasses', color_scheme: 'scheme-6', media_size: 'large', padding_block_start: 64, padding_block_end: 48 }
      },
      why_section: {
        type: 'product-list',
        settings: { heading: 'Why AI Smart Translation Glasses?', max_products: 1, layout_type: 'grid', columns: 1, color_scheme: 'scheme-6', padding_block_start: 48, padding_block_end: 64, section_width: 'page-width' }
      }
    },
    order: ['hero_banner', 'marquee_bar', 'product_showcase', 'why_section']
  };

  // Also add the featured product preset blocks manually (same as theme preset)
  // Use the same format as the theme's preset
  tmpl.sections.product_showcase.blocks = {
    media: { type: '_media-without-appearance' },
    'featured-product': {
      type: '_featured-product',
      blocks: {
        title: { type: 'product-title', settings: { type_preset: 'h5', width: '100%' } },
        price: { type: '_featured-product-price' },
        gallery: { type: '_featured-product-gallery' },
        swatches: { type: 'swatches', settings: { hide_padding: true } }
      }
    }
  };
  tmpl.sections.product_showcase.block_order = ['media', 'featured-product'];

  console.log('\nWriting homepage template...');
  const writeResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'templates/index.json', value: JSON.stringify(tmpl, null, 2) }
  });
  if (writeResult.errors) {
    console.error('ERRORS:', JSON.stringify(writeResult.errors, null, 2));
  } else {
    console.log('✅ Homepage template written');
  }

  // Update theme color scheme (scheme_6 = dark tech)
  console.log('\nUpdating theme colors...');
  const settingsData = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=config/settings_data.json');
  const settings = JSON.parse(settingsData.asset.value);

  settings.current.colors_scheme.scheme_6 = {
    background: '#010102',
    background_gradient: '',
    text: '#f7f8f8',
    text_secondary: '#8a8f98',
    heading: '#ffffff',
    button: '#36F4A4',
    button_text: '#000000',
    secondary_button: '#23252a',
    secondary_button_text: '#f7f8f8',
    shadow: 'rgba(255,255,255,0.04)'
  };

  const settingsResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'config/settings_data.json', value: JSON.stringify(settings) }
  });
  console.log('Theme colors:', settingsResult.errors ? 'FAILED: ' + JSON.stringify(settingsResult.errors) : '✅ Updated');

  console.log('\n🎯 Complete! Visit: https://aigenie-hub.myshopify.com/');
}

main().catch(console.error);
