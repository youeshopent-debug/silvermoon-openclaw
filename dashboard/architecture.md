# 修炼场 v4 — 沉浸式修炼场景 · 技术架构方案

> **版本**: v4 (v3 卡片矩阵 → v4 沉浸场景)
> **架构师**: 李长寿
> **PRD**: PRD_重做修炼场_v2.md
> **设计输入**: Figma_修炼场设计规格.md (美杜莎 v3 设计稿 → 场景化改造)

---

## 1. 技术选型与理由

| 层 | 技术 | 理由 |
|---|------|------|
| 渲染 | **纯 HTML/CSS/JS** | 零构建、零依赖、单文件部署。与 index.html 共享 Host，无 CORS 问题 |
| 场景背景 | **CSS gradient + box-shadow + 伪元素** | GPU 合成层，不触发 Layout/Repaint。比 Canvas 渲染省 90% 内存 |
| 粒子系统 | **CSS @keyframes 多点动画** | 20 个粒子以内单核 60fps。超 30 个改用 `transform: translate3d` 提升合成层 |
| Agent 光晕 | **CSS radial-gradient + box-shadow** | 纯 GPU 渲染，不影响 DOM 布局 |
| 动画引擎 | **CSS animation + transition** | `will-change: transform, opacity` 确保合成层。0 额外开销 |
| 数据流 | **fetch + setInterval 5s** | 复用现有 `/api/status` + `/api/heartbeats`，零改动后端 |
| 降级策略 | **内联 demoData** | 现有 `loadDemoData()` 扩容为完整的 17 Agent 演示数据 |
| 交互 | **原生 JS 事件** | 无框架，直接 DOM 操作。Modal/Filter/Search 全部复用现有逻辑 |
| 布局 | **CSS Grid + Flexbox** | 2x2 四区 Grid 布局，Chrome 100+ 原生支持 |
| 响应式 | **CSS Media Queries** | 5 个断点，全部 CSS 控制 |

**核心原则**: 不引入任何 npm 包 / CDN 库 / 构建工具，确保可维护性 = `git clone → 打开`。

---

## 2. 文件结构

```
dashboard/
├── index.html              # 主控台 (不变)
├── cultivation.html        # 修炼场 v4 (重写)
├── architecture.md         # 本文档
├── PRD_重做修炼场.md        # v3 PRD (历史)
├── PRD_重做修炼场_v2.md     # v4 PRD (当前)
└── Figma_修炼场设计规格.md   # 美杜莎设计稿
```

**单文件策略**: `cultivation.html` 保持单文件，CSS 约 300 行，HTML 约 80 行，JS 约 300 行 = ≤800 行目标。

---

## 3. 数据流图

```
┌──────────────┐     fetch('/api/status')      ┌──────────────────┐
│  银月网关     │ ◄────── setInterval 5s ──────► │  主渲染入口 ()   │
│  (main.js)   │                                │  poll()          │
└──────┬───────┘                                └────────┬─────────┘
       │ JSON response                                  │
       ▼                                                ▼
┌─────────────────┐                          ┌──────────────────────┐
│  { agents: {    │                          │  状态映射器          │
│    银月: {...},  │                          │  getStatus(name)     │
│    李长寿: {...},│                          │  → active/idle/      │
│    ... 17 agents │                          │    error/offline     │
│  }              │                          └──────────┬───────────┘
└─────────────────┘                                     │
                                                         ▼
                                              ┌──────────────────────┐
                                              │  区域分配引擎         │
                                              │  active → 练功区      │
                                              │  idle   → 休息区      │
                                              │  error  → 闭关窟      │
                                              │  offline→ 已下山       │
                                              └──────────┬───────────┘
                                                         │
                          ┌───────────────────────────────┼─────────────────┐
                          ▼                               ▼                 ▼
              ┌──────────────────┐          ┌──────────────────────┐
              │  场景层渲染        │          │  UI 覆盖层渲染       │
              │  L0 背景 (static) │          │  顶栏/统计/筛选/日志 │
              │  L1 远景 (CSS)   │          │  z-index: 100~200     │
              │  L2 平台 (CSS)   │          └──────────────────────┘
              │  L3 Agent (DOM)  │
              └──────────────────┘
```

