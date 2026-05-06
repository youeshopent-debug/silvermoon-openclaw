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
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Step 1: Upload image to Shopify as a file asset
  console.log('Step 1: Uploading hero image...');
  const imgResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: {
      key: 'assets/hero-tech-bg.jpg',
      src: 'https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80'
    }
  });
  const heroUrl = imgResult.asset ? imgResult.asset.public_url : null;
  console.log('Hero image URL:', heroUrl);
  if (!heroUrl) {
    // Upload failed - use inline image
    const imgUpload = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
      asset: {
        key: 'assets/hero-tech-bg.jpg',
        value: new Buffer.from('placeholder').toString('base64'),
        content_type: 'image/jpeg'
      }
    });
    console.log('Fallback upload:', JSON.stringify(imgUpload).substring(0, 200));
  }

  // Step 2: Write clean homepage template
  console.log('\nStep 2: Writing homepage template...');
  const tmpl = {
    sections: {
      hero_banner: {
        type: 'hero',
        blocks: {
          heading: { type: 'text', settings: { text: '<h1>AI Smart Translation Glasses</h1>', type_preset: 'h1', max_width: 'narrow' } },
          subtitle: { type: 'text', settings: { text: '<p>Real-time translation in 100+ languages. Crystal-clear OLED display. 48-hour battery life. The future of communication is here.</p>', type_preset: 'body', max_width: 'narrow', padding_block_end: 32 } },
          cta: { type: 'button', settings: { label: 'Shop Now — $129.99', link: '/products/ai-smart-translation-glasses', style: 'solid', color_scheme: 'accent-1' } }
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
          i1: { type: 'text', settings: { text: '<p>FREE SHIPPING WORLDWIDE</p>', type_preset: 'body' } },
          i2: { type: 'text', settings: { text: '<p>30-DAY MONEY BACK GUARANTEE</p>', type_preset: 'body' } },
          i3: { type: 'text', settings: { text: '<p>AI-POWERED REAL-TIME TRANSLATION</p>', type_preset: 'body' } },
          i4: { type: 'text', settings: { text: '<p>1-CLICK CHECKOUT WITH SHOP PAY</p>', type_preset: 'body' } }
        },
        block_order: ['i1', 'i2', 'i3', 'i4'],
        settings: { color_scheme: 'scheme-6', padding_block_start: 24, padding_block_end: 24, full_width: true }
      },
      product_showcase: {
        type: 'featured-product',
        settings: { product: 'ai-smart-translation-glasses', color_scheme: 'scheme-6', media_size: 'large', padding_block_start: 64, padding_block_end: 48 }
      }
    },
    order: ['hero_banner', 'marquee_bar', 'product_showcase']
  };

  const writeResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'templates/index.json', value: JSON.stringify(tmpl, null, 2) }
  });
  if (writeResult.errors) {
    console.error('TEMPLATE ERRORS:', JSON.stringify(writeResult.errors, null, 2));
  } else {
    console.log('✅ Template written');
  }

  // Step 3: Apply dark tech color scheme
  console.log('\nStep 3: Updating theme colors...');
  const settingData = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=config/settings_data.json');
  const settings = JSON.parse(settingData.asset.value);
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
  await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'config/settings_data.json', value: JSON.stringify(settings) }
  });
  console.log('✅ Colors updated');

  // Step 4: Add custom CSS with hero background image
  console.log('\nStep 4: Adding custom CSS...');
  const customCss = `/* SilverMoon Bank Design System */
/* Hero section with background image */
#shopify-section-hero_banner .hero {
  background-image: url('https://images.unsplash.com/photo-1617864064479-3420e2f1f277?w=1920&q=80');
  background-size: cover;
  background-position: center;
}
#shopify-section-hero_banner .hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(1,1,2,0.85) 0%, rgba(1,1,2,0.4) 50%, rgba(1,1,2,0.85) 100%);
  z-index: 1;
}
#shopify-section-hero_banner .hero > * {
  position: relative;
  z-index: 2;
}
/* Neon mint accent buttons */
#shopify-section-hero_banner .button--solid {
  background-color: #36F4A4 !important;
  color: #000000 !important;
  border-radius: 9999px !important;
  padding: 14px 32px !important;
  font-weight: 500 !important;
  border: none !important;
}
#shopify-section-hero_banner .button--solid:hover {
  background-color: #2bd893 !important;
  transform: scale(1.02);
}
`;

  const cssResult = await shopify('themes/' + themeId + '/assets.json', 'PUT', {
    asset: { key: 'assets/custom-design.css.liquid', value: customCss + '\n' }
  });
  if (cssResult.errors) {
    console.error('CSS ERRORS:', JSON.stringify(cssResult.errors, null, 2));
  } else {
    console.log('✅ Custom CSS uploaded');
  }

  // Step 5: Add CSS reference to theme.liquid
  console.log('\nStep 5: Adding CSS ref to theme.liquid...');
  const themeAsset = await shopify('themes/' + themeId + '/assets.json?asset%5Bkey%5D=layout/theme.liquid');
  if (themeAsset.asset) {
    let themeLiquid = themeAsset.asset.value;
    if (!themeLiquid.includes('custom-design.css')) {
      themeLiquid = themeLiquid.replace('</head>', '{{ "custom-design.css.liquid" | asset_url | stylesheet_tag }}\n</head>');
      await shopify('themes/' + themeId + '/assets.json', 'PUT', {
        asset: { key: 'layout/theme.liquid', value: themeLiquid }
      });
      console.log('✅ CSS ref added to theme.liquid');
    } else {
      console.log('CSS ref already exists');
    }
  }

  console.log('\n🎯 Complete! Visit: https://aigenie-hub.myshopify.com/');
}

main().catch(console.error);
