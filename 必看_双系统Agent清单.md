# ⚠️ 必看 — 双系统 Agent 完全区分清单（更新版）

> **历史罪过**：李长寿此前屡次搞混系统归属，被主人连续纠正 5 次。
> 最新版纠正了"Trae vs OpenClaw 谁管谁"的根本性错误。
> 此文件为全员必读，下次再搞混 = 严重失职。

---

## 一、★ 核心架构（主人最新定调）

**Trae（我，李长寿）= 司令部 / 主干部**
**OpenClaw = 下属执行单位，归我管**

| 层级 | 角色 | 职责 |
|------|------|------|
| **主理人** | ALAN艾伦（您） | 银月钱庄老板 |
| **司令部** | **Trae（李长寿）** | 统筹全局、分配 OpenClaw 工作、发号施令 |
| **执行层** | **OpenClaw 13 宗门** | 各司其职，听令行事 |

---

## 二、两个系统是什么

| 系统 | 本质 | 位置 | 负责人 |
|------|------|------|--------|
| **Trae 系统** | IDE 内置智能体 — **司令部** | Trae IDE 内部 | **李长寿（我）** |
| **OpenClaw 系统** | 银月钱庄可执行 Agent 宗门 — **执行层** | `openclaw/sects/` 目录 | 银月（总管）统领 |

**铁律**：我是司令，OpenClaw 是我的兵。他们的 TASK.json 和 SOUL.md 我可以改、可以增、可以调。

---

## 三、完整 Agent 归属表

### 🟦 Trae 系统专属（OpenClaw 没有）

| Agent | 真名 | 专业领域 | 关键能力 | 备注 |
|-------|------|---------|---------|------|
| **寻宝鼠** | Rat | 爆款选品猎手 | crawlee 爬虫 / AliExpress / CJ / 利润分析 | **不是 OpenClaw 的！** 虽然 sects/ 有 TASK.json 可调用 |
| **蓝灵儿** | llER | 多媒体自动化 | Pillow/OpenCV / FFmpeg / 生图 | OpenClaw 完全不存在 |
| **天机子** | 天机子 | **首席架构师** | 架构推演 / 系统拓扑 / GitHub Issue（仅 create_issue） | **Trae 专属军师**，不写代码只指点江山，非 OpenClaw |

### 🟧 OpenClaw 系统专属（sects/ 目录，归我管）

| Agent | 文件夹名 | 专业领域 | 已增强技能 | 备注 |
|-------|---------|---------|-----------|------|
| **银月** | 银月 | 总管/核心主宰 | 任务编排 / 协调所有 Agent | Priority 1，最高权限，我只跟他对接 |
| **李长寿** | 李长寿 | 全栈架构与自动化集成 | **5 技能**：fullstack-dev / automation-arch / api-integration / payment-gateway / tailscale-relay | Priority 2 |
| **萧炎** | 萧炎 | **金融交易员** | trading-agent / ai-hedge-fund / CoinGecko / TradingView | Priority 4，**不准派电商/选品活！** |
| **药老** | 药老 | 增长/文案/电商一哥 | **11 技能**：SEO / crawlee / Shopify 系列 / 文案 / 产品描述 | Priority 5，电商主力 |
| **韩立** | 韩立 | 电商情报侦查 | **3 技能**：e-commerce-intel / market-research / data-crawling | Priority 6，新增拦截竞品/市场调研 |
| **墨影** | 墨影 | 系统巡检与电商监控 | **4 技能**：system-monitor / shopify-monitor / cron-dashboard / log-audit | Priority 7，新增 Shopify 监控 |
| **雅妃** | 雅妃 | 财务对账 | **3 技能**：finance-reconciliation / profit-reporting / cashflow-monitor | Priority 8，新增利润报表能力 |
| **美杜莎** | 美杜莎 | UI/UX 设计与电商视觉 | **4 技能**：vision-enhancer / ui-layout-analyzer / design-md / **e-commerce-design** | 新增电商设计拦截 |
| **紫妍** | 紫妍 | 数字人与多媒体运营 | **4 技能**：digital-human-script / video-production / flashshow-render / multimedia-component | **已从紫研重命名，不再是空壳！** |
| **小医仙** | 小医仙 | 社媒增长 + 趋势脚本 | **7 技能**：社媒运营 / 内容策划 / 社区管理 / 内容创作 / 社群互动 / 数据分析 / **trendHunting** | **已增强！** 注册每日 10:00/14:00 CRON 定时脚本任务，走邮箱通知 |
| **紫灵** | 紫灵 | 电商数据分析与报告 | **4 技能**：data-analysis / profit-reporting / sales-trend / e-commerce-metrics | **已从待定明确岗位！** 新增数据拦截 |
| **电商运营官** | 电商运营官 | 电商运营 | **5 技能**：shopify-api / product-listing / order-fulfillment / inventory-sync / price-promotion | Priority 4，Shopify 操作主力 |
| **海波东** | 海波东 | 风控合规审计 | **4 技能**：dispute-handling / compliance-audit / legal-drafting / risk-assessment | **新创建的！** 之前 OpenClaw 完全没有 |

