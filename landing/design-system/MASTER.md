# SilverMoon Bank — Design System MASTER

## 品牌定位

- **品牌**：SilverMoon Bank — AI Automation & Agent Orchestration
- **受众**：全球开发者、技术创始人、AI 自动化极客
- **调性**：技术感、极简优雅、可信高端
- **对标层级**：Vercel / Linear / Raycast
- **设计风格**：暗色 Neo-Minimalism + Glassmorphism

---

## 一、色彩系统

### 1.1 基础色板

| Token | HEX | 用途 |
|-------|-----|------|
| `--bg-deep` | `#0A0A0A` | 最深层背景（body/html） |
| `--bg-surface` | `#0D1117` | 主面板/区块背景 |
| `--bg-card` | `#161B22` | 卡片/列表项背景 |
| `--bg-elevated` | `#1C2128` | 悬浮/弹窗背景 |
| `--accent` | `#00D4FF` | 主品牌色「月光辉」 |
| `--accent-dim` | `#0099CC` | Accent 悬停/暗色态 |
| `--accent-subtle` | `rgba(0,212,255,0.1)` | Accent 轻量背景 |
| `--secondary` | `#818CF8` | 次品牌色（靛紫） |
| `--secondary-dim` | `#6366F1` | Secondary 悬停态 |
| `--text-primary` | `#F1F5F9` | 主标题文字 |
| `--text-secondary` | `#A1A1AA` | 次要/辅助文字 |
| `--text-tertiary` | `#52525B` | 禁用/占位文字 |
| `--border-subtle` | `rgba(255,255,255,0.06)` | 最浅边框 |
| `--border-default` | `rgba(255,255,255,0.10)` | 标准边框 |
| `--border-hover` | `rgba(255,255,255,0.16)` | 悬浮边框 |

### 1.2 语义色

| Token | HEX | 用途 |
|-------|-----|------|
| `--success` | `#22C55E` | 成功/在线状态 |
| `--warning` | `#F59E0B` | 警告/待处理 |
| `--error` | `#EF4444` | 错误/危险 |
| `--info` | `#3B82F6` | 信息提示 |

### 1.3 径向渐变（Hero 专用）

```
background: radial-gradient(
  ellipse 80% 60% at 50% -20%,
  rgba(0, 212, 255, 0.12) 0%,
  rgba(129, 140, 248, 0.06) 40%,
  transparent 70%
);
```

---

## 二、字体系统

### 2.1 字族

| 层级 | 字体 | 回退 |
|------|------|------|
| Display/Heading | Geist | `Inter, system-ui, -apple-system, sans-serif` |
| Body | Inter | `system-ui, -apple-system, sans-serif` |
| Mono | JetBrains Mono | `Fira Code, monospace` |

### 2.2 字号层级

```
xs:    12px / 16px    — 标注/辅助
sm:    14px / 20px    — 小段文字/描述
base:  16px / 24px    — 正文
lg:    18px / 28px    — 强调正文
xl:    20px / 28px    — 小节标题
2xl:   24px / 32px    — 区块标题
3xl:   30px / 36px    — 大标题
4xl:   36px / 44px    — Hero 标题（移动端）
5xl:   48px / 56px    — Hero 标题（桌面端）
6xl:   60px / 68px    — 超大标题（桌面宽屏）
```

### 2.3 字重

```
Body:      400 (Regular)
Heading:   500 (Medium)
Display:   600 (Semibold)
Hero:      700 (Bold)
```

---

## 三、间距系统

基于 4px 网格：`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128`

| Token | px | 典型用途 |
|-------|-----|---------|
| `space-1` | 4 | 图标内间距 |
| `space-2` | 8 | 紧凑间距 |
| `space-3` | 12 | 内边距微调 |
| `space-4` | 16 | 卡片内边距 |
| `space-5` | 20 | 组件间距 |
| `space-6` | 24 | 段间距 |
| `space-8` | 32 | 区块间距 |
| `space-10` | 40 | 大区块间距 |
| `space-12` | 48 | Section 间距 |
| `space-16` | 64 | 大 Section 间距 |
| `space-20` | 80 | 页面级间距 |
| `space-24` | 96 | Hero 内边距 |

---

## 四、圆角系统

| Token | px | 用途 |
|-------|-----|------|
| `radius-sm` | 6 | 小标签/Badge |
| `radius-md` | 8 | 按钮/输入框 |
| `radius-lg` | 12 | 卡片 |
| `radius-xl` | 16 | 大卡片/弹窗 |
| `radius-2xl` | 20 | Modal/Sheet |
| `radius-full` | 9999 | Pill/圆点 |

---

## 五、阴影与光效

### 5.1 投影

```
shadow-sm:     0 1px 2px rgba(0,0,0,0.40)
shadow-md:     0 4px 6px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.35)
shadow-lg:     0 10px 25px rgba(0,0,0,0.50), 0 4px 10px rgba(0,0,0,0.40)
shadow-xl:     0 20px 50px rgba(0,0,0,0.55), 0 8px 20px rgba(0,0,0,0.45)
```

