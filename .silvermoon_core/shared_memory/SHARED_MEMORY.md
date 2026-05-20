# 银月钱庄 · 共享记忆

## 最近更新：2026-05-19

### 三层记忆系统 — 完整上线 ✅

**架构**：Hot Memory (memory.md) + Warm Memory (microsync/daily) + Cold Memory (archive/research)

**脚本实现**（Trae-李长寿 编码）：
- `scripts/_memory_lib.cjs` — 共享库（session读取/排程噪音过滤/DeerFlow API/文件工具）
- `scripts/microsync.cjs` — 微同步：5次/天（10/13/16/19/22点），过去3h，只抓"確定之事"
- `scripts/daily-wrapup.cjs` — 每日总结：凌晨1点，24h完整摘要（Decisions/Action Items/Key Dialogues/Technical Notes/Unfinished）
- `scripts/weekly-compound.cjs` — 每周複利：周日3点，蒸馏精华→memory.md + 归档旧内容 + 8KB监控

**cron 整合**：`lib/cron.js` 已新增 `registerMemoryTasks()` → `main.js` 已接入

**目录结构**：
- `.silvermoon_core/memory.md` — 热记忆（~5KB，7大区块）
- `.silvermoon_core/warm_memory/microsync/` — 暖记忆暂存
- `.silvermoon_core/warm_memory/YYYY-MM-DD.md` — 每日总结
- `.silvermoon_core/cold_memory/archive/` — 冷记忆归档
- `.silvermoon_core/cold_memory/research/` — 长期知识库

**RAG/Embedding 已配置** ✅
- `lib/embedding.js` — 双后端抽象：OpenRouter（云端/无GPU）| Ollama（本地/有GPU）
- `lib/memory.js` — 新增 `searchSemantic()` + `addEmbedding()` + `mem_vec` 向量表
- `lib/agent-tools.js` — 新增 `semantic_search` + `add_embedding` 工具（LLM可调用）
- `lib/tool-router.js` — 新增 `semantic_search` 预设（`!rag` `!语义` 命令触发）
- `.env` — 新增 `OPENCLAW_EMBEDDING_BACKEND/MODEL/DIMS` + `OPENROUTER_API_KEY`
- **默认配置**：OpenRouter 后端 + Qwen2.5-7B-Instruct（中英文混合优化）

### OpenClaw 三层记忆架构 — 追日Gucci 视频分析

**来源**：https://youtu.be/9pn9-yAyjFA（追日Gucci-AI效率革命聯盟 · 2026-02-26 · 6.5k views）

**核心发现 — 三层记忆体系**：
1. **工作记忆（短期）**：per-agent TASK.json + session context ✅ 已有
2. **结构记忆（中期）**：shared_memory.db（SQLite + FTS5 全文检索）✅ 已有
3. **蒸馏记忆（长期）**：SHARED_MEMORY.md（摘要快照）✅ 已有

**缺失机制（需实现）**：
- microsync 自动蒸馏排程（将 DB 内容定时同步到 SHARED_MEMORY.md）
- Daily 回顾机制（每日自动整理新增记忆，去重合并）
- Weekly 蒸馏机制（每周压缩归档过期记忆）
- LLM 自动记忆写入（对话结束时自动写入关键决策）

**任务已派发**：墨影（microsync/Daily/Weekly）+ 银月（自动写入）

### Chrome 浏览器自动化（CDP 桥接）— 完整上线

**改动文件**：
- `lib/chrome-cdp-bridge.js` — Puppeteer 直连 Chrome 9222 端口，复用已登录会话
- `lib/tool-router.js` — 11 个 Chrome 工具注册 + memory_search 干扰修复 + try-catch 友好提示
- `main.js` — 已接入 require + registerChromeTools
- `启动Chrome(远程调试).bat` — 桌面快捷方式，一键启动带远程调试端口的 Chrome