**数据流关键路径**:
1. `poll()` → fetch API → 失败 → `loadDemoData()`
2. 成功 → 遍历 17 Agent → `getStatus()` → 分配区域
3. 区域变化检测 → `position-map` 对比 → 触发 CSS transition 移动
4. 5s 轮询 → 重复 1-3

**降级路径**: 第 1 次 fetch 失败 → 写入 `isDemo=true` → 全域 demoData 渲染 → 后续每次 fetch 尝试恢复 → 成功后 `isDemo=false` → 无缝切换真实数据。

---

## 4. CSS 层级架构 (z-index 规划)

```
z-index 层级金字塔 (从上到下):

   层  | z-index | 内容                   | 渲染策略
  ──────┼─────────┼────────────────────────┼─────────────────────────
   UI   │  200    │ Modal (Agent详情弹窗)   | position:fixed, backdrop-filter
   UI   │  150    │ 顶栏(topbar)           | position:sticky, backdrop-filter
   UI   │  120    │ 过滤栏(filter-bar)     | 跟随顶栏
   UI   │  100    │ 统计卡片(stats)         | 半透明毛玻璃
  ──────┼─────────┼────────────────────────┼─────────────────────────
   L4   │   50    │ 活动日志面板           | position:absolute, bottom
  ──────┼─────────┼────────────────────────┼─────────────────────────
   L3   │   30    │ Agent 光晕 + 名字      | position:absolute(区域内)
   L3   │   20    │ Agent 光晕外发光(glow) | ::before 伪元素
  ──────┼─────────┼────────────────────────┼─────────────────────────
   L2   │   10    │ 区域平台底座            | position:relative
   L2   │    5    │ 灵力波动/涟漪动画      | CSS animation
  ──────┼─────────┼────────────────────────┼─────────────────────────
   L1   │    3    │ 远山剪影               | SVG inline / CSS clip-path
   L1   │    2    │ 雾气/流云             | CSS translateX animation
  ──────┼─────────┼────────────────────────┼─────────────────────────
   L0   │    1    │ 天穹背景渐变           | body / .scene-bg
   L0   │    0    │ 粒子闪烁               | CSS @keyframes
  ──────┴─────────┴────────────────────────┴─────────────────────────
```

**关键规则**:
- L0-L2 使用 `position: relative/absolute` + `z-index`，与 L4 不重叠
- UI 层 (150-200) 使用 `position: sticky/fixed`，独立于场景流
- Agent hover 展开态在原 z-index 基础上 +10，确保不遮盖邻接 Agent
- Modal 使用 `position: fixed` + `z-index: 200`，全页面最高

---

## 5. 组件拆分树

```
Page: cultivation.html
├── TopBar (顶栏)
│   ├── Breadcrumb (面包屑)
│   ├── Title (标题)
│   ├── DemoBadge (演示模式标记)
│   ├── Stats (舰队/在线/离线统计)
│   └── Clock (时钟)
├── StatsBar (统计卡片行)
│   ├── MetricCard (Agent 舰队总数)
│   ├── MetricCard (在线率)
│   ├── MetricCard (异常数)
│   └── MetricCard (心跳总数)
├── FilterBar (筛选栏)
│   ├── FilterButton (全部/active/idle/error/offline)
│   └── SearchBox (搜索框)
├── SceneContainer (场景容器)           ← 核心改造
│   ├── SceneSky (L0 天穹背景)
│   │   └── Particles (粒子闪烁)
│   ├── SceneMist (L1 雾气/流云)
│   ├── SceneMountains (L1 远山剪影)
│   ├── TrainingGrounds (L2 练功区底座)
│   │   └── EnergyRipple (灵力波动)
│   ├── CouncilHall (L2 议事厅底座)
│   ├── RestingArea (L2 休息区底座)
│   │   └── LotusDecor (莲台装饰)
│   ├── SeclusionCave (L2 闭关窟底座)
│   │   └── SealGlow (血光封印)
│   ├── MountainPath (L2 已下山/山门外)
│   ├── AgentOrbs (L3 Agent 光晕组)     ← 动态生成
│   │   ├── AgentOrb (每个 Agent)
│   │   │   ├── StatusGlow (状态光晕)
│   │   │   ├── NameLabel (名字文字)
│   │   │   ├── ExpandPanel (Hover 展开)
│   │   │   └── FactionRing (阵营边缘光)
│   └── SceneDecor (装饰: 飞剑/仙鹤)
│       └── FlyingSword (CSS animation)
└── ActivityLog (底部活动日志面板)
    └── TimelineItem × N (日志条目)

└── Modal (Agent 详情弹窗)              ← 复用现有
    ├── ModalHeader (名字 + 关闭)
    ├── ModalBody (信息网格 + 活动记录)
    └── ModalFooter (操作按钮)
```

