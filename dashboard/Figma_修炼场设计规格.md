# Figma 设计规格书：修炼场 v3

> **设计师**: 美杜莎
> **项目**: 银月钱庄 ControlCenter · `/cultivation`
> **PRD 源文件**: `PRD_重做修炼场.md`
> **样式源**: `index.html` 设计Token体系

---

## 1. 设计 Token 体系（三层架构）

### 1.1 Primitive Tokens（基础层）

```css
/* === 颜色原始值 === */
--color-white: #FFFFFF;
--color-black: #000000;

/* 灰色 */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-800: #1F2937;
--gray-900: #111827;

/* 深色（主控台专用） */
--dark-deep: #0A0A0A;
--dark-surface: #0D1117;
--dark-card: #161B22;
--dark-elevated: #1C2128;
--dark-sidebar: #0B0E14;

/* 蓝色系（OC 总管区） */
--blue-400: #60A5FA;
--blue-500: #3B82F6;
--blue-accent: #00D4FF;
--blue-dim: #0099CC;

/* 金色系（TR 宗门区） */
--gold-300: #FCD34D;
--gold-400: #FBBF24;
--gold-500: #F59E0B;
--gold-600: #D97706;

/* 紫色系（CC 外援区） */
--purple-400: #C084FC;
--purple-500: #A855F7;
--purple-cc: #CC44FF;

/* 状态色 */
--green-success: #22C55E;
--yellow-warning: #F59E0B;
--red-error: #EF4444;

/* 间距（4px 基准） */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

/* 圆角 */
--radius-none: 0px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;

/* 字体 */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* 字号 */
--text-xs: 10px;
--text-sm: 11px;
--text-base: 12px;
--text-md: 13px;
--text-lg: 14px;
--text-xl: 15px;
--text-2xl: 18px;
--text-3xl: 22px;

/* 字重 */
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;

/* 阴影 */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 12px rgba(0,0,0,0.4);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
--shadow-glow-blue: 0 0 16px rgba(0,212,255,0.3);
--shadow-glow-gold: 0 0 16px rgba(245,158,11,0.3);
--shadow-glow-purple: 0 0 16px rgba(204,68,255,0.3);
```

### 1.2 Semantic Tokens（语义层）

```css
/* 背景 */
--bg-page: var(--dark-deep);           /* #0A0A0A */
--bg-surface: var(--dark-surface);     /* #0D1117 */
--bg-card: var(--dark-card);           /* #161B22 */
--bg-elevated: var(--dark-elevated);   /* #1C2128 */

/* 区色（组容器边框/标题） */
--color-oc: var(--blue-accent);        /* #00D4FF — 总管区 */
--color-tr: var(--gold-500);           /* #F59E0B — 宗门区 */
--color-cc: var(--purple-cc);          /* #CC44FF — 外援区 */

/* 文字 */
--text-primary: #F1F5F9;
--text-secondary: #A1A1AA;
--text-tertiary: #52525B;

/* 边框 */
--border-subtle: rgba(255,255,255,0.06);
--border-default: rgba(255,255,255,0.10);
--border-hover: rgba(255,255,255,0.16);

/* 状态 */
--status-online: var(--green-success);  /* #22C55E */
--status-busy: var(--yellow-warning);  /* #F59E0B */
--status-error: var(--red-error);      /* #EF4444 */
--status-offline: var(--text-tertiary);/* #52525B */
```

### 1.3 Component Tokens（组件层）

```css
/* Agent 卡片 */
--agent-card-bg: var(--dark-card);
--agent-card-border: var(--border-subtle);
--agent-card-border-hover: var(--border-hover);
--agent-card-radius: var(--radius-lg);
--agent-card-padding: 14px;
--agent-card-gap: 8px;

/* 分组容器 */
--group-border-oc: rgba(0,212,255,0.15);
--group-border-tr: rgba(245,158,11,0.15);
--group-border-cc: rgba(204,68,255,0.15);
--group-bg-oc: rgba(0,212,255,0.03);
--group-bg-tr: rgba(245,158,11,0.03);
--group-bg-cc: rgba(204,68,255,0.03);

/* 筛选按钮 */
--filter-btn-bg: transparent;
--filter-btn-border: var(--border-default);
--filter-btn-active-bg: rgba(0,212,255,0.1);
--filter-btn-active-border: var(--blue-accent);
--filter-btn-radius: var(--radius-full);

/* 活动日志 */
--log-item-bg: transparent;
--log-item-border: var(--border-subtle);
--log-item-hover-bg: var(--dark-elevated);
```

