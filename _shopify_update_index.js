/**
 * 推送 8 屏品牌首页到 Shopify（Step 3）
 * 
 * Layout:
 * 1. Hero — AIGenie Vision 品牌 Hero
 * 2. Marquee — 品牌信任信号
 * 3. Product List — 产品展示
 * 4. Features — 三大核心功能
 * 5. Use Cases — 使用场景
 * 6. FAQ — 常见问题
 * 7. Newsletter — 订阅
 * [Footer — 全局，不需要动]
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const api = require('./lib/shopify-api');

async function getMainThemeId() {
  const { themes } = await api.listThemes();
  const main = themes.find(t => t.role === 'main');
  if (!main) throw new Error('No main theme found');
  console.log(`[✓] Main theme: ${main.name} (id: ${main.id})`);
  return main.id;
}

async function getCurrentIndex(themeId) {
  try {
    const { asset } = await api.getThemeAsset(themeId, 'templates/index.json');
    return JSON.parse(asset.value);
  } catch (e) {
    console.log('[!] No existing index.json, building from scratch');
    return { sections: {}, order: [] };
  }
}

function buildNewIndex() {
  return {
    sections: {
      // ═══════ Screen 1: Hero ═══════
      hero_banner: {
        type: 'hero',
        blocks: {
          heading: {
            type: 'text',
            settings: {
              text: '<h1>AI That Speaks<br/>Your World</h1>',
              width: 'fit-content',
              max_width: 'narrow',
              alignment: 'left',
              type_preset: 'h1',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              line_height: 'normal',
              letter_spacing: 'normal',
              case: 'none',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          subtitle: {
            type: 'text',
            settings: {
              text: '<p>Real-time translation across 100+ languages. Just put them on and understand everything. No app. No setup. No limits.</p>',
              width: 'fit-content',
              max_width: 'narrow',
              alignment: 'left',
              type_preset: 'body',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              line_height: 'normal',
              letter_spacing: 'normal',
              case: 'none',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          cta: {
            type: 'button',
            settings: {
              label: 'Explore Collection — From $59',
              link: '/collections/tech-gear',
              open_in_new_tab: false,
              style_class: 'button',
              width: 'fit-content',
              custom_width: 100,
              width_mobile: 'fit-content',
              custom_width_mobile: 100
            },
            blocks: {}
          },
          trust_bar: {
            type: 'text',
            settings: {
              text: '<p>🚚 Free Worldwide Shipping &nbsp;|&nbsp; ⭐ 4.9/5 Rating &nbsp;|&nbsp; 🔄 30-Day Returns</p>',
              width: 'fit-content',
              max_width: 'normal',
              alignment: 'center',
              type_preset: 'paragraph',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              line_height: 'normal',
              letter_spacing: 'normal',
              case: 'none',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          }
        },
        block_order: ['heading', 'subtitle', 'cta', 'trust_bar'],
        settings: {
          media_type_1: 'image',
          media_type_2: 'image',
          stack_media_on_mobile: false,
          custom_mobile_media: false,
          media_type_1_mobile: 'image',
          media_type_2_mobile: 'image',
          link: '',
          open_in_new_tab: false,
          content_direction: 'row',
          vertical_on_mobile: true,
          horizontal_alignment: 'center',
          vertical_alignment: 'center',
          align_baseline: false,
          horizontal_alignment_flex_direction_column: 'center',
          vertical_alignment_flex_direction_column: 'center',
          gap: 40,
          section_width: 'full-width',
          section_height: 'full-screen',
          section_height_custom: 50,
          color_scheme: 'scheme-orange-cta',
          toggle_overlay: true,
          overlay_color: '#00000066',
          overlay_style: 'gradient',
          gradient_direction: 'to bottom',
          blurred_reflection: false,
          reflection_opacity: 75,
          'padding-block-start': 40,
          'padding-block-end': 40
        }
      },

      // ═══════ Screen 2: Trust Bar (Marquee) ═══════
      marquee_bar: {
        type: 'marquee',
        blocks: {
          t1: {
            type: 'text',
            settings: {
              text: '<p>🌐 100+ LANGUAGES SUPPORTED</p>',
              width: 'fit-content',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'body',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              line_height: 'normal',
              letter_spacing: 'normal',
              case: 'none',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          t2: {
            type: 'text',
            settings: {
              text: '<p>🔒 30-DAY RISK-FREE TRIAL</p>',
              width: 'fit-content',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'body',
              font: 'var(--font-body--family)',
              font_size: '1rem'
            },
            blocks: {}
          },
          t3: {
            type: 'text',
            settings: {
              text: '<p>⚡ 8-HOUR BATTERY LIFE</p>',
              width: 'fit-content',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'body',
              font: 'var(--font-body--family)',
              font_size: '1rem'
            },
            blocks: {}
          },
          t4: {
            type: 'text',
            settings: {
              text: '<p>🚀 AI-POWERED REAL-TIME</p>',
              width: 'fit-content',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'body',
              font: 'var(--font-body--family)',
              font_size: '1rem'
            },
            blocks: {}
          },
          t5: {
            type: 'text',
            settings: {
              text: '<p>💳 SHOP PAY — 1-CLICK CHECKOUT</p>',
              width: 'fit-content',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'body',
              font: 'var(--font-body--family)',
              font_size: '1rem'
            },
            blocks: {}
          }
        },
        block_order: ['t1', 't2', 't3', 't4', 't5'],
        settings: {
          movement_direction: 'normal',
          color_scheme: 'scheme-6',
          'padding-block-start': 24,
          'padding-block-end': 24,
          gap_between_elements: 32
        }
      },

      // ═══════ Screen 3: Product Showcase ═══════
      product_list: {
        type: 'product-list',
        blocks: {
          'static-header': {
            type: '_product-list-content',
            static: true,
            settings: {
              content_direction: 'row',
              vertical_on_mobile: false,
              horizontal_alignment: 'space-between',
              vertical_alignment: 'flex-end',
              align_baseline: true,
              horizontal_alignment_flex_direction_column: 'flex-start',
              vertical_alignment_flex_direction_column: 'center',
              gap: 12,
              width: 'fill',
              custom_width: 100,
              width_mobile: 'fill',
              custom_width_mobile: 100,
              height: 'fit',
              custom_height: 100,
              inherit_color_scheme: true,
              color_scheme: '',
              background_media: 'none',
              border: 'none',
              border_width: 1,
              border_opacity: 100,
              border_radius: 0,
              'padding-block-start': 0,
              'padding-block-end': 0,
              'padding-inline-start': 0,
              'padding-inline-end': 0
            },
            blocks: {
              heading_text: {
                type: '_product-list-text',
                settings: {
                  text: '<h2>Our AI Product Lineup</h2>',
                  width: 'fit-content',
                  max_width: 'normal',
                  alignment: 'left',
                  type_preset: 'rte',
                  font: 'var(--font-body--family)',
                  font_size: '1rem',
                  line_height: 'normal',
                  wrap: 'pretty',
                  color: 'var(--color-foreground)'
                },
                blocks: {}
              },
              view_all_btn: {
                type: '_product-list-button',
                settings: {
                  label: 'View all',
                  open_in_new_tab: false,
                  style_class: 'link',
                  width: 'fit-content',
                  custom_width: 100,
                  width_mobile: 'fit-content',
                  custom_width_mobile: 100
                },
                blocks: {}
              }
            },
            block_order: ['heading_text', 'view_all_btn']
          },
          'static-product-card': {
            type: '_product-card',
            disabled: true,
            static: true,
            settings: {
              product_card_gap: 4,
              inherit_color_scheme: true,
              color_scheme: '',
              border: 'none',
              border_width: 1,
              border_opacity: 100,
              border_radius: 0,
              'padding-block-start': 0,
              'padding-block-end': 0
            },
            blocks: {
              gallery: {
                type: '_product-card-gallery',
                settings: {
                  image_ratio: 'adapt',
                  border: 'none',
                  border_width: 1,
                  border_opacity: 100,
                  border_radius: 0,
                  'padding-block-start': 0,
                  'padding-block-end': 0,
                  'padding-inline-start': 0,
                  'padding-inline-end': 0
                },
                blocks: {}
              },
              title: {
                type: 'product-title',
                settings: {
                  width: 'fit-content',
                  max_width: 'normal',
                  alignment: 'left',
                  type_preset: 'paragraph',
                  font: 'var(--font-body--family)',
                  font_size: '1rem',
                  wrap: 'pretty',
                  color: 'var(--color-foreground)',
                  'padding-block-start': 4,
                  'padding-block-end': 0
                },
                blocks: {}
              },
              price: {
                type: 'price',
                settings: {
                  show_sale_price_first: true,
                  show_installments: false,
                  show_tax_info: false,
                  type_preset: 'h6',
                  width: '100%',
                  alignment: 'left',
                  font: 'var(--font-body--family)',
                  font_size: '1rem',
                  color: 'var(--color-foreground)'
                },
                blocks: {}
              }
            },
            block_order: ['gallery', 'title', 'price']
          }
        },
        settings: {
          collection: 'tech-gear',
          layout_type: 'grid',
          carousel_on_mobile: false,
          max_products: 8,
          columns: 4,
          mobile_columns: '2',
          mobile_card_size: '60cqw',
          columns_gap: 16,
          rows_gap: 32,
          icons_style: 'arrow',
          icons_shape: 'none',
          section_width: 'page-width',
          horizontal_alignment: 'flex-start',
          gap: 28,
          color_scheme: 'scheme-6',
          'padding-block-start': 64,
          'padding-block-end': 64
        }
      },

      // ═══════ Screen 4: Features ═══════
      features: {
        type: '_blocks',
        blocks: {
          feature_title: {
            type: 'text',
            settings: {
              text: '<h2>Why AIGenie Vision?</h2><p>Three reasons our customers make the switch.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'center',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          feature_1: {
            type: 'text',
            settings: {
              text: '<h3>🌐 Real-Time Translation</h3><p>Speak naturally and hear translations instantly in over 100 languages. No app to open, no buttons to press — it just works.</p>',
              width: 'fill',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          feature_2: {
            type: 'text',
            settings: {
              text: '<h3>🔊 Crystal Clear Audio</h3><p>Dual noise-cancelling microphones and adaptive speakers deliver studio-quality sound, even in crowded cafés or windy streets.</p>',
              width: 'fill',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          feature_3: {
            type: 'text',
            settings: {
              text: '<h3>⚡ All-Day Battery</h3><p>8 hours of continuous use on a single charge. The compact charging case gives you another 24 hours. Your AI companion that never sleeps.</p>',
              width: 'fill',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          }
        },
        block_order: ['feature_title', 'feature_1', 'feature_2', 'feature_3'],
        settings: {
          content_direction: 'column',
          vertical_on_mobile: true,
          horizontal_alignment: 'center',
          vertical_alignment: 'center',
          gap: 12,
          section_width: 'page-width',
          section_height: '',
          section_height_custom: 50,
          color_scheme: 'scheme-6',
          background_media: 'none',
          border: 'none',
          border_width: 1,
          border_opacity: 100,
          border_radius: 0,
          toggle_overlay: false,
          'padding-block-start': 64,
          'padding-block-end': 64
        }
      },

      // ═══════ Screen 5: Use Cases ═══════
      use_cases: {
        type: '_blocks',
        blocks: {
          usecase_title: {
            type: 'text',
            settings: {
              text: '<h2>Who It\'s For</h2><p>From boardrooms to backpacks — AIGenie fits your life.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'center',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          case_1: {
            type: 'text',
            settings: {
              text: '<h3>✈️ Travelers</h3><p>Navigate foreign cities, order food, and chat with locals — all in your native language.</p>',
              width: 'fill',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          case_2: {
            type: 'text',
            settings: {
              text: '<h3>💼 Business Pros</h3><p>Handle international calls, negotiate deals, and attend meetings in any language with confidence.</p>',
              width: 'fill',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          case_3: {
            type: 'text',
            settings: {
              text: '<h3>🎓 Students & Lifelong Learners</h3><p>Watch lectures, read research papers, and learn from global content without language barriers.</p>',
              width: 'fill',
              max_width: 'normal',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          }
        },
        block_order: ['usecase_title', 'case_1', 'case_2', 'case_3'],
        settings: {
          content_direction: 'column',
          vertical_on_mobile: true,
          horizontal_alignment: 'center',
          vertical_alignment: 'center',
          gap: 12,
          section_width: 'page-width',
          section_height: '',
          color_scheme: '',
          background_media: 'none',
          border: 'none',
          toggle_overlay: false,
          'padding-block-start': 64,
          'padding-block-end': 64
        }
      },

      // ═══════ Screen 6: FAQ ═══════
      faq: {
        type: '_blocks',
        blocks: {
          faq_title: {
            type: 'text',
            settings: {
              text: '<h2>Frequently Asked Questions</h2>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'center',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          q1: {
            type: 'text',
            settings: {
              text: '<h3>Do I need an internet connection?</h3><p>Yes — real-time translation requires cloud AI processing. We recommend a stable 4G/5G or Wi-Fi connection for best results.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          q2: {
            type: 'text',
            settings: {
              text: '<h3>Which languages are supported?</h3><p>Currently 105 languages including English, Mandarin, Spanish, Arabic, French, Japanese, Korean, German, and more. New languages added monthly.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          q3: {
            type: 'text',
            settings: {
              text: '<h3>What\'s your return policy?</h3><p>30-day money-back guarantee, no questions asked. Free return shipping within the US. International returns may incur shipping costs.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          q4: {
            type: 'text',
            settings: {
              text: '<h3>How long does shipping take?</h3><p>US: 3-5 business days (free). International: 7-14 business days ($9.99 flat rate). Express shipping available at checkout.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'left',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          }
        },
        block_order: ['faq_title', 'q1', 'q2', 'q3', 'q4'],
        settings: {
          content_direction: 'column',
          vertical_on_mobile: true,
          horizontal_alignment: 'center',
          vertical_alignment: 'center',
          gap: 12,
          section_width: 'page-width',
          section_height: '',
          color_scheme: 'scheme-6',
          background_media: 'none',
          border: 'none',
          toggle_overlay: false,
          'padding-block-start': 64,
          'padding-block-end': 64
        }
      },

      // ═══════ Screen 7: Newsletter ═══════
      newsletter: {
        type: '_blocks',
        blocks: {
          newsletter_title: {
            type: 'text',
            settings: {
              text: '<h2>Stay Ahead of the Curve</h2><p>Get early access to new AI products, exclusive discounts, and tech insights.</p>',
              width: 'fill',
              max_width: 'narrow',
              alignment: 'center',
              type_preset: 'rte',
              font: 'var(--font-body--family)',
              font_size: '1rem',
              wrap: 'pretty',
              color: 'var(--color-foreground)'
            },
            blocks: {}
          },
          cta_btn: {
            type: 'button',
            settings: {
              label: 'Subscribe for Updates →',
              link: '#',
              open_in_new_tab: false,
              style_class: 'button',
              width: 'fit-content',
              custom_width: 100,
              width_mobile: 'fit-content',
              custom_width_mobile: 100
            },
            blocks: {}
          }
        },
        block_order: ['newsletter_title', 'cta_btn'],
        settings: {
          content_direction: 'column',
          vertical_on_mobile: true,
          horizontal_alignment: 'center',
          vertical_alignment: 'center',
          gap: 24,
          section_width: 'page-width',
          section_height: '',
          color_scheme: '',
          background_media: 'none',
          border: 'none',
          toggle_overlay: false,
          'padding-block-start': 80,
          'padding-block-end': 80
        }
      }
    },
    order: [
      'hero_banner',
      'marquee_bar',
      'product_list',
      'features',
      'use_cases',
      'faq',
      'newsletter'
    ]
  };
}

async function main() {
  try {
    const themeId = await getMainThemeId();
    
    // Build new index.json
    const newIndex = buildNewIndex();
    const raw = JSON.stringify(newIndex, null, 2);
    
    console.log(`[.] Pushing templates/index.json (${raw.length} chars)...`);
    const result = await api.updateThemeAsset(themeId, 'templates/index.json', raw);
    console.log('[✓] index.json pushed successfully!');
    console.log(`[i] Sections: ${newIndex.order.length}`);
    console.log(`[i] Order: ${newIndex.order.join(' → ')}`);
    
  } catch (err) {
    console.error('[✗] Failed:', JSON.stringify(err, null, 2));
    process.exit(1);
  }
}

main();
