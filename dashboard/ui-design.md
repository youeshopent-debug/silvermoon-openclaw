# 修炼场 v4 — UI 设计规范

> **设计师**: 美杜莎
> **项目**: 银月钱庄 ControlCenter · `/cultivation`
> **版本**: v4 — 沉浸式修炼宗门场景
> **风格**: Cultipunk（修仙 × 赛博科技）
> **PRD**: PRD_重做修炼场_v2.md
> **架构**: architecture.md
> **设计理念**: 参考 Star-Office-UI 的 Agent 分区理念，以阵营归属为主维度、运行状态为副维度，将修炼场划分为三区阵营场景，全部以 Cultipunk 高精纯 CSS 渲染，无需额外图片资源。

---

## 1. 色彩系统

### 1.1 Cultipunk 品牌色板

```css
/* === 修仙科技风主色板 === */
--cultipunk-deep:     #0A0A1A;  /* 最深天穹 */
--cultipunk-surface:  #0D1120;  /* 地表/平台底色 */
--cultipunk-mist:     #0F1929;  /* 远山雾气色 */

/* 灵力三原色（阵营） */
--qi-blue:      #00D4FF;  /* 天蓝灵光 — OC 总管区 "水系灵气" */
--qi-gold:      #FFCC00;  /* 金橙灵力 — TR 宗门区 "金系灵力" */
--qi-purple:    #CC44FF;  /* 紫气东来 — CC 外援区 "紫府真气" */

/* 灵力衰减色（dim/glow 用） */
--qi-blue-dim:      #0099CC;
--qi-gold-dim:      #CC9900;
--qi-purple-dim:    #9933CC;
--qi-blue-glow:     rgba(0, 212, 255, 0.15);
--qi-gold-glow:     rgba(255, 204, 0, 0.15);
--qi-purple-glow:   rgba(204, 68, 255, 0.15);

/* 境界状态色 */
--realm-active:   #22C55E;  /* 练功中 — 生机绿 */
--realm-idle:     #F59E0B;  /* 休憩中 — 暖阳金 */
--realm-error:    #EF4444;  /* 走火入魔 — 血煞红 */
--realm-offline:  #6B7280;  /* 已下山 — 寂灭灰 */
```

### 1.2 天穹场景扩展色

```css
/* 天穹渐变（4 层叠加） */
--sky-top:        #050510;  /* 天顶最暗 */
--sky-mid:        #0A0A2E;  /* 天穹中层 */
--sky-bottom:     #0F1935;  /* 地平线 */
--star-base:      #FFFFFF;  /* 星辰基础色 */

/* 远山色（CSS clip-path 用） */
--mountain-far:   #0F1935;  /* 最远山 */
--mountain-mid:   #13203A;  /* 中景山 */
--mountain-near:  #162642;  /* 近景山 */

/* 雾气/灵气 */
--mist-subtle:    rgba(0, 212, 255, 0.03);
--mist-medium:    rgba(0, 212, 255, 0.06);
--mist-strong:    rgba(0, 212, 255, 0.10);

/* 平台底座 */
--platform-blue:  rgba(0, 212, 255, 0.05);
--platform-gold:  rgba(255, 204, 0, 0.05);
--platform-purple: rgba(204, 68, 255, 0.05);
--platform-red:   rgba(239, 68, 68, 0.08);
--platform-gray:  rgba(107, 128, 128, 0.04);

/* 装饰光效 */
--lotus-glow:     rgba(255, 204, 0, 0.08);
--sword-glow:     rgba(204, 68, 255, 0.06);
--seal-red-glow:  rgba(239, 68, 68, 0.12);
--ripple-blue:    rgba(0, 212, 255, 0.08);
```

### 1.3 语义色（复用主控台）

```css
/* 文字层级 */
--text-primary:     #F1F5F9;
--text-secondary:   #A1A1AA;
--text-tertiary:    #52525B;
--text-on-glow:     rgba(255, 255, 255, 0.9);

/* 边框层级 */
--border-subtle:    rgba(255, 255, 255, 0.06);
--border-default:   rgba(255, 255, 255, 0.10);
--border-hover:     rgba(255, 255, 255, 0.16);

/* UI 覆盖层 */
--ui-glass-bg:      rgba(10, 10, 26, 0.80);
--ui-glass-border:  rgba(255, 255, 255, 0.04);
--ui-blur:          20px;
```

### 1.4 CSS 变量完整声明