---

## 2. 页面布局规格（Figma Frame）

### 2.1 画布（Artboard）
- **名称**: Cultivation v3
- **尺寸**: 1440 x 900px（主画布）
- **断点变体**: 
  - Desktop: 1440px
  - Wide: 1920px  
  - Small: 1366px（最小支持）
- **背景色**: `#0A0A0A`
- **Grid**: 12-column grid, gutter 24px, margin 32px

### 2.2 页面结构（从上到下）

```
┌─────────────────────────────────────────────────────────┐
│ Header Bar           h: 56px                            │
│ ┌ Breadcrumb │ 筛选栏 │ 搜索框 │ 右上时钟 │ 在线统计 │ │
├─────────────────────────────────────────────────────────┤
│ Metric Cards          h: 96px  (3 cards, gap: 16px)     │
│ ┌ Agent舰队┐ ┌ 在线率 ┐ ┌ 心跳总数 ┐                    │
├─────────────────────────────────────────────────────────┤
│ ────────────────── 主内容区 flex: 1 ──────────────────  │
│ ┌──────────────────┐ ┌──────────────┐                   │
│ │ 分组Agent区      │ │ 活动日志流   │                   │
│ │ flex: 3          │ │ flex: 1      │                   │
│ │                   │ │              │                   │
│ │ OC 总管区 (8人)   │ │ 实时滚动日志  │                   │
│ │ ┌─ 卡片网格 ──┐  │ │              │                   │
│ │ TR 宗门区 (8人)   │ │              │                   │
│ │ ┌─ 卡片网格 ──┐  │ │              │                   │
│ │ CC 外援区 (1人)   │ │              │                   │
│ └──────────────────┘ └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### 2.3 间距系统
- 页边距: 32px（左右）
- Section 间距: 24px
- 卡片间距: 12px
- 组内间距: 16px

---

## 3. 组件规格（含状态）

### 3.1 Agent Card（核心组件）

**Figma 组件命名**: `AgentCard / [状态] / [归属]`

| 属性 | 默认 | Hover | Active |
|------|------|-------|--------|
| bg | `var(--dark-card)` | `var(--dark-elevated)` | `var(--dark-elevated)` |
| border | `var(--border-subtle)` | `var(--border-hover)` + 归属色 20% glow | 同 hover |
| transform | none | `translateY(-2px)` | `scale(0.98)` |
| shadow | `var(--shadow-sm)` | `var(--shadow-md)` + 归属色 glow | `var(--shadow-sm)` |

**尺寸**: w: 208px, h: 120px（在分组网格中自适应）

**内部布局**:
```
┌────────────────────┐
│ ● 在线   [OC] 银月 │  ← row: 状态圆点(8px) + 归属徽章 + 名字
│ 总管 · 网关调度    │  ← row: 席位/角色 (text-secondary, 11px)
│────────────────────│  ← divider (1px, border-subtle)
│ ♡ 247 次  │ 12h33m │  ← row: 心跳数 + 运行时长 (left/right)
│────────────────────│  ← divider  
│ 最后活跃: 刚刚     │  ← row: 最后活跃时间 (text-tertiary, 10px)
└────────────────────┘
```

**状态圆点（4 种状态）**:
- **在线** (`online`): `#22C55E`, 带 4px box-shadow glow
- **繁忙** (`busy`): `#F59E0B`, 带 4px glow
- **异常** (`error`): `#EF4444`, 带 4px glow
- **离线** (`offline`): `#52525B`, 无 glow

**归属徽章（3 种颜色）**:
- `OC`: 蓝色 `#00D4FF`, bg `rgba(0,212,255,0.12)`
- `TR`: 金色 `#F59E0B`, bg `rgba(245,158,11,0.12)`
- `CC`: 紫色 `#CC44FF`, bg `rgba(204,68,255,0.12)`

**类型**: 圆角 pill, 字号 9px, 字重 600, padding 2px 8px

**Refer to**: Figma 内建 Variant 系统，做 4(状态) x 3(归属) = 12 个 variant

### 3.2 分组区域容器

**Figma 组件命名**: `GroupSection / [OC|TR|CC]`

| 属性 | OC | TR | CC |
|------|-----|-----|------|
| 标题色 | `#00D4FF` | `#F59E0B` | `#CC44FF` |
| 左侧border | `#00D4FF 15%` | `#F59E0B 15%` | `#CC44FF 15%` |
| bg tint | `rgba(0,212,255,0.03)` | `rgba(245,158,11,0.03)` | `rgba(204,68,255,0.03)` |
| 标题图标 | 👑 | ⚔️ | 🔗 |

