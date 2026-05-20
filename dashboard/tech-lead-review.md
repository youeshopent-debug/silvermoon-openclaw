# 修炼场 v4 — Tech Lead 最终审查结论

> **审查人**: 李长寿 (LCS)
> **审查对象**: PRD_重做修炼场_v2.md / ui-design.md / architecture.md
> **审查日期**: 2026-05-19
> **信心指数**: 9/10
> **核心结论**: architecture.md **全面失效**，以 PRDv2 + ui-design.md 为准

---

## 1. 文档一致性审查（冲突标注）

### 🔴 致命冲突：architecture.md 基于 v1 旧设计

| 维度 | architecture.md (v1) | PRDv2 + ui-design.md (v2) | 裁决 |
|------|--------------------|--------------------------|------|
| 布局哲学 | 5 区域（2x2 Grid + 底部横条） | 3 阵营列（OC左/TR中/CC右） | **以 v2 为准** |
| 区域划分 | 练功区/议事厅/休息区/闭关窟/已下山 | OC 总管区/TR 宗门区/CC 外援区 | **以 v2 为准** |
| 筛选维度 | 按状态过滤（全部/工作中/挂机/异常/离线） | 按阵营过滤（全部/OC蓝/TR金/CC紫） | **以 v2 为准** |
| 统计卡片 | 独立 z-index:100 覆盖层 | 顶栏内嵌一行数字 | **以 v2 为准** |
| 文件预算 | ≤800 行（CSS 350 行） | CSS ≤1200 行，总文件 ≤2000 行 | **按主人新预算** |

**裁决：architecture.md 宣告失效，不再作为开发引用源。** 以下所有任务拆解基于 PRDv2 + ui-design.md。

---

### 🟡 PRDv2 自身矛盾：Agent 阵营分配数据错误

| 阵营 | PRDv2 写的 | 实际代码（correct） | 偏差 |
|------|-----------|-------------------|------|
| OC | 银月/李长寿/韩立/墨影/雅妃/许青/紫灵（7人） | 银月/韩立/雅妃/墨影/许青/紫灵/紫妍/紫研（**8人**） | 少算紫妍+紫研，多算李长寿 |
| TR | 药老/萧炎/紫妍/紫研/美杜莎（5人） | 李长寿/药老/萧炎/美杜莎/寻宝鼠/小医仙/海波东/蓝灵儿（**8人**） | 少算李长寿/寻宝鼠/小医仙/海波东/蓝灵儿 |
| CC | 寻宝鼠/小医仙/海波东/蓝灵儿（4人） | 曹操（**1人**） | 多算 3 人 |

**修正后阵营分配（以代码为准）**：

| 阵营 | 色值 | 位置 | Agent |
|------|------|------|-------|
| **OC** | `#00D4FF` 蓝 | 左侧 | 银月、韩立、雅妃、墨影、许青、紫灵、紫妍、紫研（×8） |
| **TR** | `#FFCC00` 金 | 居中 | 李长寿、药老、萧炎、美杜莎、寻宝鼠、小医仙、海波东、蓝灵儿（×8） |
| **CC** | `#CC44FF` 紫 | 右侧 | 曹操（×1） |

---

### 🟢 一致确认（无冲突）

以下三点三份文档完全一致：

1. **技术栈**：纯 HTML/CSS/JS 单文件，零 npm 依赖
2. **数据流**：5s 轮询 `/api/status` + 内联 demoData 降级
3. **状态映射**：active/idle/error/offline 四态判定逻辑不变

---

## 2. 三阵营分区方案确认 ✅

