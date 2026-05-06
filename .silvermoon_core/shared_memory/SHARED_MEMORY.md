# 银月钱庄 · 共享记忆

## 最近更新：2026-05-04

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

---

## 2026-05-06 — 寻宝鼠 AI 硬件选品报告完成

**Handoff**: 寻宝鼠 → 药老
**任务**: 5大品类AI硬件全球选品调研
**报告位置**: `marketing/ai_product_sourcing_report_20260506.md`
**Top Pick**: LIGE BWXKOENPro AI Smart Glasses ($34.80 cost → $129 sell, ~$75/unit profit)
**待药老**: 编写Shopify详情页文案 + 确认供应商联系