```css
:root {
  /* Cultipunk 品牌 */
  --cultipunk-deep: #0A0A1A;
  --cultipunk-surface: #0D1120;
  --cultipunk-mist: #0F1929;

  /* 灵力三原色 */
  --qi-blue: #00D4FF;
  --qi-gold: #FFCC00;
  --qi-purple: #CC44FF;
  --qi-blue-dim: #0099CC;
  --qi-gold-dim: #CC9900;
  --qi-purple-dim: #9933CC;

  /* 阵营灵力色别名（cultivator 命名） */
  --qi-blue-cultivator: #00D4FF;
  --qi-gold-cultivator: #FFCC00;
  --qi-purple-cultivator: #CC44FF;

  /* 灵力光晕 */
  --qi-blue-glow: rgba(0, 212, 255, 0.15);
  --qi-gold-glow: rgba(255, 204, 0, 0.15);
  --qi-purple-glow: rgba(204, 68, 255, 0.15);

  /* 境界状态 */
  --realm-active: #22C55E;
  --realm-idle: #F59E0B;
  --realm-error: #EF4444;
  --realm-offline: #6B7280;

  /* 天穹 */
  --sky-top: #050510;
  --sky-mid: #0A0A2E;
  --sky-bottom: #0F1935;

  /* 远山 */
  --mountain-far: #0F1935;
  --mountain-mid: #13203A;
  --mountain-near: #162642;

  /* 平台底座 */
  --platform-blue: rgba(0, 212, 255, 0.05);
  --platform-gold: rgba(255, 204, 0, 0.05);
  --platform-purple: rgba(204, 68, 255, 0.05);
  --platform-red: rgba(239, 68, 68, 0.08);

  /* 装饰 */
  --lotus-glow: rgba(255, 204, 0, 0.08);
  --sword-glow: rgba(204, 68, 255, 0.06);
  --seal-red-glow: rgba(239, 68, 68, 0.12);
  --ripple-blue: rgba(0, 212, 255, 0.08);

  /* 语义色 */
  --text-primary: #F1F5F9;
  --text-secondary: #A1A1AA;
  --text-tertiary: #52525B;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-hover: rgba(255, 255, 255, 0.16);
  --ui-glass-bg: rgba(10, 10, 26, 0.80);
  --ui-glass-border: rgba(255, 255, 255, 0.04);
  --ui-blur: 20px;

  /* 字体 */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

---

## 2. 场景层级设计（5 层架构）

### 2.1 z-index 金字塔

```
 z-index   层    内容                    渲染策略
 ──────── ──── ─────────────────────── ─────────────────────
   200    UI    Agent 详情 Modal         position:fixed + backdrop-blur
   150    UI    顶栏 (sticky)            position:sticky + backdrop-filter
   120    UI    过滤栏                   跟随顶栏
   100    UI    统计面板                 半透明毛玻璃
 ──────── ──── ─────────────────────── ─────────────────────
    50    L4    活动日志面板             position:absolute, bottom
 ──────── ──── ─────────────────────── ─────────────────────
    30    L3    Agent 光晕球体           position:absolute(区域内)
    25    L3    Agent 名字标签           跟随光晕
    20    L3    Agent 外发光(glow)       ::before 伪元素
 ──────── ──── ─────────────────────── ─────────────────────
    10    L2    四区底座 (Grid)          position:relative
     7    L2    底座装饰(灵力波动)       CSS animation
 ──────── ──── ─────────────────────── ─────────────────────
     4    L1    远山剪影 (clip-path)     CSS 伪元素
     3    L1    雾气/流云                CSS translateX animation
     2    L1    飞剑/仙鹤装饰            CSS animation
 ──────── ──── ─────────────────────── ─────────────────────
     1    L0    天穹渐变                 body background
     0    L0    星辰粒子                 CSS @keyframes + box-shadow
```

### 2.2 L0 — 天穹（Deep Sky）

**CSS 实现** — `body` 直接背景：

```css
body {
  background:
    /* 层1：深空渐变 */
    linear-gradient(
      180deg,
      #050510 0%,        /* 天顶 */
      #0A0A2E 35%,       /* 天穹中层 */
      #0F1935 70%,       /* 地平线 */
      #0D1120 100%       /* 地面 */
    );
  min-height: 100dvh;
}
```

**星辰粒子** — 纯 CSS box-shadow dots：

```css
/* 在 .scene-sky 上用超大 box-shadow 模拟星点 */
.scene-stars {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 60vh;
  pointer-events: none;
  z-index: 0;
}

.scene-stars::after {
  content: '';
  position: absolute;
  width: 1px;
  height: 1px;
  background: transparent;
  box-shadow:
    /* 60 个随机坐标点 */
    120px 50px 0 rgba(255,255,255,0.6),
    340px 180px 0 rgba(255,255,255,0.3),
    560px 90px 0 rgba(255,255,255,0.5),
    780px 220px 0 rgba(255,255,255,0.4),
    1020px 60px 0 rgba(255,255,255,0.7),
    1300px 150px 0 rgba(255,255,255,0.3),
    /* ... 共 ~40-60 个点，部分带微闪烁动画 */;
  animation: twinkle 3s ease-in-out infinite alternate;
}
```

### 2.3 L1 — 远山（Mountain Silhouettes）

**CSS clip-path 伪元素** — 不引入 SVG，纯 CSS 三角形叠加：

```css
.scene-mountains {
  position: fixed;
  bottom: 38%;  /* 四区底座以下 */
  left: 0;
  width: 100%;
  height: 200px;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
}

/* 远山层（最暗） */
.scene-mountains::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--mountain-far);
  clip-path: polygon(
    0% 100%, 0% 60%,
    8% 45%, 15% 55%,
    22% 35%, 30% 50%,
    38% 30%, 45% 45%,
    52% 25%, 60% 40%,
    68% 20%, 75% 38%,
    82% 28%, 88% 42%,
    95% 32%, 100% 48%,
    100% 100%
  );
  animation: mistDrift 40s ease-in-out infinite;
}