```
┌──────────────────────────────────────────────────────────────────┐
│                       天穹 (渐变星空)                            │
│      ☁️ 流云雾气 (CSS 动画)       ✨ 粒子闪烁                     │
│                                                                  │
│  ┌── OC 总管区 (蓝) ──┐  ┌── TR 宗门区 (金) ──┐  ┌─ CC 外援(紫) ┐  │
│  │  🟢 active  ↑      │  │  🟢 active  ↑      │  │ 🟢 active ↑  │  │
│  │   银月 韩立 雅妃    │  │   李长寿 药老 萧炎  │  │   曹操       │  │
│  │   紫妍 紫研        │  │   美杜莎 寻宝鼠     │  │              │  │
│  │  🟡 idle   ▒       │  │   小医仙 海波东     │  │              │  │
│  │   墨影 许青 紫灵   │  │   蓝灵儿           │  │              │  │
│  │  🔴 error  ↓       │  │  🟡 idle   ▒       │  │ 🔴 error ↓   │  │
│  │   (空)             │  │   (空)             │  │  (空)        │  │
│  │  ⚫ offline ┴       │  │  🔴 error  ↓       │  │ ⚫ offline ┴  │  │
│  │   (空)             │  │   (空)             │  │  (空)        │  │
│  │                    │  │  ⚫ offline ┴       │  │              │  │
│  │                    │  │   (空)             │  │              │  │
│  └──── 灵力涟漪 ~~~~  ┘  └──── 莲台装饰 🪷 ────┘  └── 飞剑流光 ──┘  │
│                                                                  │
│                ⛰️ 远山剪影 (CSS clip-path)                        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ 📋 最近活动   50条   │ 14:32:07 🟢 银月 heartbeat               │
├──────────────────────────────────────────────────────────────────┤
│ [全部] [OC蓝] [TR金] [CC紫]   [🔍 搜Agent...]                   │
└──────────────────────────────────────────────────────────────────┘
```

### 阵内排列规则

```
每阵营列内从上到下:  active → idle → error → offline
                   (练功层) (休息层) (闭关层) (已下山)
                   
active 靠上 → 视觉上最先被看到
idle   居中 → 次要注意力
error  偏下 → 红色闪烁吸引注意
offline 沉底 → 灰色褪色，不干扰
```

---

## 3. Star-Office-UI 映射确认 ✅

| Star-Office-UI | 修炼场 v2 | 映射说明 |
|---------------|----------|---------|
| 🛋️ **休息区** (人员在岗) | **练功层** (active, 列顶) | 对应"人正在做事"——我们的 Agent 正活跃工作中 |
| 💼 **工作区** (工位喘息) | **休息层** (idle, 列中) | 对应"人在但不忙"——Agent 闲置待命中 |
| 🐛 **Bug 区** (问题隔离) | **闭关层** (error, 列下) | 对应"出故障需要修复"——异常 Agent 入窟 |
| ❌ 无直接映射 | **已下山** (offline, 列底) | 我们的新增层——离线/断连 Agent 灰化沉底 |

**核心继承**：Star-Office-UI 的"空间位置 = 状态"原则被完整保留，但维度从"全页面按状态分区"升级为"全页面按阵营分三列，列内按状态排列"。

---

## 4. 预算确认

| 模块 | 预算上限 | 实际估算 | 风险 |
|------|---------|---------|------|
| CSS | **≤1200 行** | 800~1000 行 | ✅ 安全 |
| HTML（骨架） | 计入总预算 | 80~100 行 | ✅ |
| JS（逻辑） | 计入总预算 | 400~500 行 | ✅ |
| **cultivation.html 总计** | **≤2000 行** | **1280~1600 行** | ✅ **安全** |

**CSS 节省关键**：ui-design.md 提供了 30+ 个 CSS 变量 + 18 个 @keyframes，但实际开发中可直接引用变量体系，无需重复声明 v1 的旧变量 —— 实际 CSS 可压缩到 ≤1000 行。

---

## 5. 最终开发任务拆解

### Phase 0：基础设施（~130 行）

| 任务 | 内容 | 估算行数 | 产出 |
|------|------|---------|------|
| **P0-A** | 创建 `cultivation.html`，写入 `:root` CSS 变量块（合并 ui-design.md §1.4 全部变量 + 现有语义色） | 50 | 完整 CSS 变量体系 |
| **P0-B** | 粘贴 JS 常量区：`ALL_AGENTS[17]` + `AGENT_BADGE` + `SECTIONS` + `getStatus()` + `timeAgo()` + `fmtDuration()` | 45 | 数据层就绪 |
| **P0-C** | 搭建 HTML 骨架：`topbar` + `filter-bar` + `scene-container`（3 列）+ `activity-panel` + `modal-overlay` | 35 | DOM 结构就绪 |

### Phase 1：场景层 CSS（~350 行）

