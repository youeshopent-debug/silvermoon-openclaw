# 银月钱庄 · 开发日记

> 大掌柜：LAU SII LUN
> 首席架构师：李长寿
> 最后更新：2026-04-27

---

## 一、当前资产清单

### 1.1 数字产品（Lemon Squeezy）
店铺：`silvermoon.lemonsqueezy.com` | Store ID: `341601`

| 产品 | 价格 | 状态 |
|------|------|------|
| AI 产业全景报告（2025-2033） | SGD 59.00 | 已上架 |
| Stripe/Lemon Squeezy 收款指南 | SGD 41.60 | 已上架 |
| Stripe 申诉邮件模板 | SGD 15.60 | 已上架 |
| 域名验证 404 修复手册 | SGD 19.50 | 已上架 |

### 1.2 Twitter/X
账号：`@lau_sii96989`
- Banner：已生成（`twitter_banner.png`）
- Bio/Website/Location：待装修
- 置顶推文：待发布

### 1.3 技术设施
| 组件 | 端口 | 状态 |
|------|------|------|
| 银月网关（main.js） | 18791 | ✅ 运行中 |
| 本地 Ollama | 11434 | ✅ 13个模型 |
| 银月默认模型 | — | Qwen3.5:9b（本地） |
| 控制中心看板 | 4310 | ⚠️ 部分API异常 |
| Landing 页面 | Next.js | 待改造 |

### 1.4 GitHub
已开通，可作为脚本保险库。

---

## 二、核心架构决策

### 2.1 模型策略
- **Trae IDE 内**：用 Trae 内置模型（Claude/GPT）
- **Telegram 银月**：本地 Ollama Qwen3.5:9b（零成本）
- **降级链路**：本地 → DeepSeek V3.2 → Groq → Gemini

### 2.2 代理策略
- 外网请求强制走 `http://127.0.0.1:7890`
- Lemon Squeezy API 直连（不需要代理）

### 2.3 金融安全
- Stripe 回传先落盘再执行
- 密钥通过 `.env` 读取，禁止硬编码

---

## 三、待办事项

### P0 - 协作框架（余额充足后启动）
- [ ] 第一步：文件级协作（sects 目录 + TASK.json + 监控脚本）
- [ ] 第二步：接入 Telegram 银月网关
- [ ] 跑通后打包成 SKILL，作为产品卖点

### P1 - 品牌建设
- [ ] Twitter Profile 装修（Bio/Website/Banner/置顶推文）
- [ ] Facebook Page（大掌柜开新Page）
- [ ] Landing 页面改造：个人接单 → 银月钱庄品牌站

### P2 - 内容沉淀
- [ ] 开发笔记/踩坑记录整理
- [ ] SEO 方案（药老出文案）
- [ ] 跨境电商 Shopify 版图（银月设计中）

---

## 四、关键脚本索引

| 脚本 | 用途 | 位置 |
|------|------|------|
| `_fetch_ls.js` | Lemon Squeezy API 数据拉取 | 项目根目录 |
| `_gen_banner.js` | Twitter Banner 生成 | 项目根目录 |
| `_twitter_setup.js` | Twitter Profile 自动化装修 | 项目根目录（待运行） |

---

## 五、团队角色

### Trae IDE 团队
| 角色 | ID | 职责 |
|------|-----|------|
| 李长寿（我） | lichangshou | 全栈开发、架构设计 |
| 药老 | e-com-specialist-yl | 文案、SEO、增长 |
| 美杜莎 | ui-ux-designer-mds | UI/UX 设计 |
| 蓝灵儿 | media-producer-llER | 多媒体、生图 |
| 紫妍 | digital-human-pro-zy | 数字人 |
| 萧炎 | trading-strategy-expert-xy | 交易策略 |

### Telegram 银月
| 角色 | 说明 |
|------|------|
| 银月（main.js） | 网关 + Agent 编排，运行在本地 |