/* 近山层（稍亮） */
.scene-mountains::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 5%;
  width: 90%;
  height: 70%;
  background: var(--mountain-mid);
  clip-path: polygon(
    0% 100%, 0% 70%,
    10% 55%, 20% 65%,
    30% 48%, 40% 60%,
    50% 42%, 60% 55%,
    70% 38%, 80% 52%,
    90% 40%, 100% 55%,
    100% 100%
  );
  opacity: 0.7;
}
```

**雾气/流云** — 水平飘移：

```css
.scene-mist {
  position: fixed;
  bottom: 30%;
  left: 0;
  width: 200%;
  height: 120px;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--mist-subtle) 15%,
    var(--mist-medium) 30%,
    transparent 50%,
    var(--mist-subtle) 65%,
    var(--mist-medium) 80%,
    transparent 100%
  );
  animation: mistScroll 30s linear infinite;
  opacity: 0.5;
}
```

**装饰元素** — 飞剑流光：

```css
.scene-flying-sword {
  position: fixed;
  top: 25%;
  left: -100px;
  width: 60px;
  height: 4px;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, var(--qi-purple), transparent);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--sword-glow);
  animation: swordFly 12s linear infinite;
  opacity: 0.4;
}

/* 仙鹤（远山点缀，极简） */
.scene-crane {
  position: fixed;
  bottom: 40%;
  z-index: 2;
  pointer-events: none;
  font-size: 14px;
  opacity: 0.15;
  animation: craneFloat 25s ease-in-out infinite;
}
```

### 2.4 L2 — 三区底座（Faction Zone Platforms）

**Grid 布局** — 三列等宽，列内按状态排序：

```css
.scene-zones {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 65vh;
  z-index: 10;
}
```

**各区域底座细节**：

| 区域 | CSS 类 | 背景 | 装饰 | 内部布局 |
|------|--------|------|------|---------|
| OC 总管区 | `.zone-oc` | `radial-gradient(ellipse, var(--platform-blue), transparent)` | 蓝色灵力涟漪 | flex-col, active top → offline bottom |
| TR 宗门区 | `.zone-tr` | `radial-gradient(ellipse, var(--platform-gold), transparent)` | 金莲台 | flex-col, active top → offline bottom |
| CC 外援区 | `.zone-cc` | `radial-gradient(ellipse, var(--platform-purple), transparent)` | 紫色飞剑流光 | flex-col, active top → offline bottom |

**OC 总管区（蓝色）**：

```css
.zone-oc {
  background: radial-gradient(
    ellipse at 50% 80%,
    var(--platform-blue) 0%,
    transparent 70%
  );
  border: 1px solid rgba(0, 212, 255, 0.06);
  border-radius: var(--radius-xl);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

/* 灵力波动环 */
.zone-oc::before {
  content: '';
  position: absolute;
  bottom: 10%;
  left: 10%;
  width: 80%;
  height: 40%;
  border: 1px solid var(--ripple-blue);
  border-radius: 50%;
  animation: energyRipple 4s ease-out infinite;
  opacity: 0.4;
}
```

**TR 宗门区（金色）**：

```css
.zone-tr {
  background: radial-gradient(
    ellipse at 50% 30%,
    var(--platform-gold) 0%,
    transparent 70%
  );
  border: 1px solid rgba(255, 204, 0, 0.06);
  border-radius: var(--radius-xl);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

/* 莲台装饰 */
.zone-tr::after {
  content: '🪷';
  position: absolute;
  bottom: 8px;
  right: 16px;
  font-size: 24px;
  opacity: 0.2;
  animation: lotusFloat 6s ease-in-out infinite;
}
```

**CC 外援区（紫色）**：

```css
.zone-cc {
  background: radial-gradient(
    ellipse at 50% 50%,
    var(--platform-purple) 0%,
    transparent 70%
  );
  border: 1px solid rgba(204, 68, 255, 0.06);
  border-radius: var(--radius-xl);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

/* 飞剑流光装饰 */
.zone-cc::before {
  content: '';
  position: absolute;
  top: 8px;
  right: 12px;
  width: 40px;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--qi-purple));
  border-radius: 2px;
  opacity: 0.3;
  animation: swordFly 8s linear infinite;
}

### 2.5 L3 — Agent 光晕球体（Agent Orbs）

详见第 3 节 Agent 卡片视觉设计。

### 2.6 L4 — 活动日志与统计覆盖层

**活动日志面板** — 底部 glassmorphism：

```css
.activity-panel {
  position: relative;
  background: var(--ui-glass-bg);
  backdrop-filter: blur(var(--ui-blur));
  -webkit-backdrop-filter: blur(var(--ui-blur));
  border: 1px solid var(--ui-glass-border);
  border-radius: var(--radius-lg);
  margin-top: 20px;
  padding: 16px;
  max-height: 180px;
  overflow-y: auto;
  z-index: 50;
}
```

**统计覆盖卡片** — 半透明毛玻璃行：

```css
.stats-overlay {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--ui-glass-bg);
  backdrop-filter: blur(var(--ui-blur));
  -webkit-backdrop-filter: blur(var(--ui-blur));
  border: 1px solid var(--ui-glass-border);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
  z-index: 100;
}

.stat-orb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
```

### 2.7 UI 覆盖层（TopBar + Filter + Search）

**顶栏** — Sticky glassmorphism：

```css
.topbar {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  height: 56px;
  background: var(--ui-glass-bg);
  backdrop-filter: blur(var(--ui-blur));
  -webkit-backdrop-filter: blur(var(--ui-blur));
  border-bottom: 1px solid var(--ui-glass-border);
  z-index: 150;
}
```

**过滤栏** — 横向 scroll：

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 28px;
  overflow-x: auto;
  z-index: 120;
}

