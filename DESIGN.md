# Design System: SilverMoon Bank (银月钱庄)

## 1. Visual Theme & Atmosphere

SilverMoon Bank is a dark-first fintech automation platform — where the precision of Stripe meets the darkness of Linear and the bioluminescent energy of Shopify. The canvas sits at the deepest end of dark (`#010102`), creating a void-black foundation that makes every element feel like it's floating in space. Surfaces live at `#0f1011` (card) through `#18191a` (elevated), with hairline borders (`#23252a`) replacing traditional shadows.

The signature accent is **Neon Mint** (`#36F4A4`) — the same bioluminescent green from Shopify's showcase — used exclusively for interactive highlights, focus rings, and the brand's pulse points. A secondary **Lavender Blue** (`#5e6ad2`) from Linear's playbook handles secondary CTAs and decorative gradients, bridging fintech trust with tech-forward energy.

Typography follows Stripe's anti-convention philosophy: ultra-light weights (300) at monumental display sizes (80px), creating headlines that feel etched in light rather than printed in ink. The text is the star — every weight, every tracking value, every OpenType feature is precisely tuned.

**Key Characteristics:**
- Near-black canvas (`#010102`) — deeper than pure black for micro-contrast softness
- Neon Mint (`#36F4A4`) as singular high-energy accent — bioluminescent against darkness
- Ultra-light display typography (weight 300) at monumental scale (80px)
- Full-pill buttons (9999px radius) — the only interactive shape
- Multi-layer blue-tinted shadows — elevation that feels like floating in twilight
- Shadow-as-border technique from Vercel — `box-shadow` replaces `border` everywhere
- Hairline borders (`#23252a`) — barely-there structural boundaries
- No decorative elements — every pixel earns its place

## 2. Color Palette & Roles

### Primary
- **Void Black** (`#010102`): Root page background — absolute darkness
- **Pure White** (`#ffffff`): Primary text on dark surfaces, button fills
- **Near Black** (`#000000`): Extreme contrast elements, overlay backdrop

### Accent
- **Neon Mint** (`#36F4A4`): Signature accent — focus rings, interactive highlights, CTA buttons. The brand's pulse.
- **Lavender Blue** (`#5e6ad2`): Secondary accent — decorative gradients, secondary CTAs, brand marks
- **Mint Hover** (`#2bd893`): Darker mint for interactive hover states
- **Lavender Hover** (`#828fff`): Brighter lavender for hover states

### Surface & Background
- **Surface 1** (`#0f1011`): Card surfaces, content containers
- **Surface 2** (`#141516`): Elevated cards, dropdowns
- **Surface 3** (`#18191a`): Modals, navigation bars
- **Surface 4** (`#191a1b`): Highest surface level

### Neutrals & Text
- **Ink** (`#f7f8f8`): Primary text, headings
- **Ink Muted** (`#d0d6e0`): Secondary text, metadata
- **Ink Subtle** (`#8a8f98`): Tertiary text, placeholders
- **Ink Tertiary** (`#62666d`): Disabled text, least important info

### Borders & Dividers
- **Hairline** (`#23252a`): Standard border — replaces `border` CSS property
- **Hairline Strong** (`#34343a`): Emphasized borders, active states
- **Border Neon** (`rgba(54, 244, 164, 0.3)`): Accent borders on hover/focus

### Shadows
- **Border Shadow** (`rgba(255, 255, 255, 0.04) 0px 0px 0px 1px`): Replaces traditional borders
- **Elevation Soft** (`rgba(0, 0, 0, 0.6) 0px 2px 4px`): Subtle card lift
- **Elevation Medium** (`rgba(0, 0, 0, 0.6) 0px 4px 12px`): Dropdown, modal depth
- **Elevation Strong** (`rgba(0, 0, 0, 0.8) 0px 8px 32px`): Dialog, toast depth

