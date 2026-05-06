require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const api = require('./lib/shopify-api');

async function getMainThemeId() {
  const { themes } = await api.listThemes();
  const main = themes.find(t => t.role === 'main');
  if (!main) throw new Error('No main theme found');
  console.log(`[i] Main theme: ${main.name} (id: ${main.id})`);
  return main.id;
}

function buildAIStoreIndex() {
  return {
    sections: {
      // ═══════ Screen 1: Hero ═══════
      hero_banner: {
        type: 'hero',
        blocks: {
          heading: {
            type: 'text',
            settings: {
              text: '<h1>AI Products That<br/>Redefine Your World</h1>',
              width: 'fit-content',
              max_width: 'narrow',
              alignment: 'center',
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
              text: '<p>SilverMoon Bank curates the finest AI-powered products — from neural earbuds to smart workflows. One store, infinite possibilities.</p>',
              width: 'fit-content',
              max_width: 'narrow',
              alignment: 'center',
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
              label: 'Explore Collection →',
              link: '/collections/all',
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
              text: '<p>Free Worldwide Shipping &nbsp;|&nbsp; 4.9/5 Rating &nbsp;|&nbsp; 30-Day Returns</p>',
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

      // ═══════ Screen 2: Marquee ═══════
      marquee_bar: {
        type: 'marquee',
        blocks: {
          t1: {
            type: 'text',
            settings: {
              text: '<p>AI WORKFLOWS</p>',
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
              text: '<p>DEVELOPER TOOLS</p>',
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
              text: '<p>DIGITAL GUIDES</p>',
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
              text: '<p>AI GADGETS</p>',
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
              text: '<p>NEURAL TECH</p>',
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
          color_scheme: 'scheme-orange-cta',
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
                  text: '<h2>Our AI Product Collection</h2>',
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
          collection: 'all',
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
          color_scheme: 'scheme-orange-cta',
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
              text: '<h2>Why SilverMoon Bank?</h2><p>Three reasons our customers trust us for their AI gear.</p>',
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
              text: '<h3>AI First</h3><p>Every product in our store is hand-picked for its AI capabilities. From real-time translation earbuds to neural processing gadgets — if it does not push the boundary, it does not make the cut.</p>',
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
              text: '<h3>Premium Quality</h3><p>We rigorously test each product for build quality, performance, and reliability. Our curated selection means you get only what works — no junk, no knockoffs, no regrets.</p>',
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
              text: '<h3>Global Community</h3><p>Join thousands of builders, creators, and digital nomads who rely on SilverMoon Bank. Free worldwide shipping, 30-day returns, and support that actually responds.</p>',
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
          color_scheme: 'scheme-orange-cta',
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
              text: '<h2>Who It Is For</h2><p>AI products built for the modern tech lifestyle.</p>',
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
              text: '<h3>Creators</h3><p>Supercharge your content pipeline with AI-powered tools. Automate editing, generate captions, and let the machines handle the grunt work while you focus on creating.</p>',
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
              text: '<h3>Developers</h3><p>From AI coding assistants to automation workflows — equip your dev environment with tools that multiply your output. Ship faster, debug less, build more.</p>',
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
              text: '<h3>Digital Nomads</h3><p>Work from anywhere with AI tools that handle translation, transcription, scheduling, and research. Your portable AI assistant fits in a backpack.</p>',
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
          color_scheme: 'scheme-orange-cta',
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
              text: '<h3>What is SilverMoon Bank?</h3><p>SilverMoon Bank is a curated AI products store. We hand-pick the best AI-powered gadgets, tools, and digital resources so you do not have to wade through the noise.</p>',
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
              text: '<h3>Do you ship worldwide?</h3><p>Yes. Free worldwide shipping on all orders. Delivery times vary by region — typically 3-5 business days for US, 7-14 for international.</p>',
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
              text: '<h3>What is your return policy?</h3><p>30-day money-back guarantee on all physical products. Digital products (guides, workflows) are non-refundable once downloaded. Contact us and we will sort it out.</p>',
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
              text: '<h3>How do you source your products?</h3><p>Every product is tested by our team. We work directly with manufacturers and authorized distributors to ensure authenticity, quality, and competitive pricing.</p>',
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
          q5: {
            type: 'text',
            settings: {
              text: '<h3>Do you offer bulk or business pricing?</h3><p>Yes. Reach out to our team for volume discounts and B2B pricing. We work with startups, coworking spaces, and enterprises to equip their teams with AI tools.</p>',
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
        block_order: ['faq_title', 'q1', 'q2', 'q3', 'q4', 'q5'],
        settings: {
          content_direction: 'column',
          vertical_on_mobile: true,
          horizontal_alignment: 'center',
          vertical_alignment: 'center',
          gap: 12,
          section_width: 'page-width',
          section_height: '',
          color_scheme: 'scheme-orange-cta',
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
              text: '<h2>Stay Ahead of the Curve</h2><p>Get early access to new AI products, exclusive discounts, and tech insights from SilverMoon Bank.</p>',
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
          color_scheme: 'scheme-orange-cta',
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
    const newIndex = buildAIStoreIndex();
    const raw = JSON.stringify(newIndex, null, 2);
    console.log(`[.] Pushing templates/index.json (${raw.length} chars)...`);
    const result = await api.updateThemeAsset(themeId, 'templates/index.json', raw);
    console.log(`[v] index.json pushed successfully!`);
    console.log(`[i] Sections: ${newIndex.order.length}`);
    console.log(`[i] Order: ${newIndex.order.join(' > ')}`);
  } catch (err) {
    console.error(`[x] Failed:`, JSON.stringify(err, null, 2));
    process.exit(1);
  }
}

main();
