# SilverMoon Bank Landing — 组件改动清单

## 改动优先级

- **P0** — 阻塞项，不改不能上线（颜色/字体/布局基础）
- **P1** — 核心体验，必须改
- **P2** — 锦上添花，可后做

---

## 文件改动明细

### P0 — 阻塞基础

#### 1. landing/app/globals.css
- 用 MASTER.md `@theme inline` 替换现有 theme
- 删除 `prefers-color-scheme` media query（决定走暗色默认）
- 添加玻璃效果工具类
- 添加入场动画 keyframes

#### 2. landing/app/layout.tsx
- **关键修复**：导入 Geist 字体（`import { Geist, Geist_Mono } from "next/font/google"`）
- 配置 font variables 传入 `className`
- 添加 favicon 和 meta theme-color

#### 3. landing/app/page.tsx
- 用 design tokens 替换硬编码 `bg-zinc-50`
- 添加 Sections 包裹 Hero 和 Services
- 可选：新增 Testimonials / Stats / Process 三个 Section

---

### P1 — 核心组件重写

#### 4. landing/components/Nav.tsx
- 改为 glass sticky header（`bg-bg-deep/80 backdrop-blur-2xl`）
- 添加滚动阴影（scroll 时出现 border-bottom）
- 统一使用 `text-text-primary/text-text-secondary`
- Mobile menu 用 glass dropdown 替换

#### 5. landing/components/Hero.tsx
- **全组件重写**为全新视觉方案：
  - 全屏 Hero 带径向渐变背景
  - 主标题 `text-5xl md:text-6xl font-bold`
  - 副标题 `text-lg text-text-secondary max-w-2xl`
  - CTA 按钮组（Primary + Secondary）
  - 浮动 UI 预览/代码片段占位（可选动画）
  - 信任徽章/统计数字条（Clients / Projects / Years）

#### 6. landing/components/Services.tsx
- 改为 **Bento Grid** 布局（12列网格）
- Glass 卡片，hover 上浮效果
- 每个卡片加 lucide 图标 + 标题 + 描述
- 核心服务卡片占大 span（col-span-6 lg:col-span-4）
- 高亮服务占宽 span（col-span-12 md:col-span-8）
- 添加 fade-in-up 交互动画

#### 7. landing/components/CaseStudies.tsx
- 暗色卡片 + 截图/占位图
- 标签 Badge（用 `bg-accent-subtle text-accent text-xs px-2 py-0.5 rounded-full`）
- hover 效果：轻微放大 + 阴影加深
- 添加 "View Case Study" link 箭头动效

#### 8. landing/components/Section.tsx
- 更新 `className` 使用 design tokens
- 添加可选 `id` 平滑滚动偏移
- 添加可选顶部装饰线（`border-t border-border-subtle`）

#### 9. landing/components/Contact.tsx
- Glass 表单卡片
- 输入框用 `bg-bg-elevated border-border-default focus:border-accent`
- 错误/成功状态用 `text-error` / `text-success`
- 提交按钮用 Primary button 规范
- 可选：添加 Calendly 或 "Book a Call" 按钮

#### 10. landing/components/Footer.tsx
- 四列网格：Brand + Links + Products + Social
- 品牌色 accent 链接 hover 效果
- 底部版权条带 border 分隔
- Glass 风格分隔

---

### P2 — 增强（可选）

#### 11. 新增 landing/components/TrustBar.tsx
- 客户徽标滚动条或数字统计
- 放置于 Hero 下方或 CTA 上方

#### 12. 新增 landing/components/Testimonials.tsx
- 客户评价轮播/网格
- 引用卡片带 avatar + 名称 + 公司

#### 13. 新增 landing/components/Process.tsx
- 三/四步工作流：垂直时间线或水平步进器
- 每步：icon + 编号 + 标题 + 描述

#### 14. landing/app/globals.css → 添加动画
- `@keyframes fadeInUp` / `fadeIn`
- `animate-fade-in-up` / `animate-fade-in`
- 可选：`scroll-timeline` 驱动入场

---

## 改动顺序建议

```
Round 1 (P0): globals.css → layout.tsx → page.tsx
Round 2 (P1): Nav → Hero → Section
Round 3 (P1): Services → CaseStudies → Contact → Footer
Round 4 (P2): TrustBar → Testimonials → Process
```

每次 Round 完成后 `npm run build` 验证无错误再推进下一轮。
