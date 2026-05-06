# 美杜莎设计简报 — SilverMoon Bank Landing Page

## 品牌速览

| 项目 | 内容 |
|------|------|
| 品牌 | SilverMoon Bank |
| 定位 | AI Automation & Agent Orchestration |
| 受众 | 全球开发者 / 技术创始人 / AI 极客 |
| 调性 | 技术感 · 极简 · 可信高端 |
| 对标 | Vercel / Linear / Raycast 级别 |
| 风格 | 暗色 Neo-Minimalism + Glassmorphism |
| 主色 | #00D4FF（月光辉青蓝） |
| 次色 | #818CF8（靛紫） |

---

## 需要设计的 Figma Frame

请在 Figma 中创建以下 Frame（1920×1080 画板基础）：

### 1. 全局组件

| Frame | 说明 | 尺寸参考 |
|-------|------|---------|
| Design System | 色板/字体/间距/阴影/圆角展示 | 任意 |
| Nav | 暗色玻璃质感导航栏 | 1920×64 |
| Button/Primary | 主按钮（默认/hover/disabled） | 自定 |
| Button/Ghost | 次按钮（默认/hover） | 自定 |
| Button/Text | 文字按钮 | 自定 |
| Glass Card | 通用玻璃卡片（空状态） | 384×280 |
| Badge | 标签组件 | 自定 |
| Input | 输入框（默认/focus/error/success） | 384×44 |

### 2. 页面 Section

| Frame | 说明 | 布局提示 |
|-------|------|---------|
| Hero | 全屏首屏 | 径向渐变背景，居中布局，标题+副标题+CTA×2 |
| Services | 服务网格 | 12列 Bento Grid，玻璃卡片，部分卡片跨列 |
| Case Studies | 案例展示 | 并排双卡片，带标签Badge |
| Stats Bar | 数据统计条 | 4列数字（Clients/Projects/Years/Countries） |
| Process | 工作流程 | 3步水平时间线，每步图标+标题+描述 |
| Testimonials | 客户评价 | 2-3列评价卡片，带头像 |
| Contact | 联系表单 | 居中表单卡片，标题+副标题+输入框+按钮 |
| Footer | 页脚 | 4列网格 + 版权条 |

---

## 视觉参考

- **背景**：纯黑 `#0A0A0A`，表面 `#0D1117`（类似 Vercel 暗色）
- **卡片**：半透玻璃效果（`bg-white/[0.02]` + `backdrop-blur-2xl` + `border-white/[0.06]`）
- **首屏**：正上方渐变光晕（cyan → violet → transparent）
- **hover**：卡片轻微上浮 `-2px` + 阴影加深
- **按钮**：cyan 纯色填充，hover 带发光
- **图标**：lucide 风格，20px 描边
- **字体**：标题 Geist（Bold 700），正文 Inter（Regular 400）

---

## 设计原则

1. **暗色是默认，不是主题** — 所有组件先在暗色上设计
2. **少即是多** — 每个 Section 一个视觉焦点，不要堆砌
3. **间距即呼吸** — 严格遵循 4px 网格，大间距（96px+）让内容呼吸
4. **玻璃质感** — 卡片用 backdrop blur，不要纯色块
5. **动效暗示** — 设计 hover 状态时标注期待动效（上浮/发光/渐入）
6. **技术上可实现** — 所有效果必须在 Tailwind v4 能力范围内（避免 Figma 中有但 CSS 做不到的效果）

---

## 输出要求

1. 所有 Frame 用中文标注（方便我和李长寿沟通）
2. 每个组件标注：组件名 → 状态 → 尺寸 → 色值
3. 交付 Figma 分享链接（可查看）
4. 标注 **「交给李长寿实现」**

---

## 参考案例

打开以下设计参考（打开后截图放 Figma 里）：

- [Vercel 暗色模式](https://vercel.com) — 背景/间距/排版节奏
- [Linear 首页](https://linear.app) — 卡片设计/光效
- [Raycast 首页](https://raycast.com) — Hero 布局/CTA 设计

---

## 协作流程

```
美杜莎 Figma 设计
    ↓
李长寿 实现为 Next.js 组件（参考 MASTER.md）
    ↓
主人 验收
    ↓
上线部署
```