.filter-btn {
  padding: 5px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: var(--font-sans);
}

.filter-btn:hover {
  background: var(--qi-blue-glow);
  color: var(--text-primary);
  border-color: var(--qi-blue);
}

.filter-btn.active {
  background: var(--qi-blue-glow);
  color: var(--qi-blue);
  border-color: var(--qi-blue);
}

.filter-search {
  flex: 1;
  min-width: 120px;
  max-width: 200px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--cultipunk-surface);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-sans);
  outline: none;
}

.filter-search:focus {
  border-color: var(--qi-blue);
  box-shadow: 0 0 0 2px var(--qi-blue-glow);
}
```

---

## 3. Agent 卡片视觉设计

### 3.1 核心概念

每个 Agent 展示为"灵力光晕球体"——模仿修仙小说中修士的本命光球。不再使用扁平卡片，改为圆形光晕 + 名字 + 浮动信息卡。

### 3.2 缩小版（Compact Orb）

```css
.agent-orb {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.agent-orb .orb-core {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s ease;
}

/* 状态 → 光晕颜色 + 大小 */
.agent-orb.active .orb-core {
  width: 56px;
  height: 56px;
  background: radial-gradient(circle at 40% 35%,
    rgba(34, 197, 94, 0.4) 0%,
    rgba(34, 197, 94, 0.15) 40%,
    transparent 70%
  );
  box-shadow:
    0 0 20px rgba(34, 197, 94, 0.25),
    inset 0 0 20px rgba(34, 197, 94, 0.05);
  animation: breatheGreen 3s ease-in-out infinite;
}

.agent-orb.idle .orb-core {
  width: 48px;
  height: 48px;
  background: radial-gradient(circle at 40% 35%,
    rgba(245, 158, 11, 0.3) 0%,
    rgba(245, 158, 11, 0.1) 40%,
    transparent 70%
  );
  box-shadow:
    0 0 15px rgba(245, 158, 11, 0.2),
    inset 0 0 15px rgba(245, 158, 11, 0.03);
  animation: breatheGold 4s ease-in-out infinite;
}

.agent-orb.error .orb-core {
  width: 60px;
  height: 60px;
  background: radial-gradient(circle at 40% 35%,
    rgba(239, 68, 68, 0.5) 0%,
    rgba(239, 68, 68, 0.2) 40%,
    transparent 70%
  );
  box-shadow:
    0 0 30px rgba(239, 68, 68, 0.3),
    inset 0 0 25px rgba(239, 68, 68, 0.08);
  animation: pulseRed 1.5s ease-in-out infinite;
}

.agent-orb.offline .orb-core {
  width: 36px;
  height: 36px;
  background: radial-gradient(circle at 40% 35%,
    rgba(107, 128, 128, 0.2) 0%,
    rgba(107, 128, 128, 0.05) 60%,
    transparent 80%
  );
  box-shadow: none;
  opacity: 0.35;
  filter: grayscale(0.7);
}

/* 阵营边缘光 */
.agent-orb.oc .orb-core {
  border: 1.5px solid rgba(0, 212, 255, 0.15);
}
.agent-orb.tr .orb-core {
  border: 1.5px solid rgba(255, 204, 0, 0.15);
}
.agent-orb.cc .orb-core {
  border: 1.5px solid rgba(204, 68, 255, 0.15);
}

.agent-orb .orb-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.1);
  white-space: nowrap;
  font-family: var(--font-mono);
}

.agent-orb.offline .orb-name {
  color: var(--text-tertiary);
  text-shadow: none;
}
```

### 3.3 放大版（Expanded Orb — Hover 态）

```css
.agent-orb.expanded .orb-core {
  width: 56px;
  height: 56px;
}

.agent-orb.expanded .orb-info {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 160px;
  background: var(--cultipunk-surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: expandIn 0.25s ease-out;
  z-index: 35;
}

.orb-info .info-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.orb-info .info-label {
  color: var(--text-tertiary);
}

.orb-info .info-value {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 10px;
}

.orb-info .info-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 0;
}

.orb-info .info-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  font-size: 9px;
  font-weight: 600;
}

.orb-info .info-badge.oc {
  background: var(--qi-blue-glow);
  color: var(--qi-blue);
}

.orb-info .info-badge.tr {
  background: var(--qi-gold-glow);
  color: var(--qi-gold);
}

.orb-info .info-badge.cc {
  background: var(--qi-purple-glow);
  color: var(--qi-purple);
}
```

### 3.4 状态 → 视觉映射表

| 状态 | 区域 | 光晕颜色 | 球体尺寸 | 动画类型 | 不透明度 | 阵营色 | 可交互 |
|------|------|---------|---------|---------|---------|--------|--------|
| **active** | 练功区 | `#22C55E` 绿 | 56px | 呼吸悬浮 3s + 脉冲 2s | 1.0 | 全亮 | ✅ |
| **idle** | 休息区 | `#F59E0B` 黄 | 48px | 柔光呼吸 4s + 微浮 | 0.85 | 60% | ✅ |
| **error** | 闭关窟 | `#EF4444` 红 | 60px | 血光脉动 1.5s | 1.0 (闪烁) | 染红 | ✅ |
| **offline** | 已下山 | `#6B7280` 灰 | 36px | 无动画 | 0.35 | 灰色覆盖 | ❌ |