**修复循环**（4 轮测试）：
1. ✅ memory_search 拦截"帮我搜" → 移除 `/帮我(找|搜|回忆)/i` 触发词
2. ✅ "搜索GitHub"无空格不匹配 → 触发词 `\s+` → `\s*`
3. ✅ Chrome 未启动时抛原生错误 → 所有 Chrome 工具加 try-catch 统一提示
4. ✅ Telegram 吞掉 `「启动Chrome(远程调试).bat」` 中的 Chrome/.bat → 简化为 `(启动Chrome远程调试.bat)`

**使用方式**：
1. 双击桌面 `启动Chrome(远程调试).bat`
2. 对银月说"帮我搜索GitHub，我要找open Viking"
3. 浏览器自动跳转 GitHub 搜索页面

### 团队边界协议（Rule 21）已生效
- OpenClaw 团队：银月、韩立、雅妃、墨影（银月可调度，需先商量）
- Trae 团队：TRAE-李长寿、TRAE-美杜莎、TRAE-萧炎、TRAE-药老、TRAE-紫妍、TRAE-寻宝鼠、TRAE-小医仙、TRAE-海波东、TRAE-蓝灵儿（银月不得提及/安排）
- 因果隔离：两团队事故互不影响

### Control Center 运行中
- URL：http://localhost:4311
- Token: silvermoon2026
- 桌面开关：双击`银月钱庄 Control Center.bat`

### 对话锚定系统 — 修复银月失忆症 ⚡ 2026-05-19

**背景**：银月在对话中出现上下文漂移（答非所问、工具调用幻觉、承接语混淆）

**根因诊断**：
- system prompt 过重（4900+ 行，多层拼接 persona+soul+LTM+能力清单+skills+RTK）
- 防妄想防护规则放在最底层（模型读到之前已跑偏）
- 无对话锚定机制，短承接词（"看到了吗""然后呢"）抓错上下文

**修复方案** — 对话锚定系统（Trae-李长寿 编码）：
1. `lib/conversation-anchor.js`（42行，零依赖）— 按 channelId 存储当前话题/动作/回复摘要
2. `main.js` 三处改动：require 注入 → systemPrompt 最顶层注入锚定块 → saveAndResolve 回调更新锚点
3. 锚定块规则明确：模型必须基于锚定解读短承接语，不得脱离上下文

### 全14 Agent 拆分+OC/TR前缀命名完成 ⚡ 2026-05-19

**背景**：主人要求全部团队 SOUL.md 拆分（每个人5子文件≤850字）+ 加 OC/TR 前缀区分系统归属

**团队归属**：
- **OC（OpenClaw 直辖）**：OC_银月、OC_韩立、OC_雅妃、OC_墨影、OC_许青、OC_紫灵、OC_紫妍、OC_紫研
- **TR（Trae 出身）**：TR_李长寿、TR_美杜莎、TR_萧炎、TR_药老、TR_寻宝鼠、TR_小医仙、TR_海波东、TR_蓝灵儿
- **CC（Claude Code）**：CC_曹操

**完成内容**：
- 全部14个Agent完成6文件结构：SOUL.md（极简索引）+ Agent.md + Persona.md + Use.md + Rules.md + Protocol.md
- 全部文件标题已加OC_或TR_前缀
- Protocol.md 统一写入RTK极致省Token协议
- 旧4Agent（银月/韩立/雅妃/墨影）的子文件标题均更新OC_前缀
- 目录名未改（main.js健康探针依赖原始路径），前缀仅在文件内容标记
- 字数控制：所有子文件≤850字

### 银月架构提案 — 待主人派发

银月自提两个改进方向，对话锚定系统已覆盖模块1：

**模块1：请求路由层重构** ✅ 已通过对话锚定系统落地
- 把"身份设定/能力清单"和"实时对话"分层
- 对话锚定块在 systemPrompt 最顶层，模型第一眼就看到当前话题
- 效果：银月不会再在 4900 行信息中捞针