### Semantic
- **Success** (`#27a644`): Success states, confirmations
- **Warning** (`#f59e0b`): Warning states
- **Error** (`#ef4444`): Error states, destructive actions
- **Info** (`#5e6ad2`): Information badges

## 3. Typography Rules

### Font Family
- **Display**: `Inter Display` (variable), fallback: `SF Pro Display, Helvetica, Arial, sans-serif`
- **Body**: `Inter` (variable), fallback: `SF Pro Text, Helvetica, Arial, sans-serif`
- **Mono**: `JetBrains Mono`, fallback: `SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **OpenType**: `"ss01"` on display text, `"liga"` globally, `"tnum"` for financial data

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display XL | 80px | 300 | 1.00 | -2.0px | Hero headlines, weight-300 anti-convention |
| Display LG | 56px | 300 | 1.05 | -1.4px | Secondary hero |
| Display MD | 40px | 300 | 1.10 | -0.96px | Section titles |
| Heading 1 | 32px | 400 | 1.15 | -0.64px | Feature section titles |
| Heading 2 | 28px | 500 | 1.20 | -0.4px | Card headings |
| Heading 3 | 24px | 500 | 1.25 | -0.3px | Smaller card titles |
| Body Large | 20px | 400 | 1.50 | normal | Lead paragraphs |
| Body | 18px | 400 | 1.56 | normal | Standard reading text |
| Body Small | 16px | 400 | 1.50 | normal | UI text |
| Button / Link | 16px | 500 | 1.20 | normal | CTA text, nav links |
| Caption | 14px | 400 | 1.40 | normal | Metadata, timestamps |
| Label | 12px | 500 | 1.20 | 0.72px | Overline, uppercase labels |
| Code | 14px | 400 | 1.50 | normal | JetBrains Mono, code blocks |
| Micro | 11px | 500 | 1.20 | 0.5px | Smallest UI text |

### Principles
- **Light weight as luxury**: Display sizes at weight 300 — the text is so confident it doesn't need weight to be authoritative. This is Stripe's signature move.
- **Progressive tracking**: -2.0px at 80px → normal at 18px. Compression as identity at large sizes, reading comfort at small.
- **Ligatures everywhere**: `"liga"` enabled globally on all text. Not decorative — structural, creating tighter glyph combinations.
- **Tabular numbers**: `"tnum"` on all financial data (prices, statistics, dates) for aligned readability.

## 4. Component Stylings

### Buttons

**Primary (Neon Mint Fill)**
- Background: `#36F4A4` (Neon Mint)
- Text: `#000000` (Near Black)
- Border-radius: 9999px (full pill)
- Padding: 14px 28px
- Font: 16px / 500
- Hover: `#2bd893` with subtle scale (1.02)
- Active: `#26c47e`
- Focus: 2px `#36F4A4` ring with `rgba(54, 244, 164, 0.3)` offset
- Transition: all 200ms ease

**Secondary (Ghost)**
- Background: transparent
- Text: `#f7f8f8`
- Border: 1px solid `#34343a` (Hairline Strong)
- Border-radius: 9999px
- Padding: 14px 28px
- Hover: background `rgba(255, 255, 255, 0.05)`
- Focus: 2px `#36F4A4` ring

### Cards
- Background: `#0f1011`
- Border: `box-shadow: rgba(255,255,255,0.04) 0px 0px 0px 1px` (shadow-as-border)
- Border-radius: 12px
- Padding: 24px
- Hover: shadow expands, `rgba(255,255,255,0.06)` border shadow
- Inner shadow option: `rgba(255,255,255,0.02) 0px 1px 0px inset`

### Inputs
- Background: `#0f1011`
- Text: `#f7f8f8`
- Border: `box-shadow: rgba(255,255,255,0.06) 0px 0px 0px 1px`
- Border-radius: 8px
- Padding: 12px 16px
- Focus: `#36F4A4` ring
- Placeholder: `#62666d`