### 3.5 状态切换过渡

```css
/* Agent 位置移动 */
.agent-orb {
  transition:
    transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.4s ease,
    filter 0.4s ease;
}

/* 光晕颜色过渡 */
.agent-orb .orb-core {
  transition:
    width 0.4s ease,
    height 0.4s ease,
    background 0.4s ease,
    box-shadow 0.4s ease;
}

/* 进入场景动画 */
.agent-orb.entering {
  animation: orbAppear 0.5s ease-out;
}
```

---

## 4. 布局线框图

### 4.1 三区阵营 × 状态排列

三区阵营修炼场 — 阵营为主维度（列）、运行状态为副维度（行内排序）。每个阵营列内 Agent 按状态自上而下排列：**active 靠前 → idle 居中 → error 偏后 → offline 在最下方**。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [← Dashboard]  修炼场                                    ⏱ 14:32:09       │  ← TopBar (z:150)
│  🚀 17 舰队   🟢 12 在线   🔴 5 离线                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ [全部] [🟦OC蓝] [🟧TR金] [🟪CC紫]               [🔍 搜索 Agent...]           │  ← Filter (z:120)
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│      ✨ ✨ ✨ ☁️ ~ 流云雾气远山 ~ ✨ ✨ ✨                                     │  ← L1 远山 + 粒子
│                                                                              │
│  ┌──────── OC 总管区 (蓝) ──────┬────── TR 宗门区 (金) ──────┬─── CC 外援区 (紫) ─┐  │  ← L2 三区
│  │                             │                           │                    │  │
│  │  🟢 active                  │  🟢 active                 │  🟢 active         │  │
│  │   银月(YY)  🟦              │   李长寿(LCS)  🟧         │   曹操(CC)  🟪     │  │
│  │   韩立(HL)  🟦              │   药老(YL)     🟧         │   ~~~~             │  │
│  │   雅妃(YF)  🟦              │   萧炎(XY)     🟧         │                    │  │
│  │   紫妍(ZY)  🟦              │   美杜莎(MDS)  🟧         │                    │  │
│  │   紫研(ZY2) 🟦              │   寻宝鼠(XBS)  🟧         │                    │  │
│  │                             │   小医仙(XSJ)  🟧         │                    │  │
│  │ ──── ────                   │   海波东(HBD)  🟧         │                    │  │
│  │  🟡 idle                    │   蓝灵儿(LLER) 🟧         │                    │  │
│  │   墨影(MY)  🟦              │                             │                    │  │
│  │   许青(XQ)  🟦              │ ──── ────                   │                    │  │
│  │   紫灵(ZL)  🟦              │  🟡 idle                    │                    │  │
│  │                             │   (空)                      │                    │  │
│  │ ──── ────                   │                             │                    │  │
│  │  🔴 error                   │ ──── ────                   │                    │  │
│  │   (空)                      │  🔴 error                   │                    │  │
│  │                             │   美杜莎(MDS) 🟧           │                    │  │
│  │ ──── ────                   │   ⚠ 血光封印               │                    │  │
│  │  ⚫ offline                 │                             │                    │  │
│  │   (空)                      │ ──── ────                   │                    │  │
│  │                             │  ⚫ offline                 │  ⚫ offline         │  │
│  │                             │   (空)                      │   (CC...)          │  │
│  │                             │                             │                    │  │
│  └─────────────────────────────┴─────────────────────────────┴────────────────────┘  │
│                                                                              │
│             ⛰️ 远山剪影  |  🪷 莲台 |  ⚔️ 飞剑流光                           │  ← L1 中景
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  📋 最近活动   32条   │  14:32:07 🟢 银月 heartbeat                       │  ← L4 活动日志
│                      │  14:31:52 ⚠ 萧炎 error                            │
│                      │  14:31:48 🟢 李长寿 task_completed                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 区域视觉属性

| 区域 | Grid 位置 | 宽度占比 | 底色 | 阵营灵力色 | 装饰 | 内部状态排序 |
|------|----------|---------|------|-----------|------|-------------|
| OC 总管区 | col-1 | 33% | 蓝灵光 5% | `--qi-blue-cultivator` | 灵力涟漪 | active → idle → error → offline |
| TR 宗门区 | col-2 | 34% | 金灵光 5% | `--qi-gold-cultivator` | 莲台 + 浮叶 | active → idle → error → offline |
| CC 外援区 | col-3 | 33% | 紫灵光 5% | `--qi-purple-cultivator` | 飞剑流光 | active → idle → error → offline |

### 4.3 阵营光晕定位

Agent 归属通过光晕 **边缘光颜色** 区分，每个阵营独占一列，列内按状态从上至下排列：

