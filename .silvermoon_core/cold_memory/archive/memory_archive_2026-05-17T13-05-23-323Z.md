# 银月钱庄 · 热记忆（Hot Memory）

> 最后更新：2026-05-04 | 大小：~5KB | 这是 AI 每次对话自动加载的主记忆文件
> 规则：不写流水账，只放最精华的长期记忆。超过 8KB 需归档。

---

## 一、系统核心身份

银月钱庄 = AI 自动化网关 + 数字产品/实体电商平台。
- 主理人：ALAN 艾伦（Lau Sii Lun）
- 商业模式：数字产品（0成本/高毛利）+ 实体周边（0库存/一件代发）
- 目标市场：全球（主攻 USD/SGD）
- 品牌基调：科技感、极客美学、AI 效率

## 二、产品矩阵

| 类型 | 平台 | 策略 |
|------|------|------|
| 数字产品 | Lemon Squeezy | AI 自动化工作流、开发者效率指南、跨境基建代码片段 |
| 实体周边 | Shopify + CJ Dropshipping | 极客桌面美学、RGB 外设、开发者周边 |
| 内容引流 | TikTok / Shorts / X | 闪剪数字人出镜，全英文配音 |

## 三、Trae 开发团队（IDE 内协作）

| Agent | ID | 职责 |
|-------|-----|------|
| 美杜莎 | mds | UI/UX设计（Figma→代码） |
| 药老 | yl | 电商增长/SEO/文案 |
| 紫妍 | zy | 数字人口播脚本 |
| 萧炎 | xy | 竞品情报分析 |
| 蓝灵儿 | ller | 多媒体/生图 |
| 小医仙 | xian | 短视频分镜编剧 |
| 寻宝鼠 | rat | 爆款选品 |
| 海波东 | risk | 海外客诉/风控 |

## 四、OpenClaw 网关（Telegram/Discord 产品机器人）

| Agent | ID | 职责 |
|-------|-----|------|
| 银月 | yy | 总管/网关主入口 |
| 李长寿 | lcs | 全栈架构/Web开发 |
| 墨影 | my | 系统巡检/定时任务 |
| 韩立 | hl | 侦查/情报收集 |
| 雅妃 | yf | 财务/商务 |
| 紫灵 | zl | 礼宾/客服 |

## 五、关键架构决策

1. **Gateway 主入口**：`main.js`，Telegram 桥接（非 Discord）
2. **记忆系统**：三层架构（Hot/Warm/Cold）
   - Hot：`memory.md`（每次对话自动加载，≤8KB）
   - Warm：`warm_memory/`（每日结构化摘要，按需检索）
   - Cold：`cold_memory/`（长期知识库/Archive）
3. **共享记忆**：`shared_memory.db`（SQLite+FTS5 + 语义向量检索）
4. **会话存储**：`agents/main/sessions/*.jsonl`
5. **模型**：Groq (Llama-4) / NVIDIA (DeepSeek) / Ollama (Qwen) 多模型路由
6. **代理**：非 Telegram 网络请求走 `http://127.0.0.1:7890`
7. **Token 管理**：`.env` 文件存储所有 Bot Token（已 gitignore）
8. **RAG 语义检索**（2026-05-04 上线）
   - 后端：OpenRouter 云端（BAAI/bge-m3，dim=1024）
   - 中英混合内容优化，余弦相似度语义搜索
   - 触发方式：`!rag <查询>` 或 AI 自动调用 `semantic_search` 工具

## 五、核心规则（必须遵守）

1. **诚实原则**：不确定直接说"不确定"，严禁瞎猜
2. **防御编程**：所有核心逻辑必须 try-catch，留足降级方案
3. **因果切割**：每个组件独立，一个故障不影响整体
4. **记忆排程**：Microsync（5次/天）→ Daily Wrap-up（凌晨1点）→ Weekly Compound（周末）
5. **Karpathy 编码准则**：先思考再编码、简洁优先、精准改动、目标驱动
6. **记忆蒸馏**：排程脚本自动过滤自身产生的对话噪声

## 六、当前活跃任务

- TASK-039：三层记忆架构升级（墨影实现排程脚本）
- TASK-038：Chrome 浏览器自动化上线
- 记忆系统缺失机制：microsync/Daily/Weekly/LLM 自动写入

## 七、部署与环境

- 开发环境：Windows（本地）
- 目标生产：GCP（Ubuntu）
- 环境变量通过 `process.env.NODE_ENV` 判断