**动态生成组件**: AgentOrbs 根据 API 数据动态渲染，其余为静态 HTML 骨架。

---

## 6. 状态机设计 (Agent 四种状态 → 视觉映射)

```
                    ┌─────────────┐
                    │   online     │
                    │  connected   │
                    │  hbAge<70s   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
      ┌───────────┐ ┌──────────┐ ┌──────────┐
      │  active   │ │   idle   │ │  error   │
      │ (练功区)   │ │ (休息区)  │ │ (闭关窟)  │
      └─────┬─────┘ └────┬─────┘ └────┬─────┘
            │             │             │
            ▼             ▼             ▼
   ┌───────────────────────────────────────┐
   │              offline                  │
   │           (已下山 / 灰色)              │
   └───────────────────────────────────────┘
```

### 状态 → 视觉映射表

| 状态 | 区域 | 光晕颜色 | 光晕大小 | 动画类型 | 不透明度 | 阵营色亮度 | 可交互 |
|------|------|---------|---------|---------|---------|-----------|--------|
| **active** | 练功区 | `#22C55E` 绿 | 56px 全亮 | 呼吸悬浮 3s + 脉动 2s | 1.0 | 全亮 | ✅ |
| **idle** | 休息区 | `#F59E0B` 黄 | 48px 柔光 | 莲台旋转 20s + 微浮 | 0.8 | 60% | ✅ |
| **error** | 闭关窟 | `#EF4444` 红 | 60px 闪烁 | 脉动 1s (紧急) + 血光 | 1.0 (闪) | 禁用(染红) | ✅ |
| **offline** | 已下山 | `#52525B` 灰 | 36px 褪色 | 无动画 | 0.3 | 灰色覆盖 | ❌ (不可点击) |

### 状态切换过渡

```
触发: 5s 轮询检测到状态变化
  1. 旧区域移除 Agent DOM (0.3s opacity→0)
  2. 新区域添加 Agent DOM (0.3s opacity→0→1)
  3. 位置移动: CSS transition transform 0.6s cubic-bezier(0.34,1.56,0.64,1)
  4. 光晕颜色过渡: 0.4s ease
  5. 拖尾效果: box-shadow trail 残留 0.3s
```

**防御**: 首次加载时禁用所有动画 (`.no-animation`)，等初始渲染完成后再启用，避免入场动画冲突。

---

## 7. 响应式断点策略

| 断点 | 场景布局 | Agent 光晕尺寸 | 底座 padding | 活动日志 | 过滤栏 |
|------|---------|---------------|-------------|---------|-------|
| **≥1920px** (4K/大屏) | 四区 2x2, 间距宽松 | 64px | 32px | 右侧边栏 280px | 全宽 |
| **1366~1919px** (笔记本) | 四区 2x2, 标准间距 | 56px | 24px | 底部折叠 160px | 全宽 |
| **1024~1365px** (小平板) | 上二下二，间距紧凑 | 48px | 20px | 底部折叠 140px | 横向滚动 |
| **768~1023px** (竖屏平板) | 纵向: 练功+议事→上，休息+闭关→下 | 44px | 16px | 底部折叠 120px | 紧凑 |
| **<768px** (手机) | 瀑布流纵向单区 | 40px (退化) | 12px | 折叠，仅显示最新 3 条 | 图标化 |