**结构**:
```
┌─ Title Bar ──────────────────────┐
│ 👑 OC 总管区 (8/8 在线)    [展开] │  ← h: 40px
├──────────────────────────────────┘
│ ┌─ Card Grid (auto-fill) ──┐    │
│ │ [Card] [Card] [Card]     │    │  ← gap: 12px
│ │ [Card] [Card] [Card]     │    │
│ │ [Card] [Card]            │    │
│ └──────────────────────────┘    │
└──────────────────────────────────┘
```

### 3.3 指标卡片（Metric Cards）

**Figma 组件命名**: `MetricCard`

| 属性 | 值 |
|------|-----|
| w/h | 自适应 / 96px |
| bg | `var(--dark-card)` |
| border | `var(--border-subtle)` |
| radius | `var(--radius-lg)` |
| padding | 20px |

**结构**:
```
┌────────────────────┐
│ Agent 舰队          │  ← 图标 + 标签 (text-secondary, 12px)
│ 17                  │  ← 大数字 (text-3xl, bold, font-mono)
│ ┌───▰▰▰▰▰▰▰▰───┐   │  ← Sparkline 迷你趋势线 (h: 24px)
└────────────────────┘
```

三个指标卡片：
1. **Agent 舰队**: 总数 17，Sparkline 显示在线趋势
2. **在线率**: 百分比（如 82%），颜色随在线率变化（>80% 绿色, >50% 黄色, <50% 红色）
3. **心跳总数**: 累计心跳次数（如 1,247），带增量指示

### 3.4 筛选栏

**Figma 组件命名**: `FilterBar`

```
[全部] [在线 ● 12] [离线 ○ 3] [异常 ✕ 2] [繁忙 ◐ 1]  │  [🔍 搜索 Agent...]
```

| 状态 | 按钮样式 |
|------|---------|
| 未选中（default）| bg transparent, border `var(--border-default)`, text `var(--text-secondary)` |
| 未选中（hover）| bg `var(--dark-elevated)`, border `var(--border-hover)` |
| 选中（active）| bg `rgba(0,212,255,0.1)`, border `#00D4FF`, text `#00D4FF` |
| 计数标记 | 内嵌 pill, bg `var(--dark-card)`, 字号 10px |

**搜索框**:
- 左侧 magnifier icon, 右侧可选清空按钮
- placeholder: "搜索 Agent..."
- bg: `var(--dark-surface)`, border: `var(--border-default)`
- focus: border `#00D4FF`, box-shadow `0 0 0 2px rgba(0,212,255,0.15)`

### 3.5 活动日志流

**Figma 组件命名**: `ActivityLog`

| 属性 | 值 |
|------|-----|
| 宽度 | 280px (固定, flex: 1) |
| 高度 | 100% (随 container) |
| bg | `var(--dark-surface)` |
| border-left | `1px solid var(--border-subtle)` |
| padding | 16px |
| 滚动 | 内部 overflow-y: auto |

**日志条目**:
```
┌──────────────────────────┐
│ 最近活动          [42条] │  ← header, h: 32px
├──────────────────────────┤
│ ● 14:32:07              │
│   银月  ·  gateway       │  ← 状态点 + 时间 (mono, text-tertiary)
│   Heartbeat received     │  ← 事件描述 (text-secondary)
├──────────────────────────┤
│ ⚡ 14:31:59              │
│   李长寿 ·  web-dev      │
│   Task: cultivation v3   │
│   → completed            │
├──────────────────────────┤
│ ✕ 14:31:52               │
│   萧炎  ·  intel         │
│   API timeout retry (3)  │
└──────────────────────────┘
```

**事件图标映射**:
- Heartbeat: `●` (绿色)
- Task completed: `⚡` (蓝色)
- Error/Warning: `✕` (红色)
- Status change: `◉` (黄色)

### 3.6 详情 Modal

**Figma 组件命名**: `AgentDetailModal`

结构参考 index.html 的 modal 组件，尺寸: 520px x auto（最大 600px）