| 任务 | 内容 | 估算行数 | 依赖 |
|------|------|---------|------|
| **P1-A** | L0 天穹：`body` 四层渐变 + `.scene-stars` box-shadow 40 个粒子 + `@keyframes twinkle` | 30 | P0-A |
| **P1-B** | L1 远山：`.scene-mountains` + `::before`/`::after` clip-path 双层山峦 + `mistDrift` | 40 | P0-A |
| **P1-C** | L1 雾气：`.scene-mist` 200% 宽渐变 + `mistScroll` 30s linear | 15 | P0-A |
| **P1-D** | L1 装饰（P2 级，可跳过）：飞剑流光 `swordFly`（~30行）/ 仙鹤 `craneFloat`（~25行） | 25 | P0-A |
| **P1-E** | L2 三列底座 Grid：`.scene-zones` display:grid + 3 columns + gap + padding + max-width | 20 | P0-C |
| **P1-F** | OC 区：`.zone-oc` radial-gradient + 蓝色灵力涟漪 `energyRipple` + `::before` 环 | 45 | P1-E |
| **P1-G** | TR 区：`.zone-tr` radial-gradient + 莲台 `lotusFloat` + `::after` 🪷 | 45 | P1-E |
| **P1-H** | CC 区：`.zone-cc` radial-gradient + 飞剑 `swordFly` + `::before` 流光 | 45 | P1-E |
| **P1-I** | 各区域内部状态分组：`.zone-group-active` / `.zone-group-idle` / `.zone-group-error` / `.zone-group-offline` 纵向排列 | 30 | P1-F/G/H |
| **P1-J** | UI 覆盖层：`.topbar` sticky + glassmorphism + `.filter-bar` + `.activity-panel` | 55 | P0-C |

### Phase 2：Agent Orb CSS（~250 行）

| 任务 | 内容 | 估算行数 | 依赖 |
|------|------|---------|------|
| **P2-A** | `.agent-orb` 基础样式：display:inline-flex + flex-column + gap + cursor + transition 0.6s | 15 | P1-E |
| **P2-B** | `.orb-core` 光晕本体：56px circle + flex center + radial-gradient | 10 | P2-A |
| **P2-C** | 4 状态光晕：active(绿 56px + breatheGreen) / idle(黄 48px + breatheGold) / error(红 60px + pulseRed) / offline(灰 36px + 无动画) | 60 | P2-B |
| **P2-D** | 3 阵营边缘光：`.oc` 蓝 1.5px / `.tr` 金 1.5px / `.cc` 紫 1.5px | 10 | P2-B |
| **P2-E** | `.orb-name` 名字标签：font-mono 11px + text-shadow + white-space | 10 | P2-A |
| **P2-F** | Hover 展开面板：`.orb-info` absolute + backdrop-blur + info-row + badge 1.5px | 55 | P2-A |
| **P2-G** | @keyframes 合集：breatheGreen/breatheGold/pulseRed/breatheBlue/breatheFactionGold/breathePurple/energyRipple/twinkle/mistScroll/mistDrift/swordFly/craneFloat/lotusFloat/orbAppear/expandIn/sceneReveal/zoneSlideIn | 90 | P2-C |

### Phase 3：JS 数据流核心（~200 行）

| 任务 | 内容 | 估算行数 | 依赖 |
|------|------|---------|------|
| **P3-A** | `poll()` + `fetchData()` + 5s setInterval + demoData 降级（扩容为 17 人完整数据） | 35 | P0-B |
| **P3-B** | 统计渲染 `renderStats()`：顶栏内嵌 舰队N / 在线N / 离线N | 15 | P3-A |
| **P3-C** | **核心分配引擎**：`assignFaction(name)` → OC/TR/CC + `assignZoneInFaction(status)` → active/idle/error/offline + 列内排序 | 45 | P3-A, P0-C |
| **P3-D** | `renderOrbs()`：遍历 ALL_AGENTS → 分配阵营+状态 → 生成 Orb DOM → 追加到对应阵营对应状态组 | 50 | P3-C, P2-A~P2-G |
| **P3-E** | 状态切换检测：新旧状态对比 → `classList.replace()` 触发 CSS transition + RAF 调度（每帧 ≤3 个） | 30 | P3-D |
| **P3-F** | `addActivity()` + `renderActivityLog()`：接收事件 → activityLog[50] → 时间线渲染 + 自动滚动到底 | 25 | P0-C |

### Phase 4：JS 交互层（~100 行）