**关键规则**:
- `<768px` 时场景退化方案: 保留天穹背景(简约) + 远山(移除) + 取消底座装饰 + Agent 改为小圆点列表样式
- 确保 `min-width: 1366px` 是主力设计尺寸，`<1024px` 只保证可用不保证视觉完整
- 所有场景桌面元素使用 `rem` 单位，确保缩放自适应

---

## 8. DAG 执行顺序图 (任务依赖关系)

```
阶段一: 骨架搭建 (可独立先行)
  [A] 创建 cultivation.html 新文件
    ├── [A1] HTML 骨架: topbar + stats + filter + scene + modal
    ├── [A2] CSS 变量引入: 直接复用 index.html :root 块
    └── [A3] JS 框架: 复制现有 poll() / render() / loadDemoData() 结构

阶段二: 场景层 CSS (与阶段三并行)
  [B] 场景背景系统
    ├── [B1] L0 天穹渐变: body background + 粒子 keyframes
    ├── [B2] L1 远山 SVG + 雾气 animation
    └── [B3] L1 装饰元素: 飞剑/仙鹤
  [C] 区域平台系统 (依赖 B 完成场景容器)
    ├── [C1] 四区 Grid 布局 (scene-container)
    ├── [C2] 练功区底座 + 灵力波动动画
    ├── [C3] 休息区底座 + 莲台装饰
    ├── [C4] 闭关窟底座 + 血光封印
    └── [C5] 已下山底部横条

阶段三: Agent 光晕系统 (依赖 A3 数据流 + C 区域布局)
  [D] AgentOrb 组件
    ├── [D1] 基础光晕 CSS (4 状态 × 3 阵营)
    ├── [D2] 区域分配引擎 (getStatus → zone map)
    ├── [D3] 状态切换过渡动画
    ├── [D4] Hover 展开面板
    └── [D5] 点击 → Modal 联动

阶段四: UI 覆盖层 (与阶段五并行)
  [E] 顶栏 + 统计 + 筛选
    ├── [E1] 顶栏毛玻璃效果 (backdrop-filter)
    ├── [E2] 统计卡片 (复用现有渲染函数)
    ├── [E3] 筛选 + 搜索 (复用现有逻辑)
    └── [E4] 活动日志流 (复用现有逻辑)

阶段五: 集成与打磨 (依赖 B+C+D+E 全部完成)
  [F] 集成测试
    ├── [F1] 数据流连通: fetch → render 全链路
    ├── [F2] 动画检查: 粒子/脉动/灵力/雾气 均在 60fps
    ├── [F3] 状态切换: 手动模拟 active→error→offline 循环
    ├── [F4] Modal 交互: 点击 / 关闭 / 背景点击关闭
    ├── [F5] 降级测试: 停止 API → 验证 demoData 正常显示
    └── [F6] 响应式: 4 个断点逐一检查

阶段六: 优化与验收 (依赖 F)
  [G] 性能优化
    ├── [G1] GPU 合成层检测 (Chrome DevTools Layers panel)
    ├── [G2] 确保所有动画使用 transform/opacity
    └── [G3] 检查无 Layout Thrashing
  [H] 验收检查
    ├── [H1] 对照 PRD_v2 验收清单逐一核对
    ├── [H2] 文件总行数 ≤ 800 行
    └── [H3] 归档共享记忆
```

**任务依赖矩阵**:
```
A → B → C → D → F
A → E → F
A → D → F
F → G → H
```

阶段二和三可并行开发 (美杜莎出完 CSS 场景后，李长寿写 Agent 逻辑)，但阶段五必须等全部完成。

---

## 9. 风险点与降级方案