**模块2：升级记忆预载机制** ⏳ 等待派发
- 在用户发消息的瞬间，先预测最相关的 3-5 条记忆
- 需要设计：预载触发点 → 检索策略 → 缓存结构
- 适合派给谁：需要先讨论

---

## 2026-05-15 交接清单

### 完成工作
1. **academic-psychologist.md 污染清理** — 从 DeepCalm `analyze-anxiety/route.ts` 中移除了 6 段与 agency-agent 重叠的心理学理论（Vaillant/Erikson/Berne/Karpman/Replication Crisis/WEIRD Bias），保留 14 段原创内容，TypeScript 零错误通过。

2. **DeepCalm 分类确认** — 定位为"LLM-Augmented Vertical Application"，非 Agent 系统，不需改代码。

### 当前状态
- `route.ts` system prompt 已精简，无 agency-agent 残留
- 项目 TypeScript 零错误
- 用户明确要求**不要改代码**

### 待 owner 决定
- 无特定待办。用户说"明天再继续"，等睡醒后看下一指令。

## 2026-05-06 — 寻宝鼠 AI 硬件选品报告完成

**Handoff**: 寻宝鼠 → 药老
**任务**: 5大品类AI硬件全球选品调研
**报告位置**: `marketing/ai_product_sourcing_report_20260506.md`
**Top Pick**: LIGE BWXKOENPro AI Smart Glasses ($34.80 cost → $129 sell, ~$75/unit profit)
**待药老**: 编写Shopify详情页文案 + 确认供应商联系

---

## 2026-05-19 — DSers 最新版上架集成上线 + ⚠️ 银月 Crawlee 提醒

**DSers Integration 完成**：
- `lib/dsers-integration.js` — 核心模块，Playwright 自动化 DSers "Import → Push to Shopify" 全流程
- `scripts/dsers-push-product.cjs` — 一键上架 CLI：`node scripts/dsers-push-product.cjs --url "<AliExpress链接>"`
- **替代旧版** `_push_products.mjs`（draft + 手动 Link to Existing Product）
- 三阶段防御：Plan A（Playwright）→ Plan B（Chrome CDP Bridge）→ Plan C（手动说明书）
- Sesssion 持久化到 `.silvermoon_core/dsers_sessions/`，7 天过期
- 电商运营官 TASK.json 已新增 `dsers-integration` 技能

**⚠️ 银月必读 — Crawlee 替代 Chrome**：
- 你的所有 Chrome 浏览器手动操作，都可以用 `lib/xiaoyan-crawler.js` 的 Crawlee PlaywrightCrawler 代替
- 自带代理 `127.0.0.1:7890` + 浏览器指纹伪装 + Cloudflare 挑战处理
- 接口：`crawlUrl()` / `crawlByKeywords()` / `crawlEcommerce()`
- 不需要裸浏览器，不需要手动粘贴操作
- DSers 集成也是基于 Playwright（不是裸 Chrome），你直接调 `dsers.pushProduct()` 即可
- **禁止再用 Chrome 手动上网干活，所有网页自动化走 Crawlee 或 Playwright**

## 2026-05-08 — ⚠️ 全员必读提醒文件上线

**变更**: 新增 `.trae/rules/MANDATORY_REMINDERS.md`

**内容**:
1. **MCP Chrome Bridge** — extension 位置、transport 坑点（一次 setRequestHandler 限制）、备用 `chrome-mcp-client.cjs`
2. **Telegram 通信协议** — 主人唯一聊天渠道；换窗口时更新看板+写交接清单，禁止问主人"之前说了什么"
3. **会话交接流程** — 读取 SHARED_MEMORY.md → MANDATORY_REMINDERS.md → 检查看板 → 继续推进

**作用范围**: Trae 每次启动自动加载；OpenClaw 通过核心记忆同步

---

## 2026-05-19 — 🛠️ Crawlee 完整使用手册（全员必读）