### Navigation
- Background: transparent (on hero), `#18191a` (on scroll)
- Height: 64px
- Items: 16px / 500, `#f7f8f8`, letter-spacing 0.5px
- Active item: `#36F4A4` underline indicator
- CTA: Neon Mint pill button

### Badges
- Background: `rgba(54, 244, 164, 0.1)`
- Text: `#36F4A4`
- Border-radius: 9999px (pill)
- Padding: 4px 12px
- Font: 12px / 500, uppercase, letter-spacing 0.72px

## 5. Layout Principles

### Spacing Scale
Base unit: 4px
- 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 80px, 96px, 120px

### Grid
- 12-column grid for marketing pages
- Max content width: 1200px
- Full-bleed hero sections: edge-to-edge
- Card grids: 2-3 column responsive

### Whitespace
- Generous section spacing (96-120px)
- Minimal internal card padding (24px)
- Whitespace is the primary visual separator — not borders
- Content blocks breathe; never crammed

## 6. Depth & Elevation

| Layer | Surface | Border Shadow | Elevation Shadow | Use |
|-------|---------|--------------|-----------------|-----|
| Base | `#010102` | none | none | Page background |
| Card | `#0f1011` | `rgba(255,255,255,0.04) 0px 0px 0px 1px` | none | Cards, containers |
| Elevated | `#141516` | `rgba(255,255,255,0.05) 0px 0px 0px 1px` | `rgba(0,0,0,0.6) 0px 2px 8px` | Hovered cards |
| Float | `#18191a` | `rgba(255,255,255,0.06) 0px 0px 0px 1px` | `rgba(0,0,0,0.8) 0px 4px 24px` | Dropdowns, modals |

## 7. Do's and Don'ts

| Do | Don't |
|----|-------|
| Use Neon Mint sparingly — every pixel earns its place | Don't use pure black (`#000`) for backgrounds — it's harsh |
| Keep cards minimal — shadow-as-border, no visible borders | Don't add decorative gradients or illustrations |
| Ultra-light display text needs generous letter-spacing | Don't use bold (700+) weights at display sizes |
| Full-pill buttons only — no square or rounded-corner buttons | Don't mix border-radius styles |
| Use hairline separators between sections | Don't use heavy dividers or thick borders |

## 8. Responsive Behavior

| Breakpoint | Behavior |
|-----------|----------|
| >1200px | Full desktop layout, 80px display text |
| 768-1199px | 2-column grid, 56px display text |
| 480-767px | 1-column grid, 40px display text |
| <480px | Single column, 32px display text, hamburger nav |

### Touch Targets
- Minimum 44px for all interactive elements
- Cards have 16px+ touch spacing on mobile
- Bottom-aligned CTAs on mobile for thumb reach

## 9. Agent Prompt Guide

### Quick Reference
- **Primary Accent**: `#36F4A4` — Neon Mint (use sparingly, high impact)
- **Background**: `#010102` — Void Black (page), `#0f1011` (cards)
- **Text**: `#f7f8f8` (primary), `#d0d6e0` (secondary), `#8a8f98` (tertiary)
- **Borders**: Shadow-as-border `rgba(255,255,255,0.04) 0px 0px 0px 1px`
- **Buttons**: Full pill, Neon Mint fill or ghost with hairline border
- **Display Type**: Inter Display, weight 300, negative letter-spacing
- **Body Type**: Inter, weight 400, normal tracking

### Ready-to-Use Prompt
> "Build a page for SilverMoon Bank — a dark-first fintech automation platform. Use #010102 background, #36F4A4 neon mint accent for CTAs and focus rings. Display type at 80px weight 300 with -2px letter-spacing. Full-pill buttons only. Shadow-as-border technique (no CSS borders). Hairline #23252a dividers. Cards at #0f1011 with multi-layer shadows. Ultra-minimal — no decorative elements, every pixel earns its place."