| # | 风险 | 概率 | 影响 | Plan A (上策) | Plan B (中策) | Plan C (下策) |
|---|------|------|------|--------------|--------------|--------------|
| 1 | CSS 场景层导致首屏渲染 > 2s | 中 | 用户体验下降 | CSS 关键路径优化: L0 直接写在 body 上，L1-L2 通过 `@keyframes` 延迟 0.5s 启动 | 加载时先显示纯色背景，场景层通过 JS 在 DOMContentLoaded 后注入 | 回退到纯色背景 + Agent 网格 (当前 v3 布局) |
| 2 | 20+ 粒子动画导致帧率 < 30fps | 低 | 卡顿感 | 限制粒子数 ≤ 15，`will-change: transform` 确保合成层 | 降低粒子动画频率 (从 2s 改为 4s) | 关闭粒子动画，降为静态渐变点 |
| 3 | 状态切换动画累积导致性能抖动 | 低 | 切换卡顿 | 使用 `requestAnimationFrame` 调度切换，分批执行 (每帧最多移动 3 个 Agent) | 高负载时 `document.hidden` 暂停所有动画 | 完全禁用动画，直接硬切换 |
| 4 | API 断连且 demoData 丢失 | 极低 | 页面空白 | demoData 内联在 HTML `<script>` 中，确保文件本身包含备用数据 | 如果 demoData 也被破坏，显示 "阵法紊乱" 错误提示 + 重试按钮 | 显示静态 "宗门关闭" 占位页 |
| 5 | 区域 Agent 数量过多 (>10 拥挤) | 低 | 视觉拥挤 | AgentOrb 尺寸自适应: 区域内 >8 个时缩小到 44px，>12 个缩小到 36px | 启用区域滚动 (overflow-y: auto) | 切换到列表视图 (点击区域标题切换) |
| 6 | Chrome 版本不支持 `backdrop-filter` | 极低 | 毛玻璃失效 | 使用 `-webkit-backdrop-filter` 前缀 + Fallback: 半透明纯色背景 | 检测不支持时直接使用 `rgba(10,10,10,0.8)` 纯色 | 无降级，使用纯色 (不影响功能) |
| 7 | 响应式断点在特定尺寸下布局错乱 | 中 | 视觉破损 | 使用 `@container` 容器查询 (Chrome 100+ 支持) 做精细调节 | 使用 JS `ResizeObserver` 检测区域尺寸并动态调整 Grid | 降级为纵向瀑布流 (最差情况也可用) |

**黄金降级原则**: 任何系统无法承载场景化渲染时 → 回退到当前 v3 卡片矩阵布局。展示永远优先于沉浸。

---

## 附录 A: cultivation.html v4 文件清单

```
总行数目标: ≤ 800 行
├── HTML   ~80 行  (骨架 + demoData inline)
├── CSS    ~350 行 (场景 200 行 + Agent 80 行 + UI 70 行)
└── JS     ~370 行 (数据 80 行 + 渲染 150 行 + 交互 140 行)
```

## 附录 B: 参考实现关键路径

| 功能点 | 实现方式 | 预估行数 |
|--------|---------|---------|
| L0 天穹 | `body { background: linear-gradient(...) }` | 5 行 |
| L1 远山 | `clip-path: polygon(...)` + `::before` | 15 行 |
| L2 四区 Grid | `display: grid; grid-template: 1fr 1fr / 1fr 1fr` | 10 行 |
| 灵力波动 | `@keyframes ripple { 0%→100% }` + `background-position` | 8 行 |
| AgentOrb | `radial-gradient` + `box-shadow` + `transition` | 20 行/CSS + 30 行/JS |
| 状态切换 | `classList.replace()` + CSS transition | 5 行/JS + 10 行/CSS |
| 粒子 | `@keyframes twinkle` + `nth-child` 延迟 | 12 行 |
| 降级 | 内联 demoData 对象 | 35 行 |

---

*文档版本: v1.0 | 架构师: 李长寿 | 信心指数: 9/10*