| 任务 | 内容 | 估算行数 | 依赖 |
|------|------|---------|------|
| **P4-A** | Modal：`openModal(name)` + `closeModal()` + Escape key handler + backdrop click 关闭 | 45 | P3-D |
| **P4-B** | 阵营筛选：`.filter-btn` click → 匹配阵营列高亮 + 非匹配列 opacity 0.15 + `active` 类切换 | 25 | P3-D |
| **P4-C** | 搜索：input keyup 50ms debounce → 匹配 Orb 正常 + 不匹配 opacity 0.15 + 匹配文字高亮 + 无匹配 empty state | 30 | P3-D |

### Phase 5：响应式（~100 行）

| 任务 | 内容 | 估算行数 | 依赖 |
|------|------|---------|------|
| **P5-A** | ≥1920px：三列间距 20px，Orb 64px，宽裕 | 15 | P1-E |
| **P5-B** | 1366~1919px：三列间距 12px，Orb 56px，标准 | 15 | P1-E |
| **P5-C** | 1024~1365px：三列间距 8px，Orb 48px，紧凑 | 15 | P1-E |
| **P5-D** | 768~1023px：三列纵向堆叠（OC→TR→CC 从上到下），Orb 44px | 25 | P1-E |
| **P5-E** | <768px：退化方案 — 移除 L1 远山/雾气/装饰，各列改为紧凑列表模式（圆点+名字），无底座装饰 | 30 | P1-E |

### Phase 6：集成与验收

| 任务 | 内容 | 估算行数 |
|------|------|---------|
| **P6-A** | `.no-animation` 入场控制：body 初始添加 → DOMContentLoaded 后移除 | 3 |
| **P6-B** | 数据流全链路测试：fetch → assign → render → Orb DOM | 手动 |
| **P6-C** | 状态切换测试：active→error→offline→idle 循环 | 手动 |
| **P6-D** | 降级测试：kill API → demoData 正常 | 手动 |
| **P6-E** | 交互测试：filter/search/modal/hover/esc close | 手动 |
| **P6-F** | 性能检查：DevTools Layers + 60fps 确认 | 手动 |
| **P6-G** | 响应式测试：5 个断点逐一检查 | 手动 |

### 总预算汇总

| Phase | 内容 | 预算行数 |
|-------|------|---------|
| P0 | 基础设施 | 130 |
| P1 | 场景层 CSS | 350 |
| P2 | Agent Orb CSS | 250 |
| P3 | JS 数据流 | 200 |
| P4 | JS 交互 | 100 |
| P5 | 响应式 | 100 |
| P6 | 集成验收 | 3（代码）+ 手动 |
| **总计** | | **~1133 行** |

---

## 6. DAG 执行顺序

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6
(基础设施)   (场景CSS)    (Orb CSS)    (数据流)      (交互)      (响应式)    (验收)
                                                     ↑
                                                    P0-B (JS 常量)
```

**建议执行方案**：

```
Day 1:  P0-A → P0-B → P0-C (骨架 130 行)
        P1-A → P1-B → P1-C (天穹+远山+雾气 85 行)

Day 2:  P1-E → P1-F → P1-G → P1-H (三列底座 155 行)
        P1-I → P1-J (状态分组+UI覆盖层 85 行)

Day 3:  P2-A → P2-B → P2-C → P2-D (Orb 基础+4状态+3阵营 95 行)
        P2-E → P2-F → P2-G (名字+Hover+keyframes 155 行)

Day 4:  P3-A → P3-B → P3-C → P3-D (数据流+分配+渲染 145 行)
        P3-E → P3-F (状态切换+活动日志 55 行)

Day 5:  P4-A → P4-B → P4-C (Modal+筛选+搜索 100 行)
        P5-A → P5-B → P5-C → P5-D → P5-E (响应式 100 行)