### 5.2 发光（Glow）

```
glow-accent:  0 0 20px rgba(0,212,255,0.15)
glow-accent-strong:  0 0 32px rgba(0,212,255,0.25)
```

### 5.3 玻璃效果（Glassmorphism）

```
glass:
  background: rgba(255,255,255,0.02)
  backdrop-filter: blur(20px)
  -webkit-backdrop-filter: blur(20px)
  border: 1px solid rgba(255,255,255,0.06)
```

---

## 六、布局

```
container-max-width:  1280px
container-padding:    24px (移动端) / 48px (桌面端)
grid-columns:         12
grid-gap:             24px / 32px
section-vertical-padding: 96px (桌面) / 64px (移动)
```

### 断点

| 断点 | 宽度 |
|------|------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

---

## 七、组件设计规范

### 7.1 按钮

```
Primary (Solid):
  bg: accent → accent-dim on hover
  text: white, 500(medium), 14px
  padding: 10px 24px
  radius: md(8)
  transition: all 0.2s ease
  optional-glow: hover + glow-accent

Secondary (Ghost):
  bg: transparent → white/[0.06] on hover
  border: 1px solid border-default → border-hover on hover
  text: text-primary

Tertiary (Text):
  bg: transparent
  text: text-secondary → text-primary on hover
  no border, no padding (inline)
```

### 7.2 卡片 (Glass Card)

```
bg: bg-card or glass
border: 1px solid border-subtle
radius: lg(12) or xl(16)
padding: 24px (space-6)
hover: translateY(-2px) + shadow-md transition
```

### 7.3 导航栏

```
position: sticky top-0
bg: glass (rgba(10,10,10,0.80) + blur-2xl)
border-bottom: 1px solid border-subtle
height: 64px
z-index: 50
```

### 7.4 Hero

```
min-height: calc(100dvh - 64px)
display: flex, center-center, column
bg: bg-deep + radial-gradient accent glow
text-align: center
max-width-text: 720px
gap: 16-24px between elements
```

### 7.5 Bento Grid (Services)

```
grid: 12 columns
gap: 24px

feature-card (large span):
  - col-span-12 md:col-span-6 lg:col-span-4
  - glass or elevated bg
  - optional: icon + title + description + hover effect

feature-card (wide/highlight):
  - col-span-12 md:col-span-6 or lg:col-span-8
  - can contain image/mockup or code snippet
```

---

## 八、动效

### 8.1 过渡

```
default-transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)
button-hover:  transform scale(1.02) + shadow transition 0.2s
card-hover:    transform translateY(-2px) + shadow transition 0.3s
link-hover:    color transition 0.15s
```

### 8.2 入场动画（Intersection Observer / Framer Motion）

```
fade-in-up:
  initial: opacity: 0, transform: translateY(20px)
  animate: opacity: 1, transform: translateY(0)
  duration: 0.5s
  stagger: children delay 0.1s each

fade-in:
  initial: opacity: 0
  animate: opacity: 1
  duration: 0.4s
```

---

## 九、全局样式原则

1. **暗色优先**：默认 `dark` 模式，light 模式为次级
2. **SVG 图标统一**：使用 `lucide-react` 输入框图标库，统一 20px stroke-width
3. **渐变从左上到右下**：所有线性渐变遵循 `135deg` 方向
4. **间距节奏**：从不使用奇数间距，严格遵循 4px 网格
5. **文字对比**：背景深色区文字用 100-200 灰度，浅色区文字用 700-900 灰度
6. **隐式状态**：每个交互元素必须有 hover/focus/active 三态

---

## 十、代码实现规范

### Tailwind v4 配置 (@theme inline)

```css
/* globals.css 中配置 */
@theme inline {
  --color-bg-deep: #0A0A0A;
  --color-bg-surface: #0D1117;
  --color-bg-card: #161B22;
  --color-bg-elevated: #1C2128;
  --color-accent: #00D4FF;
  --color-accent-dim: #0099CC;
  --color-accent-subtle: rgba(0,212,255,0.1);
  --color-secondary: #818CF8;
  --color-secondary-dim: #6366F1;
  --color-text-primary: #F1F5F9;
  --color-text-secondary: #A1A1AA;
  --color-text-tertiary: #52525B;
  --color-border-subtle: rgba(255,255,255,0.06);
  --color-border-default: rgba(255,255,255,0.10);
  --color-border-hover: rgba(255,255,255,0.16);
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  --font-sans: var(--font-geist-sans), Inter, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

### Tailwind v4 工具类用法（示例）

```
<!-- Glass 卡片 -->
<div class="rounded-xl border border-border-subtle bg-bg-card backdrop-blur-xl p-6
            transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">

<!-- Accent 按钮 -->
<button class="rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-white
               transition-all duration-200 hover:bg-accent-dim hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]">

<!-- Hero 布局 -->
<section class="relative flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center
                bg-bg-deep [background:radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,212,255,0.12)_0%,rgba(129,140,248,0.06)_40%,transparent_70%)]">
```