> 银月已有完整 Crawlee 技能，不需要 API key。以下为全体团队参考手册。

### 调用方式

**方式 A — 文本指令（对银月说）**
```
crawlee <URL>
crawlee https://muapi.ai
```
银月收到后自动走 `lib/xiaoyan-crawler.js`（PlaywrightCrawler），开无头浏览器抓取页面。

**方式 B — Agent 工具调用（银月内部）**
```
tool crawlee crawlUrl <url>            # 爬指定网页内容
tool crawlee crawlByKeywords <关键词>   # Google 关键词搜索
tool crawlee crawlEcommerce <关键词>    # 电商选品搜索
```

**方式 C — 直接 CLI（各 Agent 均可调）**
```bash
node lib/xiaoyan-crawler.js --url <URL>
```

### 内置能力

- 代理：`http://127.0.0.1:7890`（自带）
- 浏览器指纹伪装 + Cloudflare 挑战自动处理
- 反爬重试 3 次 + 随机延迟 2-5 秒
- 结果自动存 `workspace/CASHCLAW/crawler_data/`

### 典型场景

| 场景 | 对银月说 |
|------|---------|
| 爬 muapi.ai | `crawlee https://muapi.ai` |
| 调研竞品 | `crawlee https://<竞品链接>` |
| Google 搜索 | `tool crawlee crawlByKeywords best AI tools 2026` |
| 选品比价 | `tool crawlee crawlEcommerce wireless mouse` |
| 查看爬取历史 | `tool crawlee summary` |

### ⚠️ 边界

- **禁止**用 Crawlee 爬需要登录的页面（登录操作仍用 Chrome CDP 桥接）
- **禁止**用 Crawlee 处理支付/订单流程（用 DSers/Playwright 专用模块）
- 超大页面（>10MB）自动截断，取前 5000 字
- 遇到无法处理的登录墙/验证码，退回到 Chrome CDP 桥接

---

## 2026-05-19 — 📦 agentmemory 技术档案（未来参考·暂不集成）

> **判断**：当前 OpenClaw 环境下**不合适深度集成**，原因见下。记录为技术档案，待网关支持 MCP 后可一键启用。

### 是什么

`rohitg00/agentmemory` — 轻量级 Agent 记忆库，主打向量搜索+全语义检索，R@5=95.2%（vs mem0 68.5%），43 个 MCP 工具。

### 为什么不现在集成

1. **MCP Server 方案受阻** — 银月网关（main.js）无 MCP 框架支持，无法解析 `mcpServers` 配置，需要改造网关核心
2. **Plugin 方案受阻** — 当前 OpenClaw 插件体系使用 `plugins[]` 数组结构，上游要求的 `plugins.slots.memory` 机制不存在
3. **功能重叠** — 当前已用 `memory-core`（bundled）+ `memory-tencentdb`（腾讯云）作为记忆系统，核心功能已覆盖
4. **运维负担** — 独立进程方案（`npx @agentmemory/agentmemory` 端口3111）需要额外看门狗 + 端口管理，性价比低

### 未来启用方式（当银月网关支持 MCP 后）

```json
{
  "mcpServers": {
    "agentmemory": {
      "command": "npx",
      "args": ["-y", "@agentmemory/mcp"]
    }
  }
}
```

启动：`npx @agentmemory/agentmemory` → 端口 3111
实时查看器：`http://localhost:3113`
验证：`curl http://localhost:3111/agentmemory/health`

### 现有记忆体系（已够用）

- 三层架构：Hot（memory.md，~5KB）→ Warm（microsync/daily）→ Cold（archive/research）
- 向量检索：`lib/embedding.js`（OpenRouter/Ollama 双后端）+ `lib/memory.js` 的 `searchSemantic()`
- 记忆 CRON：microsync（每日5次）+ daily-wrapup（凌晨1点）+ weekly-compound（周日3点）
- 全团队共享：`shared_memory.db`（SQLite + FTS5 全文检索）