Day 6:  P6-A → P6-B → P6-C → P6-D → P6-E → P6-F → P6-G (验收)
```

---

## 7. QA 验收核对清单

### 功能性（必测）

- [ ] 页面打开呈现完整场景：天穹渐变 + 粒子闪烁 + 流云雾气 + 远山剪影
- [ ] 三列阵营明确区分：OC 蓝左 / TR 金中 / CC 紫右
- [ ] 每个阵营列内 Agent 按 active→idle→error→offline 从上到下排列
- [ ] 17 Agent 全部显示，归属阵营正确（OC×8 / TR×8 / CC×1）
- [ ] 4 种状态光晕（绿/黄/红/灰）正确区分
- [ ] 3 种阵营边缘光（蓝/金/紫）正确区分
- [ ] Hover Agent → 展开浮动信息面板（心跳/在线时长/最后/归属/角色）
- [ ] Click Agent → 弹出 Modal 详情窗
- [ ] Modal 支持 Escape 键关闭 + 背景点击关闭
- [ ] 阵营筛选按钮 [全部] [OC蓝] [TR金] [CC紫] 切换正常
  - 选中阵营列高亮（border-glow + 亮度+）
  - 非匹配列整体降低透明度（opacity 0.15）
  - 点击"全部"恢复正常
- [ ] 搜索框实时过滤
  - 匹配 Agent 保持正常
  - 不匹配 Agent 降低透明度（opacity 0.15）
  - 匹配文字高亮（#00D4FF）
  - 全区域无匹配显示"未找到弟子" empty state
  - 清空搜索恢复正常
- [ ] 5s 轮询正常，状态变化即时反映到光晕切换
- [ ] API 断连 → 静默降级到 demoData，显示"演示模式"标记
- [ ] API 恢复 → 无缝切回真实数据
- [ ] 活动日志实时更新，最多保留 50 条，新条目滑入动画
- [ ] offline Agent 不可点击（cursor: not-allowed / 无 hover 面板）

### 视觉完整性

- [ ] Cultipunk 配色统一（深空背景/天蓝灵气/金色灵气/紫色灵气）
- [ ] 粒子闪烁不刺眼（opacity 0.3~1.0 渐变）
- [ ] 流云雾气缓慢飘动（30s 循环）
- [ ] 三阵营底座装饰各自有微妙动画（蓝涟漪/金莲台/紫飞剑）
- [ ] Agent 状态切换平滑过渡（0.6s cubic-bezier），无闪烁跳变
- [ ] 首次加载无入场动画混乱（`.no-animation` 类控制）
- [ ] 文字可读性：光晕上名字清晰，hover 面板内容不溢出

### 响应式

- [ ] ≥1920px：三列并排，间距宽松，Orb 64px
- [ ] 1366~1919px：三列并排，标准间距，Orb 56px
- [ ] 1024~1365px：三列并排，紧凑间距，Orb 48px
- [ ] 768~1023px：三列纵向堆叠，Orb 44px
- [ ] <768px：退化方案 — 移除远山/雾气/装饰，列表模式

### 性能门禁（Chrome DevTools 验证）

- [ ] Layers panel：所有动画在 GPU 合成层（`will-change: transform, opacity`）
- [ ] Performance 录制 10s：无 Layout Shift 警告
- [ ] JS 执行 ≤ 50ms/帧
- [ ] 首次内容渲染 ≤ 1.5s
- [ ] `backdrop-filter` 不支持时自动回退 `rgba(10,10,26,0.85)` 纯色

### 安全门禁

- [ ] 所有 `innerHTML` 仅来自硬编码常量或 API JSON（无用户输入注入）
- [ ] 搜索框输入不直接写入 HTML，仅用于 `Array.filter()`
- [ ] `fetch` 失败时静默降级，不抛未捕获异常
- [ ] 无硬编码色值/密钥/Token

### 可维护性

- [ ] 所有色值通过 CSS 变量引用（无硬编码 `#`）
- [ ] JS 数据逻辑与渲染逻辑分离（无混写）
- [ ] 所有 @keyframes 有语义化名字
- [ ] 无 `<style>` 内重复选择器
- [ ] 单文件 ≤2000 行
- [ ] 零 npm 依赖 / 零 CDN

---

## 8. 风险矩阵

| # | 风险 | 概率 | 影响 | 应对 |
|---|------|------|------|------|
| 1 | CC 阵营仅 1 人，右侧列视觉空荡 | 确定 | 视觉失衡 | 方案A: CC 列缩小宽度至 15%；方案B: CC 列居中显示单个 Orb、周围留白装饰 |
| 2 | OC 8 人 + TR 8 人同列拥挤 | 中 | 光晕叠压 | Orb 自适应：同组 >6 时缩至 44px，>10 时缩至 36px |
| 3 | 状态切换动画积压 | 低 | 单帧过载 | RAF 调度：每帧最多移动 3 个 Agent |
| 4 | `backdrop-filter` 低端机卡顿 | 低 | 毛玻璃失效 | CSS `@supports` 检测，回退纯色 |

---

*文档版本: v2.0 | 审查人: 李长寿 | 信心指数: 9/10*
*以 PRDv2 + ui-design.md 为最终设计基线，architecture.md (v1) 已废弃*