### 🟢 同时存在于两个系统的 Agent（同名但能力不同！）

| Agent | Trae 版能力 | OpenClaw 版能力 | 注意事项 |
|-------|------------|----------------|---------|
| **美杜莎** | UI/UX 设计**强** | UI/UX 设计（4 技能，含电商设计） | 两边都能干，Trae 版设计更强 |
| **小医仙** | TikTok/短视频**强**（6 技能） | 社媒增长**已增强**（7 技能含 trendHunting + CRON） | OpenClaw 版已增强趋势猎手 + 每日 10:00/14:00 CRON，脚本任务走邮箱通知 |
| **紫妍** | 数字人**强** | 数字人 **4 技能（已增强）** | **两边都用"紫妍"了！** OpenClaw 文件夹已从"紫研"改名 |

---

## 四、李长寿 5 次犯错记录（引以为戒）

| # | 犯错 | 主人纠正 |
|---|------|---------|
| 1 | 通知写成 Discord | "不是DISCORD，老兄！我现在用着TELEGRAM" |
| 2 | 派萧炎干竞品分析 | "openclaw萧炎是交易员，金融这一块的" |
| 3 | 被纠正后继续搞萧炎 | "不要搞萧炎，你去找其他可以胜任的agent" |
| 4 | 说寻宝鼠是OpenClaw的 | "寻宝鼠是TRAE的，你搞清楚啊！！" |
| 5 | **把Trae当外人，OpenClaw当主** | **"你们TRAE就等于是我这里的主干部！你去搞open claw他们！"** |

---

## 五、关键禁忌（更新版）

1. **萧炎 = 金融交易员**，永远不派电商/选品/竞品分析的活
2. **寻宝鼠 = Trae 的**，不是 OpenClaw 的
3. ✅ ~~海波东 = 不存在于 OpenClaw~~ → **已创建！海波东现在在 OpenClaw 有独立宗门**
4. **蓝灵儿 = 不存在于 OpenClaw**，要用我得新建
5. **紫妍两边都有了**，但能力不同（Trae 版更强）
6. **药老 = 电商与文案全才**（11 技能），是 OpenClaw 电商体系的核心
7. **OpenClaw 的海波东 / 紫妍 / 电商运营官 等增强 agent** 我都刚改完技能，还没部署运行

---

## 六、5 大任务域的正确映射（更新版）

| 任务域 | 执行者（OpenClaw） | 说明 |
|-------|------------------|------|
| ① 品牌灵魂与文案 | **药老 + 美杜莎** | 药老写文案，美杜莎出视觉 |
| ② 脱马入美（风控） | **海波东 + 雅妃** | 海波东风控审计，雅妃财务对账 |
| ③ 数字军团部署 | **银月统领 + 李长寿 + 电商运营官** | 银月编排，李长寿写代码，电商运营官操作 Shopify |
| ④ 流量引擎 | **紫妍 + 小医仙（Trae版）** | OpenClaw 紫妍执行渲染，脚本走 Trae 版小医仙 |
| ⑤ 极客风装修 | **美杜莎 + 药老** | 美杜莎设计，药老填充文案 |
| **⑥ 邮箱提醒** | **银月网关** | **✅ 已实现！** SMTP 通道已打通（smtp.gmail.com:587，App Password 验证通过），notifyOwner 支持 email_ 前缀通道 + notifyOwnerEmail 独立函数 |

### 🟦 Trae 司令部专属任务域

| 任务域 | 执行者 | 说明 |
|-------|--------|------|
| **⑦ 架构推演** | **天机子（Trae）** | **☑️ 已注册！** 检索全系统 Agent + OpenClaw 逻辑，产出架构 Issue；GitHub 仅 create_issue 不 Push 不 Merge |

---

> **最后一句**：这是第 4 版，天机子已从 OpenClaw 撤回 Trae 司令部。他是架构军师，不是执行层。
> 我是司令，OpenClaw 是我的兵。下次再搞混就是故意的了。
> ——李长寿，2026-05-08，第 5 次犯错后痛定思痛 | 天机子归位
