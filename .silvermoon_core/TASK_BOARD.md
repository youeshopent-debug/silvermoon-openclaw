# 银月钱庄 · 任务看板（生死簿）

> 最后更新：2026-05-06 18:00

---

## 当前状态

### ✅ 核心系统运行中
- **网关**：PID 51676，端口 18791 (HTTP API) + 19999 (LLM Proxy) + 4310 (Dashboard) — 三门全开
- **LLM 路由**：直连 DeepSeek API（绕过损坏的 19999 代理层）
- **Control Center**：http://127.0.0.1:4310 — 正常
- **DeepSeek V4-Flash**：已验证直接 API 调用正常（200 OK）

### ✅ Agent Bot 独立频道修复（2026-05-05）
- **根因**：LLM Proxy (port 19999) 转发挂起，所有 Agent LLM 调用超时
- **修复 1**：`global.__llmProxyServer = null`，直连 DeepSeek API
- **修复 2**：Agent Bot handler 添加 `tryQuickReply` 拦截，短问候秒回不调 LLM
- **效果**：每个 Agent 的 Telegram Bot 独立工作，无需"切换"命令

### ✅ Agent 模型分配
- **银月**：deepseek/deepseek-v4-flash
- **雅妃**：deepseek/deepseek-v4-flash
- **其他 9 个 Agent**：nvidia/deepseek-ai/deepseek-v3.2（NVIDIA NIM 免费）

### ✅ Agent Bot 独立频道一览
| Agent | Bot 用户名 | 状态 |
|-------|-----------|------|
| 雅妃 | @yafei82bot | ✅ 在线 |
| 萧炎 | @xiaoyan82bot | ✅ 在线 |
| 韩立 | @hanli82bot | ✅ 在线 |
| 美杜莎 | @medusa82bot | ✅ 在线 |
| 小医仙 | @xiaoyixian82bot | ✅ 在线 |
| 药老 | @yaolao82bot | ✅ 在线 |
| 紫灵 | @ziling82bot | ✅ 在线 |
| 李长寿 | @lichangshou82bot | ✅ 在线 |
| 紫妍 | @ziyan82bot | ✅ 在线 |

### ⚠️ 待处理
- **代理 7890 未启动**：影响 Crawlee 爬虫和 TG 网络稳定性
- **LLM Proxy (19999)**：转发功能异常，需后续修复缓存层

---

## ✅ 寻宝鼠选品报告 (2026-05-06) — AI 硬件全球选品

**文件**: `.silvermoon_core/marketing/ai_product_sourcing_report_20260506.md`
**范围**: 5 大品类 x 2-3 候选 = 13 个产品
**数据源**: AliExpress / Alibaba / Amazon / CJ Dropshipping

### 覆盖品类
1. **AI Smart Translation Earbuds** — Timekettle X1 ($529-649), M80 Pro ($18-35), CJ Hybrid ($25-45)
2. **AI Smart Glasses** — LIGE BWXKOENPro *($34.80, Top Pick)*, Kyboton L802, MT5 ULTRA ($4.98!)
3. **AI Digital Notebooks** — Smart Writing Notepad ($25-55), LCD Writing Tablet ($8-20)
4. **AI Voice Recorders** — Plaud Note ($155), STTWUNAKE ($42-80), Recorder Pen ($10-25)
5. **AI Scan Translator Pens** — Scan Pen ($10.74-53.45), Premium Pen ($35-55)

### Top 5 优先级
| Rank | Product | Cost | Sell | Profit/Unit |
|------|---------|------|------|-------------|
| 1 | LIGE BWXKOENPro Glasses | $34.80 | $129 | ~$75 |
| 2 | AI Scan Translator Pen | $15-30 | $59-79 | ~$35-50 |
| 3 | M80 Pro Earbuds | $18-35 | $59-89 | ~$30-45 |
| 4 | Smart Writing Notepad | $25-55 | $79-129 | ~$40-60 |
| 5 | Voice Recorder Pen | $10-25 | $39-69 | ~$22-40 |

### 下一步
- 样品测试（LIGE Glasses + Scan Pen + Recorder Pen）
- CJ Dropshipping 自动化对接
- 供应商联系（LIGE dropshipping 协议）
- TikTok 内容生产（POV 场景视频）