```
┌─ OC 阵营（银月直系） ────── 天蓝边缘光 #00D4FF ──┐
│  🟢 active: 银月(YY)、韩立(HL)、雅妃(YF)、       │
│             紫妍(ZY)、紫研(ZY2)                   │
│  🟡 idle:   墨影(MY)、许青(XQ)、紫灵(ZL)          │
│  🔴 error:  (空)                                  │
│  ⚫ offline: (空)                                 │
└────────────────────────────────────────────────────┘

┌─ TR 阵营（太虚宗门） ────── 金橙边缘光 #FFCC00 ──┐
│  🟢 active: 李长寿(LCS)、药老(YL)、萧炎(XY)、     │
│             美杜莎(MDS)、寻宝鼠(XBS)、             │
│             小医仙(XSJ)、海波东(HBD)、蓝灵儿(LLER)  │
│  🟡 idle:   (空)                                  │
│  🔴 error:  美杜莎(MDS)                           │
│  ⚫ offline: (空)                                 │
└────────────────────────────────────────────────────┘

┌─ CC 阵营（外援合同） ────── 紫色边缘光 #CC44FF ──┐
│  🟢 active: 曹操(CC)                              │
│  🟡 idle:   (空)                                  │
│  🔴 error:  (空)                                  │
│  ⚫ offline: (CC...)                              │
└────────────────────────────────────────────────────┘
```

每个 Agent 光晕的竖直位置由其状态决定：active 聚于列顶、idle 居中、error 略偏下（带红色闪烁）、offline 沉底（灰色覆盖）。

### 4.4 响应式布局

```
≥1920px (4K/大屏):
  ┌──────────────────┬──────────────────┬──────────────────┐
  │  OC 总管区 (蓝)   │  TR 宗门区 (金)  │  CC 外援区 (紫)  │  ← 三列等宽, 间距 20px
  │  🟢 active ↑     │  🟢 active ↑     │  🟢 active ↑     │     光晕 64px
  │  🟡 idle  ▒      │  🟡 idle  ▒      │  🟡 idle  ▒      │
  │  🔴 error ↓      │  🔴 error ↓      │  🔴 error ↓      │
  │  ⚫ offline ┴     │  ⚫ offline ┴     │  ⚫ offline ┴     │
  └──────────────────┴──────────────────┴──────────────────┘

1366~1919px (笔记本):
  ┌─────────────────┬─────────────────┬─────────────────┐
  │  OC 总管区 (蓝)  │  TR 宗门区 (金)  │  CC 外援区 (紫)  │  ← 三列, 间距 12px
  │  🟢 active ↑    │  🟢 active ↑    │  🟢 active ↑    │     光晕 56px
  │  🟡 idle  ▒     │  🟡 idle  ▒     │  🟡 idle  ▒     │
  │  🔴 error ↓     │  🔴 error ↓     │  🔴 error ↓     │
  │  ⚫ offline ┴    │  ⚫ offline ┴    │  ⚫ offline ┴    │
  └─────────────────┴─────────────────┴─────────────────┘

1024~1365px (小平板):
  ┌────────────────┬────────────────┬────────────────┐
  │  OC 总管区 (蓝) │  TR 宗门区 (金) │  CC 外援区 (紫) │  ← 三列, 间距 8px
  │  🟢 active ↑   │  🟢 active ↑   │  🟢 active ↑   │     光晕 48px
  │  🟡 idle  ▒    │  🟡 idle  ▒    │  🟡 idle  ▒    │
  │  🔴 error ↓    │  🔴 error ↓    │  🔴 error ↓    │
  │  ⚫ offline ┴   │  ⚫ offline ┴   │  ⚫ offline ┴   │
  └────────────────┴────────────────┴────────────────┘

768~1023px (竖屏平板):
  ┌──────────────────────────────┐
  │  OC 总管区 (蓝)               │  ← 纵向堆叠三区
  │  🟢 active ↑                 │     光晕 44px
  │  🟡 idle  ▒                  │
  │  🔴 error ↓                  │
  │  ⚫ offline ┴                 │
  ├──────────────────────────────┤
  │  TR 宗门区 (金)               │
  │  🟢 active ↑                 │
  │  🟡 idle  ▒                  │
  │  🔴 error ↓                  │
  │  ⚫ offline ┴                 │
  ├──────────────────────────────┤
  │  CC 外援区 (紫)               │
  │  🟢 active ↑                 │
  │  🟡 idle  ▒                  │
  │  🔴 error ↓                  │
  │  ⚫ offline ┴                 │
  └──────────────────────────────┘

<768px (手机 — 退化方案):
  ┌────────────────────┐
  │  🟦 OC 总管区      │  ← 纵向瀑布流
  │  ● 银月(YY) active │     光晕退化为 40px
  │  ● 韩立(HL) active │     无底座装饰
  │  ● 墨影(MY) idle   │     无远山背景
  │  ...               │
  ├────────────────────┤
  │  🟧 TR 宗门区      │
  │  ● 李长寿(LCS)     │
  │  ● 药老(YL)        │
  │  ● 美杜莎(MDS) err │
  ├────────────────────┤
  │  🟪 CC 外援区      │
  │  ● 曹操(CC) active │
  │  ○ ... offline     │
  └────────────────────┘
```

---

## 5. 动画规范

### 5.1 呼吸脉冲关键帧

