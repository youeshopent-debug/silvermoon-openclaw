# 银月钱庄 · OpenClaw

> 基于 OpenClaw 框架的金融自动化多 Agent 系统。
> 33 个 Agent 宗门 · Telegram/Discord 双通道 · Stripe 支付网关 · 量化交易哨兵

---

## 项目定位

银月钱庄是 OpenClaw 生态的核心节点，负责：
- **Agent 编排**：33 个角色（银月/李长寿/美杜莎/萧炎/药老等）的调度与协作
- **支付网关**：Stripe 收单、对账、风控（CashClaw 子系统）
- **量化哨兵**：萧炎交易策略引擎，实时行情监控
- **多通道通信**：Telegram 主通道 + Discord 备用通道
- **记忆系统**：长期记忆库 + 向量检索 + 反思进化

## 环境依赖

### 运行时
- **Node.js** ≥ 18.x（推荐 22.x）
- **Ollama**（本地推理，推荐 `gemma4:e4b` 轻量模型）
- **OpenRelay**（可选，提供 Codex/NVIDIA NIM 等云端推理）

### 系统依赖
- `better-sqlite3` — 本地持久化存储
- `discord.js` — Discord 机器人 SDK
- `node-telegram-bot-api` — Telegram 机器人 SDK
- `playwright` — 网页抓取与自动化
- `crawlee` — 爬虫框架
- `node-cron` — 定时任务调度

### 可选依赖
- `deer-flow` — 字节跳动开源 Super Agent Harness（端口 2026）
- `openclaw-control-center` — Web 控制面板（端口 4310）

## 快速部署

```bash
# 1. 克隆仓库
git clone https://github.com/<your-org>/openclaw.git
cd openclaw

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入以下密钥：
#   - TELEGRAM_BOT_TOKEN
#   - DISCORD_BOT_TOKEN（可选）
#   - STRIPE_SECRET_KEY（可选）
#   - NVIDIA_API_KEY（可选，用于 OpenRelay）
#   - GROQ_API_KEY（可选）

# 4. 启动银月网关
node main.js

# 5. 验证运行
curl http://127.0.0.1:18791/health
# 预期响应: {"status":"ok","uptime":...}
```

## 项目结构

```
openclaw/
├── main.js                 # 银月网关主入口（端口 18791）
├── openclaw.json           # 全局配置（Agent 列表/模型路由）
├── lib/                    # 核心库模块
│   ├── agents.js           # Agent 加载与调度
│   ├── brain-router.js     # 意图路由
│   ├── conversation.js     # 对话管理
│   ├── cron.js             # 定时任务
│   ├── finance-fallback.js # 金融降级逻辑
│   ├── gemini-client.js    # Gemini API 客户端
│   ├── memory.js           # 记忆系统
│   ├── stripe-event.js     # Stripe Webhook 处理
│   ├── telegram-bridge.js  # Telegram 桥接
│   └── ...                 # 50+ 核心模块
├── sects/                  # Agent 宗门配置（SOUL.md + TASK.json）
│   ├── 银月/               # 总管
│   ├── 李长寿/             # 护法/架构师
│   ├── 美杜莎/             # UI/UX 设计
│   ├── 萧炎/               # 交易策略
│   ├── 药老/               # 增长/合规
│   └── ...                 # 28 个扩展角色
├── tests/                  # 测试套件（40+ 单元测试）
├── landing/                # Next.js 官网落地页
├── plugins/                # 插件系统
│   ├── rtk/                # Rewrite Token Kit
│   └── agency-agents/      # Agent 扩展
└── silvermoon_local/       # 银月本地配置副本
```

## Agent 宗门一览

| 角色 | 职责 | 模型 |
|------|------|------|
| 银月 | 总管，协调所有 Agent | `nvidia/llama-3.3-nemotron-super-49b-v1` |
| 李长寿 | 护法/全栈架构师 | `nvidia/deepseek-r1` |
| 美杜莎 | UI/UX 设计专家 | `nvidia/qwen-2.5-72b-instruct` |
| 萧炎 | 交易策略专家 | `nvidia/deepseek-r1` |
| 药老 | 增长/合规审查 | `nvidia/llama-3.3-nemotron-super-49b-v1` |
| 韩立 | 调查/情报分析 | `nvidia/qwen-2.5-72b-instruct` |
| 紫灵 | 礼宾/客服 | `or-codex/gpt-5.4-mini` |
| 紫研 | 数据分析 | `or-codex/gpt-5.4-mini` |
| 墨影 | 工匠/后端 | `nvidia/llama-3.3-nemotron-super-49b-v1` |
| 雅妃 | 财务/会计 | `nvidia/qwen-2.5-72b-instruct` |
| 小医仙 | 社交媒体 | `or-codex/gpt-5.4-mini` |
| 六扫清台 | 系统清理 | `ollama/gemma4:e4b` |

## 通信通道

- **Telegram**：主通道，支持文字/语音/TTS
- **Discord**：备用通道（当前禁用）
- **HTTP API**：`http://127.0.0.1:18791`

## 维护命令

```bash
# 查看运行状态
curl http://127.0.0.1:18791/api/status

# 查看健康检查
curl http://127.0.0.1:18791/health

# 查看实时日志
tail -f logs/gateway-out.log

# 重启银月
taskkill /F /PID (获取的 PID)
node main.js
```

## 许可证

私有 · © 2026 Alanlsl · 银月钱庄
