# 美杜莎设计简报 — SilverMoon Bank Landing Page

> ⚡ 大掌柜点名只要 **3 张 Figma Frame**，别的不做。精工细作，3张够用。

---

## 品牌速览

| 项目 | 内容 |
|------|------|
| 品牌 | SilverMoon Bank |
| 定位 | AI Automation & Agent Orchestration |
| 受众 | 全球开发者 / 技术创始人 / AI 极客 + 心理健康用户 |
| 调性 | 技术感 · 极简 · 可信高端 + 深夜温暖 |
| 对标 | Vercel / Linear / Raycast 级别 |
| 风格 | 暗色 Neo-Minimalism + Glassmorphism |
| 主色 | `#00D4FF`（月光辉青蓝） |
| 次色 | `#818CF8`（靛紫） |
| 深色背景 | `#0A0A0A`（最底层） / `#0D1117`（面板） / `#161B22`（卡片） |
| 字体 | 标题 Geist Bold 700 / 正文 Inter Regular 400 |
| 圆角 | 卡片 12px / 按钮 8px |

---

## Frame 1 — Hero 首屏（最重要）

**尺寸**：1920×1080（桌面） + 375×812（移动端单独出）

**文案（直接写在 Figma 里）：**

> **小标题（顶部 Badge）**：`✦ AI Automation Studio`
>
> **大标题**：`We Build AI Agents That Work While You Sleep.`
>
> **副标题**：`From mental health sanctuary to automation infrastructure — SilverMoon Bank engineers the tools that power the next generation of builders.`
>
> **CTA 按钮 × 2**：
> - 主按钮（青色填充）：`See Our Work`
> - 次按钮（ghost 带外发图标）：`Free AI Therapy →`

**视觉要求：**
- 背景：纯黑 `#0A0A0A`，顶部正中央有**大幅径向渐变光晕**（青蓝 → 靛紫 → 透明），参考 Linear.app 首页光效
- 主按钮：`#00D4FF` 填充，白色文字，hover 带外发光
- 次按钮：透明底 + 白色边框 + `#00D4FF` hover 文字
- 导航栏在最顶部：Logo（银月弯钩图标/极简几何） + [Projects] [DeepCalm] [Contact] 三个链接
- 不用视频背景，不用大图，**纯排版 + 光效** — 简约但有冲击力
- 移动端：字体缩小两档，CTA 堆叠，光晕保持

**参考方向：** Linear.app 首页的 Hero 光效排版 + Vercel 的暗色质感

---

## Frame 2 — DEEPCALM 专属区块

**尺寸**：1920×600（桌面宽屏）

**文案：**

> **Badge**：`✦ Free · Forever`
>
> **大标题**：`AI Mental Health Sanctuary`
>
> **副标题**：`Free AI-powered emotional support & sleep science. No sign-up. No data stored. Just you and the moonlight.`
>
> **Feature 3 点**：
> - `🧠 AI Counselor` — Cognitive restructuring in minutes
> - `🌙 Sleep Calculator` — Wake up refreshed, not groggy
> - `🔊 3D Soundscapes` — Immersive audio for deep focus
>
> **CTA**：`Enter the Sanctuary →`（一个柔和的按钮，不用青蓝，用靛紫 `#818CF8`）

**视觉要求：**
- 背景：比 Hero 稍亮一点的深色渐变（`#0D1117` → `#0A0A0A`）
- 左侧放一个**月亮/星云抽象图形**（几何风格，不用写实）
- 左侧图形区域：月牙 + 粒子点（示意星光）
- 右侧：文字排版 + 3 个 feature 卡片
- 整体氛围：温暖、安静、疗愈，与上半部分的技术感形成对比
- 不写"AI"，写"Sanctuary"、"Calm"、"Rest"

**参考方向：** Headspace 的暗色版 + 极简几何星月

---

## Frame 3 — Glass Card 组件库

**尺寸**：一个画板展示 4 种状态即可（竖排）

**包含：**

| # | 状态 | 内容 |
|---|------|------|
| 1 | **默认 (Default)** | 带 icon 圆形容器（左上），标题，描述文字，底部可选 Badge |
| 2 | **Hover** | 卡片整体上浮 2px，边框亮起（`#00D4FF` 半透明光晕），阴影加深 |
| 3 | **带图片** | 上半部 16:9 缩略图（用深灰色占位块），下半部文字 |
| 4 | **多列布局示意** | 3 张卡片并列（Hero 下方 3 列 Service 卡片布局） |

**尺寸**：单卡 384×280（参考）

**视觉要求：**
- 背景：`rgba(255,255,255,0.02)` + `backdrop-blur-xl`
- 边框：`rgba(255,255,255,0.06)` → hover 时 `rgba(0,212,255,0.2)`
- icon 容器：圆形，40×40px，`#00D4FF` 半透明背景 + 白色 icon
- 标题：白色 18px Geist Medium
- 描述：灰色 14px Inter Regular
- 整体气质：玻璃质感，若隐若现

---

## 交付要求

1. 所有 Frame 用 **中文标注组件名**（方便我跟李长寿沟通）
2. 每个 Frame 标注：尺寸 / 色值 / 字体字号
3. 出 Figma 分享链接（Anyone with link can view）
4. 完成后标注 **「交给李长寿实现」**
5. 大掌柜在等，别让他等太久 ⏳

---

## 参考链接（打开后截图放 Figma 里参考）

- https://linear.app — Hero 光效排版
- https://vercel.com — 暗色质感
- https://www.headspace.com — 温暖疗愈调性（参考 DEEPCALM 区块）

---

## 协作流程

```
美杜莎 Figma 出 3 张 Frame
    ↓
通知李长寿（在共享记忆写 handoff）
    ↓
李长寿 实现为 Next.js 组件
    ↓
主人 验收
    ↓
上线 Vercel
```