```
┌──────────────────────────────┐
│ 银月      [OC] 总管 · 网关  │  ← header, 关闭按钮右上
│ ● 在线 · 心跳 247 · 12h33m  │
├──────────────────────────────┤
│ ┌─ 基本信息 ─────────────────┐│
│ │ 席位: 总管                  ││
│ │ 归属: OC 总管区             ││
│ │ 状态: 在线 (connected)      ││
│ │ 心跳: 247 次               ││
│ │ 最后活跃: 刚刚              ││
│ │ 运行时长: 12h 33m           ││
│ │ 最近原因: heartbeat         ││
│ └────────────────────────────┘│
│ ┌─ 心跳时间线 ────────────────┐│
│ │ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰  ││  ← sparkline chart
│ │ 最近 50 次心跳              ││
│ └────────────────────────────┘│
│ ┌─ 最近活动 ─────────────────┐│
│ │ 14:32:07 heartbeat         ││
│ │ 14:31:52 heartbeat         ││
│ │ ...                        ││
│ └────────────────────────────┘│
│ ┌─ 操作 ─────────────────────┐│
│ │ [重启 Agent]  [查看日志]   ││  ← 按钮
│ └────────────────────────────┘│
└──────────────────────────────┘
```

**Modal 动效**:
- Enter: backdrop blur fade-in (0.2s), modal scale-in (0.3s cubic-bezier)
- Exit: fade-out (0.15s)

---

## 4. 响应式断点

| 断点 | 宽度 | 列数 | 卡片列数 | 日志流 | 说明 |
|------|------|------|----------|--------|------|
| `sm` | <1366px | 8 | 2 col (w: 196px) | 折叠为底部 | 最小支持屏 |
| `md` | 1366-1679px | 12 | 3 col (w: 208px) | 右侧 260px | 主流笔记本 |
| `lg` | 1680-1919px | 12 | 4 col (w: 220px) | 右侧 280px | 大屏笔记本 |
| `xl` | 1920px+ | 12 | 4-5 col (auto) | 右侧 320px | 桌面 + 4K |

**Note to Figma**: 只做 `md` (1440px) 和 `xl` (1920px) 两个 frame 变体，其余由李长寿用 CSS 解决。

---

## 5. 动效与过渡

| 元素 | 触发 | 动效 | 时长 | easing |
|------|------|------|------|--------|
| Agent Card | hover | translateY(-2px) + shadow | 0.25s | ease-out |
| Agent Card | appear (initial) | fadeIn + translateY(10px) | 0.3s | ease-out (stagger 0.05s) |
| Filter button | active | bg + border color | 0.15s | ease |
| 状态圆点 | 状态变化 | pulse (scale 1→1.3→1) | 0.3s | ease |
| 日志条目 | 新条目出现 | slideIn (from left 10px) | 0.2s | ease-out |
| Modal | open | backdrop blur + scale(0.95→1) | 0.3s | cubic-bezier(0.16,1,0.3,1) |
| 指标数字 | 更新 | count-up animation | 0.5s | ease-out |
| 归属 glow | 卡片 hover | opacity 0→0.08 | 0.3s | ease |

---

## 6. Figma 交付清单

### Frame 列表
| # | Frame 名称 | 尺寸 | 说明 |
|---|-----------|------|------|
| 1 | Cultivation v3 — 1440 | 1440x900 | 主画布 |
| 2 | Cultivation v3 — 1920 | 1920x1080 | 宽屏变体 |
| 3 | Component — Agent Cards | Auto | 12 variant 网格展示 |
| 4 | Component — Group Sections | 500x300 | 3 种分组容器 |
| 5 | Component — Filter Bar | 600x48 | 完整筛选栏 |
| 6 | Component — Metric Cards | 400x96 | 3 个指标卡片 |
| 7 | Component — Activity Log | 280x600 | 活动日志流 |
| 8 | Component — Detail Modal | 520xauto | Agent 详情弹窗 |

### 导出要求
- 所有 SVG icon 导出为独立文件
- Auto Layout 使用
- Variant 做好命名规范（`State=Online, Group=OC`）
- 每个 Component 加 Description 备注 hover/active 动效
- 字体用 Google Fonts: Inter + JetBrains Mono（noto 可不嵌）

---

## 7. Handoff 备注（给李长寿）

1. **CSS 变量**: 所有颜色/间距/圆角用 `var(--xxx)` 引用，不要硬编码
2. **Grid 实现**: 分组 Agent 网格用 `display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
3. **状态轮询**: 沿用现有 5 秒 `/api/status` 轮询，状态映射规则不变
4. **Tooltip 保留**: 做 hover tooltip fallback（极窄屏时代替 Modal）
5. **降级数据**: API 不可用时，fallback 到 `demoData` 对象（现有）

---

*本规格书对应 PRD_重做修炼场.md 第 9 节验收标准。Figma 设计稿完成后，进入李长寿实现阶段。*