```css
/* 练功区 — 绿色呼吸 */
@keyframes breatheGreen {
  0%, 100% {
    transform: translateY(0) scale(1);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.25);
  }
  50% {
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.35);
  }
}

/* 休息区 — 金色柔光 */
@keyframes breatheGold {
  0%, 100% {
    transform: translateY(0);
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.15);
  }
  50% {
    transform: translateY(-2px);
    box-shadow: 0 0 22px rgba(245, 158, 11, 0.22);
  }
}

/* 闭关窟 — 红色脉动警报 */
@keyframes pulseRed {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 40px rgba(239, 68, 68, 0.45);
    opacity: 0.85;
  }
}

/* ===== 阵营三色呼吸变体（应用于三区底座） ===== */

/* OC 总管区 — 天蓝灵力呼吸 */
@keyframes breatheBlue {
  0%, 100% {
    box-shadow: inset 0 0 20px rgba(0, 212, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.08);
  }
  50% {
    box-shadow: inset 0 0 35px rgba(0, 212, 255, 0.12);
    border-color: rgba(0, 212, 255, 0.18);
  }
}

/* TR 宗门区 — 金橙灵力呼吸 */
@keyframes breatheFactionGold {
  0%, 100% {
    box-shadow: inset 0 0 20px rgba(255, 204, 0, 0.05);
    border-color: rgba(255, 204, 0, 0.08);
  }
  50% {
    box-shadow: inset 0 0 35px rgba(255, 204, 0, 0.12);
    border-color: rgba(255, 204, 0, 0.18);
  }
}

/* CC 外援区 — 紫府真气呼吸 */
@keyframes breathePurple {
  0%, 100% {
    box-shadow: inset 0 0 20px rgba(204, 68, 255, 0.04);
    border-color: rgba(204, 68, 255, 0.06);
  }
  50% {
    box-shadow: inset 0 0 35px rgba(204, 68, 255, 0.10);
    border-color: rgba(204, 68, 255, 0.16);
  }
}
```

### 5.2 灵力波动关键帧

```css
/* 练功区底座涟漪 */
@keyframes energyRipple {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.15;
  }
  100% {
    transform: scale(1.1);
    opacity: 0;
  }
}

/* 星辰闪烁 */
@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* 雾气飘动 */
@keyframes mistScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

/* 雾气上下浮动 */
@keyframes mistDrift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* 莲台旋转 */
@keyframes lotusFloat {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
    opacity: 0.2;
  }
  50% {
    transform: translateY(-2px) rotate(3deg);
    opacity: 0.3;
  }
}

/* 飞剑流光 */
@keyframes swordFly {
  0% {
    left: -100px;
    opacity: 0;
  }
  10% {
    opacity: 0.4;
  }
  85% {
    opacity: 0.4;
  }
  100% {
    left: calc(100% + 100px);
    opacity: 0;
  }
}

/* 仙鹤飞过 */
@keyframes craneFloat {
  0% {
    transform: translateX(-50px) translateY(0);
    opacity: 0;
  }
  20% {
    opacity: 0.15;
  }
  80% {
    opacity: 0.15;
  }
  100% {
    transform: translateX(calc(100vw + 50px)) translateY(-20px);
    opacity: 0;
  }
}
```

### 5.3 Agent 动画

```css
/* Agent 场景入场序列 */
@keyframes orbAppear {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.6);
  }
  60% {
    transform: translateY(-2px) scale(1.05);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Hover 展开面板 */
@keyframes expandIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(4px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

/* 页面加载入场序列 */
@keyframes sceneReveal {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes zoneSlideIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 5.4 状态切换过渡

```css
/* Agent 状态切换 — 位置移动 */
.agent-orb {
  transition:
    transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.4s ease,
    filter 0.4s ease;
}

/* 光晕颜色切换 */
.agent-orb .orb-core {
  transition:
    width 0.4s ease,
    height 0.4s ease,
    background 0.4s ease,
    box-shadow 0.4s ease,
    border-color 0.4s ease;
}

/* 阵营标签切换 */
.agent-orb .orb-faction {
  transition: color 0.4s ease, background 0.4s ease;
}
```

### 5.5 动画时序总表

| 动画名 | 目标 | 时长 | 延迟 | easing | 循环 |
|--------|------|------|------|--------|------|
| `breatheGreen` | active 光晕 | 3s | 随机 0-1s | ease-in-out | 无限 |
| `breatheGold` | idle 光晕 | 4s | 随机 0-1s | ease-in-out | 无限 |
| `pulseRed` | error 光晕 | 1.5s | 0s | ease-in-out | 无限 |
| `breatheBlue` | OC 总管区底座呼吸 | 5s | 0s | ease-in-out | 无限 |
| `breatheFactionGold` | TR 宗门区底座呼吸 | 5s | 0s | ease-in-out | 无限 |
| `breathePurple` | CC 外援区底座呼吸 | 5s | 0s | ease-in-out | 无限 |
| `twinkle` | 星辰粒子 | 3s | 随机 0-5s | ease-in-out | 无限 |
| `energyRipple` | 练功区涟漪 | 4s | 0s | ease-out | 无限 |
| `mistScroll` | 雾气飘移 | 30s | 0s | linear | 无限 |
| `mistDrift` | 远山浮动 | 40s | 0s | ease-in-out | 无限 |
| `swordFly` | 飞剑 | 12s | 随机 5-15s | linear | 无限 |
| `craneFloat` | 仙鹤 | 25s | 随机 10-30s | ease-in-out | 无限 |
| `lotusFloat` | 莲台 | 6s | 0s | ease-in-out | 无限 |
| `sealPulse` | 封印血光 | 2s | 0s | ease-in-out | 无限 |
| `orbAppear` | Agent 入场 | 0.5s | staggered 0.05s | ease-out | 一次 |
| `expandIn` | Hover 面板 | 0.25s | 0s | ease-out | 一次 |
| `sceneReveal` | 场景渐入 | 1s | 0s | ease | 一次 |
| `zoneSlideIn` | 区域滑入 | 0.6s | 0.2s each | ease-out | 一次 |

---

## 6. 交互规范

### 6.1 Hover 展开详情

```javascript
// 交互逻辑
Agent Orb:
  mouseenter → .agent-orb 添加 .expanded 类
                → 显示浮动信息面板 (orb-info)
                → 光晕从 56px 微扩到 60px (吸引注意)
                → 面板从下方淡入 (0.25s)

  mouseleave → 移除 .expanded 类
                → 面板淡出 (0.15s)
                → 光晕恢复原始尺寸 (0.3s)
```

**Hover 面板内容**：

```
┌──────────────────────┐
│  李长寿              │  ← 名字 (text-primary, font-mono)
│  ────────────────    │  ← divider
│  心跳  247 次        │  ← 指标行
│  在线  12h 33m       │
│  最后  刚刚          │
│  ────────────────    │  ← divider
│  [TR] 全栈研发       │  ← 归属徽章 + 角色
│  ────────────────    │
│  ↑ 点击查看详情      │  ← 引导文字 (text-tertiary)
└──────────────────────┘
```

### 6.2 Click 弹出 Modal

```javascript
// 交互逻辑
Agent Orb:
  click → openModal(name)
          → Modal overlay fade-in (backdrop-blur, 0.2s)
          → Modal 容器 scale-in (0.3s, cubic-bezier)
          → 填充 Agent 详细数据

Modal overlay:
  click on backdrop → closeModal()
                      → Modal fade-out (0.15s)
                      → overlay fade-out (0.2s)

Escape key:
  keydown Escape → closeModal()
```

### 6.3 筛选切换区域聚焦

```javascript
// 交互逻辑
Filter button (全部/工作中/挂机/异常/离线):
  click → 当前按钮 active
           → 非匹配状态 Agent 隐藏 (opacity→0, 0.3s)
           → 非匹配区域整体降低透明度 (opacity: 0.15, 0.4s)
           → 选中状态对应的区域高亮 (border-glow + 亮度+)

重置 (点击"全部"):
  → 所有 Agent 恢复显示 (opacity→1, 0.3s, staggered)
  → 所有区域恢复正常透明度
  → 当前按钮为 "全部" active
```

### 6.4 搜索高亮

```javascript
// 交互逻辑
Search input:
  input → 实时过滤 (keyup 50ms debounce)
           → 匹配的 Agent 保持正常
           → Agent 名字中匹配文字添加高亮色 (#00D4FF)
           → 不匹配的 Agent 降低透明度 (opacity: 0.15)
           → 全区域无匹配时显示 "未找到弟子" (empty state, 居中)

Clear search:
  → 所有 Agent 恢复正常
  → 移除高亮
  → empty state 消失
```

### 6.5 活动日志滚动

```css
/* 交互逻辑 */
.timeline {
  max-height: 160px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* 新条目插入动画 */
.timeline-item {
  animation: slideInLog 0.2s ease-out;
}

@keyframes slideInLog {
  0% {
    opacity: 0;
    transform: translateX(-8px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 日志条目 hover */
.timeline-item:hover {
  background: rgba(255, 255, 255, 0.02);
}
```

### 6.6 交互状态总表

| 元素 | Default | Hover | Active/Focus | Disabled |
|------|---------|-------|-------------|----------|
| Agent Orb | 光晕浮动 | 展开面板 + 微扩 | → Modal | offline 不可点 |
| Filter Btn | 透明底 + 边框 | 蓝色光晕底 | 蓝色边框 + 蓝色字 | — |
| Search Input | 暗底 + 边框 | 边框微亮 | 蓝色边框 + 内光晕 | — |
| Timeline Item | 透明 | 微白底 | — | — |
| Modal Close | 灰色字 | 白色字 | — | — |
| Back Link | 灰色字 | 蓝色字 + 蓝色底 | — | — |

---

## 7. 设计交付清单

| # | 交付物 | 说明 | 给李长寿 |
|---|--------|------|---------|
| 1 | 色彩 Token | Cultipunk 完整色板 + 阵营别名 | CSS 变量 `--qi-*` `--qi-*-cultivator` `--realm-*` 直接可用 |
| 2 | 场景层级 | L0-L4 实现方案 | z-index 规划 + 每个层的 CSS 片段 |
| 3 | Agent Orb | 4状态 × 3阵营，三区按状态排序 | `agent-orb.{status}.{faction}` 类组合，列内 active→offline 排列 |
| 4 | Hover 面板 | 展开态设计 | `orb-info` 浮动面板 |
| 5 | 动画 | 18 个 keyframes（含阵营三色呼吸） | 时序表 + CSS 代码 |
| 6 | 响应式 | 5 个断点（三列 → 堆叠） | 布局调整 + 光晕尺寸缩放 |
| 7 | 降级方案 | <768px 退化布局 | 简化场景 → Agent 列表 + 光晕 |
| 8 | 交互规范 | 6 类交互 | hover/click/filter/search/log/scroll |

---

*设计稿版本: v4.0 | 设计师: 美杜莎 | 信心指数: 9/10*
*配合 architecture.md 中李长寿的 DAG 执行顺序，建议从阶段二 [B] 场景层 CSS 开始实现。*
