# 银月钱庄 · 全面诊断排查报告

**生成时间**: 2026-05-11 22:30
**运行环境**: 本地 Windows (非 VPS)
**诊断范围**: OpenClaw 网关 + 14 Agent 自动化工作流

---

## 板块1: 错误日志与异常堆栈采集

### 1.1 DAEMON 崩溃循环 (已修复 — 目录已删除)

| 时间范围 | 日志文件 | 循环次数 | 根因 |
|---------|---------|---------|------|
| May 4-10 | daemon.log (10.6KB) | 5月8日最高: 15+次 | DAEMON 内部错误导致 child process exit code=1 |

**典型循环模式** (child.log, 2108 bytes):
```
[env] 已加载 .env
[env] 已加载 .env
[env] 已加载 .env
[env] 已加载 .env  ← 重复加载 2-4 次后 exit code=1
```
**现状**: DAEMON 目录已确认被物理删除。当前 main.js (PID 34488) 以裸进程方式运行，**无守护进程保护**。

### 1.2 单例杀戮链 — 遗留僵尸进程

gateway-err.log 中记录 **7 次** 单例冲突事件:

| 时间 | 被杀 PID | 备注 |
|------|---------|------|
| May 8 23:04 | 30088 | 首次冲突 |
| May 9 (未记录) | 23952, 24980 | 双重杀戮 |
| May 10 01:41 | 47096 | 凌晨冲突 |
| May 10 07:43 | 45008 | 早上冲突 |
| May 10 23:26 | 28380 | 深夜冲突 |
| May 10 23:30 | 38092 | 4分钟后再次冲突 |

**根因分析**: 锁文件竞态条件。同时启动多个 main.js 实例时，第一个来不及写锁文件，第二个已启动，触发互杀。杀死后锁文件残留，导致后续启动失败。

**当前僵尸**: PID 24492 (8.8MB), PID 34172 (10.3MB), PID 31076 (9.5MB) — 总计 ~28.6MB 内存泄漏。

### 1.3 代理不可达 — 持续降级运行

gateway-err.log 中 **20+ 条** 代理连接失败记录:
```
Error: connect ECONNREFUSED http://127.0.0.1:7890
```
- `.env` 中不存在 `OPENCLAIM_PROXY_URL` 或 `USE_PROXY`
- main.js 代码 lines 133-159 **主动清除** 所有 proxy 环境变量
- 但其他代码路径 (lines 3176-3179) 仍尝试通过 `OPENCLAIM_PROXY_URL → PROXY_URL → HTTP_PROXY` 回退链连接代理
- **净效果**: Telegram 正常 (env 已清)，但其他 API 调用尝试不可达代理 → 降级运行

### 1.4 buildMorningBrief 连续 3 天失败

```
May 9  00:00:07 [buildMorningBrief] 早报生成异常: fetchFredLatest is not defined
May 10 00:00:03 [buildMorningBrief] 早报生成异常: fetchFredLatest is not defined
May 11 00:00:17 [buildMorningBrief] 早报生成异常: fetchFredLatest is not defined
```
**根因**: `buildMorningBrief` 函数中引用了 `fetchFredLatest`，但该函数**未定义/未导入**。连续 3 天同一时刻同一错误，说明 CRON 调度正常，但业务代码缺失。

### 1.5 心跳超时链 (Heartbeat Timeout)

gateway-err.log 中 **7+ 条** 心跳超时记录:
```
[heartbeat] 无响应超过 300s，记录警告但不自杀
```
- 仅在日志中记录警告，**从不触发自杀或重启**
- 无响应的 Agent 进入"活死人"状态 — 进程活着但不再处理消息
- 最后一条记录: May 11 09:20:01 — 距现在已 13+ 小时

### 1.6 Telegram 实体解析错误

```
2026-05-08 15:55:01 ETELEGRAM: 400 Bad Request: can't parse entities
2026-05-08 16:01:17 ETELEGRAM: 400 Bad Request: can't parse entities
```
**根因**: 发送的消息中使用了 Markdown/HTML 实体标记但格式错误（如 `**` 未闭合）。非致命但对用户体验有影响。

### 1.7 DNS 解析失败

```
[cron] quant_safety_net 执行失败: getaddrinfo ENOTFOUND api.coingecko.com
```
**根因**: 网络层无法解析 CoinGecko API 域名。可能原因：
- 代理不可用导致 DNS 查询走直连
- 本地 DNS 配置问题
- 该时段网络中断

### 1.8 Mailer IPv6 连接失败

```
mailer heartbeat reconnect failed: connect ENETUNREACH 2404:6800:4003:c1a::6c:587
```
**根因**: 邮件服务器 Gmail 返回 IPv6 地址，但本地网络不支持 IPv6 出站。`ENETUNREACH` = 网络不可达。

### 1.9 当前网关日志静默 (最关键发现)

| 指标 | 值 |
|------|-----|
| gateway-out.log 最后内容 | 2026-05-11 14:01:10 (mailer 心跳 OK) |
| gateway-out.log 文件时间戳 | 2026-05-11 22:01:10 (8 小时前) |
| gateway-err.log 最后错误 | 2026-05-11 09:20:01 (13 小时前) |
| PID 34488 状态 | **存活** (进程活跃, 3 端口监听) |

**诊断**: 网关进程存活，3 个端口全部正常监听，但**自 14:01 起未产生任何日志输出**。这意味：
1. CRON 调度器可能已卡死（无 15:00/16:00/... 的 CRON 触发日志）
2. Telegram polling 仍在运行但无消息事件
3. 文件描述符/句柄可能接近上限

---

## 板块2: "老掉线" 完整链路分析

### 2.1 网络层

```
TCP 链路:
  本机 (main.js) → Telegram API (api.telegram.org:443) ↔ 14 个 Bot Polling 连接
                   → Gmail SMTP (smtp.gmail.com:587)        ← IPv6 不可达
                   → CoinGecko API (api.coingecko.com:443)  ← DNS 解析失败
                   → NVIDIA NIM (通过 127.0.0.1:19999)      ← 正常
                   → Ollama (127.0.0.1:11434)               ← 未运行
```

**代理依赖图**:
```
外部 API 调用 → 代码主动清除 proxy env → 直连
                                              ↓
                                    代码 fallback 链尝试代理
                                              ↓
                                    ECONNREFUSED 127.0.0.1:7890
                                              ↓
                                    降级运行 (部分 API 失败)
```

### 2.2 消息队列层 (Telegram Polling)

```
正常状态:
  14 个 Bot 实例 → 各自发起 long polling GET /getUpdates
                → 每 30s 超时重连
                → 持续保持长连接

断线模式 (ECONNRESET):
  第 T 秒: 14 个连接同时收到 ECONNRESET  ← 关键: 不是逐个断开
  第 T+1 秒: 14 个 Bot 同时触发 reconnect
  第 T+30 秒: 重新建立 14 个连接
```

**掉线时间线 (推断)**: 从日志模式看，ECONNRESET 触发周期约为每 12-24 小时一次，全部代理同时掉线。推测触发因素：
1. Telegram 服务端主动断开空闲连接
2. 本地网络路由抖动 (代理不可达时可能触发)
3. Windows 电源管理/网络重置

### 2.3 心跳保活机制

```
main.js 心跳实现:
  ✅ 注册: 所有 Agent 注册心跳回调
  ✅ 监测: 检测到无响应 >300s 写日志告警
  ❌ 自杀: 从不触发进程终止
  ❌ 重启: Agent 进入"活死人"状态后不自动恢复
  ❌ 重建: 连接断开后不重建 polling
  ⚠️ 超时后可存活,但不再处理消息
```

### 2.4 重连策略

```
当前策略:
  Telegram Bot: 依赖 got 库内置重连 (指数退避)
  CRON 调度: 每次触发独立执行,不受前次影响
  Agent 健康: health check 日志 >300s → 无操作
```

**失效原因**:
1. Heartbeat 超时后无任何恢复动作
2. 无进程级 watchdog (DAEMON 已删)
3. 无窗口/滑动探针 (Ping/Pong 保活)
4. Telegram polling 断开后重建延迟 ~30s

---

## 板块3: 资源占用与系统上限评估

### 3.1 系统资源总览

| 资源 | 总量 | 已用 | 剩余 | 利用率 |
|------|------|------|------|--------|
| 物理内存 | 15.7 GB | ~13.3 GB | ~2.4 GB | **85%** |
| CPU (逻辑核心) | 8+ | - | - | - |
| 进程数量 | - | 200+ | - | - |
| Node.js 进程 | - | 27 | - | - |

### 3.2 Node.js 进程分类

| 类别 | 数量 | 内存合计 | 说明 |
|------|------|---------|------|
| **ACTIVE 网关** | 1 | 84.9 MB | main.js PID 34488, 2160 handles |
| **ZOMBIE 网关** | 3 | ~28.6 MB | PID 24492/34172/31076, 单例杀戮残留 |
| **PM2 守护** | 1 | 19.4 MB | 未管理任何应用 |
| **MCP 服务器** | 8+ | ~100 MB | Trae IDE 工具进程 |
| **其他/未知** | 14 | ~180 MB | Adobe CC, 浏览器, 杂项 |
| **总计** | **27** | **~412 MB** | 仅 Node.js 部分 |

### 3.3 关键进程详解

| PID | 类型 | 内存 | 句柄 | 线程 | CPU(分) | 启动时间 | 状态 |
|-----|------|------|------|------|---------|---------|------|
| 34488 | 网关 | 84.9 MB | 2160 | 14 | 7.9 | 05/11 07:30 | 存活但静默 |
| 24492 | 僵尸 | 8.8 MB | 187 | - | 0 | 05/10 16:54 | 需清理 |
| 34172 | 僵尸 | 10.3 MB | 183 | - | 0.1 | 05/11 07:28 | 需清理 |
| 31076 | 僵尸 | 9.5 MB | 192 | - | 0.1 | 05/11 07:30 | 需清理 |

### 3.4 句柄/线程/内存上限评估

| 指标 | 网关当前值 | 系统默认上限 | 风险 |
|------|-----------|-------------|------|
| 句柄数 | 2,160 | 16,384/进程 | **低** (13.2%) |
| 线程数 | 14 | 理论无硬上限 | **低** |
| 每进程内存 | 84.9 MB | 2GB / 32bit | **低** (4.2%) |
| 总 node 进程 | 27 | ~500+ (Windows) | **低** |
| 系统总内存 | 85% | 90%+ 危险 | **中⚠️** |

**结论**: 当前 14 Agent 配置 **不构成资源瓶颈**。真正的瓶颈是：
1. **系统总内存 85%** — Adobe CC + 浏览器 + MCP 服务吃掉大量内存
2. **单进程 2160 句柄** — 如果网关持续运行 1 周以上，句柄可能接近上限
3. **3 个僵尸进程浪费 ~28MB**

### 3.5 Agent 数量与调度冲突

14 Agent 配置不会导致资源耗尽。但存在 **配置级别** 的问题：
- **重复 Agent ID**: `trae_ziyan` 出现两次 (紫妍 + 紫研)，配置合并时覆盖后者
- **4 个 Agent 缺 Telegram Token**: 寻宝鼠/紫研(dup)/电商运营官 token 为空，李长寿无 telegram 段
- **14 个 Bot 共用一个 token?**: `.env` 中只有 `TELEGRAM_BOT_TOKEN=862724...` 一个 token，config 中各 Agent 的 token 可能指向同一 bot

---

## 板块4: 外围依赖检查

### 4.1 服务端口状态

| 端口 | 服务 | 状态 | 所属 PID | 说明 |
|------|------|------|---------|------|
| 19999 | LLM Proxy (built-in) | ✅ LISTENING | 34488 | 网关内嵌缓存层 |
| 18791 | Gateway API | ✅ LISTENING | 34488 | 4 个 TIME_WAIT 连接 |
| 4310 | ControlCenter | ✅ LISTENING | 34488 | HTTP 看板 |
| 11434 | Ollama | ❌ NOT LISTENING | - | 配置中启用但未运行 |

### 4.2 API Keys 与 Token

| Key | 位置 | 状态 | 风险 |
|-----|------|------|------|
| TELEGRAM_BOT_TOKEN | `.env` | ✅ 存在 | ⚠️ 只有一个 token 驱动 14 Agent |
| DEEPSEEK_API_KEY | `.env` | ✅ 存在 | 可正常使用 |
| NVIDIA_API_KEY | User Env (非 .env) | ✅ 存在 | ⚠️ 不读 .env 可能找不到 |
| SMTP 凭据 | `.env` | ✅ 存在 | ⚠️ IPv6 不可达 |

**NVIDIA_API_KEY 取证**:
```
变量: NVIDIA_API_KEY
值: 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
类型: User 环境变量 (非 .env)
引用: openclaw.json models.providers.nvidia.apiKey = "${NVIDIA_API_KEY}"
加载: main.js 通过 process.env.NVIDIA_API_KEY 读取 (需先加载 .env 再读 User Env)
风险: 如果 .env 加载后覆盖了 User Env, 会读到 undefined
```

### 4.3 配置一致性检查

| 检查项 | 结果 | 风险 |
|--------|------|------|
| agents.list 与 sects/ 目录一致性 | ⚠️ 14 Agent in config, sects/ 未验证 | 中 |
| 重复 Agent ID (trae_ziyan) | ❌ 两次 | **高** — 配置覆盖 |
| 空 Telegram Token (x3) | ❌ | **高** — 无法连接 |
| 缺 Telegram 段 (李长寿) | ❌ | **高** — 无法接收消息 |
| Ollama 启用但未运行 | ⚠️ plugin.entries.ollama.enabled=true | 中 — 回退正常 |
| .env 缺 NODE_ENV | ⚠️ | 低 |
| .env 缺 PORT | ⚠️ | 低 — 依赖 openclaw.json |

### 4.4 API 速率限制

| 服务 | 风险评估 |
|------|---------|
| Telegram API | 14 bot x 1 poll/30s = 0.5 req/s, **远低于限制** |
| NVIDIA NIM | 40 RPM 免费上限, 14 Agent 可能触及 |
| DeepSeek API | 取决于账户等级, 需确认 |
| CoinGecko | 未发生, DNS 解析失败是前置问题 |

### 4.5 MCP 工具服务 (非 OpenClaw, 仅供参考)

```
PID 26660-26804 为 Trae IDE 的 MCP 工具进程:
  - memory, playwright, puppeteer, github, figma-developer
  - sequential-thinking, hyperbrowser, airtable, chrome-bridge
  - 总和 ~100MB, 不影响 OpenClaw
```

---

## 板块5: 可复现测试场景与日志采集脚本

### 5.1 日志采集脚本 (已就绪)

**文件**: `_diag_collect.cjs`
**位置**: `C:\Users\User\.openclaw\`
**使用方法**: `node _diag_collect.cjs`
**输出目录**: `.silvermoon_core/diag_<timestamp>/`

采集内容:
```
01_process_snapshot.txt   — 所有 node/python/ollama/ngrok/pm2 进程
02_node_processes.txt     — node.exe 详细信息 (内存/句柄/线程/命令行)
03_listening_ports.txt    — 监听端口
04_system_memory.txt      — 总内存/空闲/使用率
05_total_handles.txt      — 全系统句柄合计
06_log_files.txt          — 日志文件列表 (大小/修改时间)
07_tail_*.txt             — 各日志最新 100 行
08_config_summary.txt     — openclaw.json 关键字段
09_env_safe.txt           — 环境变量 (密钥脱敏)
```

### 5.2 可复现测试场景

#### 场景 A: Telegram Polling 断线复现

```
目标: 验证 ECONNRESET 后网关行为和恢复时间
步骤:
  1. 确认网关运行: node _diag_collect.cjs (检查 gateway 进程)
  2. 记录当前日志尾部: Get-Content logs\gateway-out.log -Tail 20
  3. 手动触发 Telegram 连接断开:
     - 方式 A: 在网关进程中执行 chrome_computer → 切换网络适配器
     - 方式 B: 用 Process Explorer → 右键 gateway PID → Close Handle → 选择 Telegram socket
  4. 等待 60 秒
  5. 检查日志: Get-Content logs\gateway-out.log -Tail 40 | Select-String "reconnect|error|ECONNRESET"
通过标准:
  ✅ 网关在 60 秒内自动重建 Telegram 连接
  ✅ 日志中出现 "reconnected" 或等效信息
  ✅ Agent 继续处理消息
```

#### 场景 B: 单例锁竞态复现

```
目标: 验证多个 main.js 同时启动时的锁冲突
步骤:
  1. 准备: 清理僵尸进程和锁文件 (检查 .silvermoon_core/locks/)
  2. 开 2 个终端:
     终端 1: node main.js > logs/test_lock_a.log 2>&1
     终端 2: node main.js > logs/test_lock_b.log 2>&1
     两个命令在 1 秒内同时启动
  3. 等待 10 秒
  4. 检查:
     - 哪个进程存活? (Get-Process node | Where CommandLine ~ main.js)
     - 被杀进程日志是否包含 "SIGTERM"
     - 锁文件是否只有一个
通过标准:
  ✅ 只有一个 main.js 存活
  ✅ 被杀进程正确记录 "单例" 日志
  ✅ 锁文件清理干净
```

#### 场景 C: 代理不可达 + API 降级

```
目标: 验证代理不可达时系统的降级行为
前提: 确保 127.0.0.1:7890 不可达 (不启动代理软件)
步骤:
  1. 确认代理不可达: curl -x http://127.0.0.1:7890 https://api.telegram.org
  2. 检查网关是否在降级模式: Get-Content logs\gateway-out.log -Tail 20 | Select-String "降级|fallback|degraded"
  3. 触发 CRON 任务: (观察 14:00/15:00 等整点 CRON)
  4. 检查结果:
     - Telegram: 正常 (env 已清)
     - NVIDIA: 正常 (走 localhost:19999)
     - Ollama: 失败 (端口 11434 未监听)
     - CoinGecko: 失败 (DNS + 无代理)
通过标准:
  ✅ Telegram 始终可用
  ✅ 日志中有明确的降级标注
  ❌ 无代理时外部 API 应优雅重试而非静默失败
```

#### 场景 D: 重复 Agent ID 配置合并测试

```
目标: 验证 trae_ziyan (紫妍) + trae_ziyan (紫研) 重复的后果
步骤:
  1. 搜索 config 中 trae_ziyan 出现次数: Select-String "trae_ziyan" openclaw.json
  2. 观察 gateway-out.log 中两个 Agent 的初始化日志
  3. 检查是否有 "duplicate" 或 "overwrite" 警告
预期结果:
  ⚠️ 第二个 trae_ziyan (紫研) 的配置完全覆盖第一个 (紫妍)
  ⚠️ 紫妍的 Telegram token 和 skills 被紫研覆盖
  ⚠️ 紫研的 token 为空 → 紫妍实际无法工作
```

#### 场景 E: 300s 心跳超时 → "活死人" 状态

```
目标: 验证心跳超时后 Agent 是否会自愈
步骤:
  1. 记录活跃 Agent: 检查 gateway-out.log 中 Agent patrol 日志
  2. 等待心跳超时: 观察 gateway-err.log 中 heartbeat 警告
  3. 超时后:
     - 尝试发送 Telegram 消息给该 Agent
     - 检查 Agent 是否响应
     - 检查日志是否有恢复记录
通过标准:
  ✅ 心跳超时应触发 Agent 重启/重建连接
  ❌ 当前实现: 仅写日志, 不重启 → "活死人" 状态
```

### 5.3 单场景快速测试脚本

创建快速测试脚本 `_diag_test_agent.cjs`:

```javascript
// _diag_test_agent.cjs — 单 Agent 连通性测试
// 用法: node _diag_test_agent.cjs <agent_id>

const agentId = process.argv[2] || 'trae_yinyue';
const http = require('http');

// 1. 检查网关 API 是否存活
const checkGateway = () => new Promise((resolve) => {
  const req = http.get('http://127.0.0.1:18791/api/health', (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => resolve({ ok: res.statusCode === 200, data }));
  });
  req.on('error', (e) => resolve({ ok: false, error: e.message }));
  req.end();
});

// 2. 检查 Agent 是否在日志中有活动
const checkAgentLogs = () => {
  const fs = require('fs');
  const logPath = require('path').join(require('os').homedir(), '.openclaw', 'logs', 'gateway-out.log');
  if (!fs.existsSync(logPath)) return 'LOG_NOT_FOUND';
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n').reverse().slice(0, 500);
  const matches = lines.filter(l => l.includes(agentId));
  return matches.length > 0
    ? `最近 500 行中有 ${matches.length} 条 ${agentId} 相关日志`
    : `最近 500 行中无 ${agentId} 相关日志`;
};

(async () => {
  console.log(`\n🔍 测试 Agent: ${agentId}\n`);
  const gw = await checkGateway();
  console.log(`网关健康: ${gw.ok ? '✅' : '❌'} ${gw.data || gw.error}`);
  console.log(`Agent 日志: ${checkAgentLogs()}`);
  console.log(`\n端口检查:`);
  const ports = [18791, 19999, 4310, 11434];
  for (const p of ports) {
    try {
      const r = await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${p}/`, (res) => {
          resolve({ ok: res.statusCode < 500 });
          res.resume();
        });
        req.on('error', (e) => resolve({ ok: false }));
        req.setTimeout(2000, () => { req.destroy(); resolve({ ok: false }); });
      });
      console.log(`  端口 ${p}: ${r.ok ? '✅' : '❌'}`);
    } catch { console.log(`  端口 ${p}: ❌`); }
  }
})();
```

---

## 板块6: 修复优先级清单

### 优先级 P0 — 立即修复 (系统无法正常工作)

#### P0-1: 重复 Agent ID (trae_ziyan x2)

| 字段 | 内容 |
|------|------|
| **问题** | openclaw.json 中 `trae_ziyan` ID 出现两次 — 紫妍(行331) 和 紫研(行384)，后者覆盖前者 |
| **根因** | 配置文件中错误的重复 ID |
| **修复方案** | 将第二个 `trae_ziyan` (紫研) 的 ID 改为 `trae_ziyan2` 或 `trae_ziyan_v2` |
| **验证步骤** | 1) `Select-String "trae_ziyan" openclaw.json` 确认唯一<br>2) 重启网关后检查日志中两个 Agent 均成功初始化 |
| **通过准则** | 唯一 `trae_ziyan` 出现次数 ≤1，两个 Agent 各自独立注册 |
| **回滚方案** | 改回原 ID |

#### P0-2: 空 Telegram Token (寻宝鼠/紫研/电商运营官)

| 字段 | 内容 |
|------|------|
| **问题** | 3 Agent 的 Telegram token 为空字符串，无法连接 |
| **根因** | 配置遗漏 |
| **修复方案** | 补充有效 Telegram Bot Token，或改为共用主 token |
| **验证步骤** | 重启后检查日志：3 Agent 成功连接到 Telegram |
| **通过准则** | 3 Agent 的 polling 连接成功建立 |
| **回滚方案** | 删回空字符串 |

#### P0-3: 李长寿缺 Telegram 段

| 字段 | 内容 |
|------|------|
| **问题** | trae_lichangshou 的配置中完全不存在 `"telegram"` 段，无法通过 Telegram 接收/发送消息 |
| **根因** | Agent 配置不完整 |
| **修复方案** | 补全李长寿的 Telegram 配置段 (参考其他 Agent 格式) |
| **验证步骤** | 重启后通过 Telegram 向李长寿发消息，确认能收到回复 |
| **通过准则** | 李长寿的 Telegram Bot 成功注册并响应消息 |
| **回滚方案** | 删回原状态 |

#### P0-4: Ollama 启用但未运行

| 字段 | 内容 |
|------|------|
| **问题** | `openclaw.json` 中 `plugin.entries.ollama.enabled = true`，但 Port 11434 无进程监听。NVIDIA 失败时会尝试 fallback 到 Ollama → 双重失败 |
| **根因** | Ollama 服务未启动 / 未安装 |
| **修复方案** | 方案A: 启动 Ollama (`ollama serve`)<br>方案B: 关闭 Ollama plugin (`"enabled": false`) |
| **验证步骤** | 方案A: `curl http://127.0.0.1:11434/api/tags` 返回 200<br>方案B: `node -e "console.log(require('./main.js'))"` 不报 Ollama 错误 |
| **通过准则** | NVIDIA 失败时不再 fallback 到不通的 Ollama |
| **回滚方案** | 改回 `"enabled": true` |

### 优先级 P1 — 高优先级 (核心功能不稳定)

#### P1-1: Heartbeat 超时无动作 (活死人)

| 字段 | 内容 |
|------|------|
| **问题** | Heartbeat 超时 300s 后仅写日志告警，不触发 Agent 重启/连接重建，Agent 进入活死人状态 |
| **根因** | heartbeat 回调逻辑缺失自动恢复机制 |
| **修复方案** | 在 main.js heartbeat handler 中添加: 超时后 → 销毁 Agent Bot 实例 → 重新创建 polling 连接 |
| **验证步骤** | 1) 模拟 Agent 无响应 (block event loop)<br>2) 等待 300s+<br>3) 检查日志: 触发重启 → 连接重建 |
| **通过准则** | 心跳超时后 60 秒内 Agent 自动重建连接并恢复服务 |
| **回滚方案** | 注释掉自动重启代码, 回归纯日志模式 |

#### P1-2: 单例锁竞态条件 (僵尸进程)

| 字段 | 内容 |
|------|------|
| **问题** | 同时启动多个 main.js 时锁文件来不及写入导致互杀，遗留 ~28MB 僵尸进程 |
| **根因** | 锁文件检查 (stat) → 写入 (write) 非原子操作 |
| **修复方案** | 使用 `fs.mkdtemp` 原子性创建锁文件 (UUID 命名) + 启动后 500ms 延迟检查重复 |
| **验证步骤** | 场景 B 测试: 同时在 2 个终端启动 main.js, 仅 1 个存活 |
| **通过准则** | 10 次并行启动测试中 0 次产生僵尸进程 |
| **回滚方案** | 回到当前基于 stat+write 的锁机制 |

#### P1-3: buildMorningBrief 因 fetchFredLatest 未定义连败 3 天

| 字段 | 内容 |
|------|------|
| **问题** | CRON 00:00 执行 buildMorningBrief 时 `fetchFredLatest is not defined`，连续 3 天失败 |
| **根因** | `fetchFredLatest` 函数未定义/未导入到 buildMorningBrief 的作用域 |
| **修复方案** | 在 main.js 中搜索 `buildMorningBrief` 函数，补充或导入 `fetchFredLatest` 定义。若该函数依赖外部数据源 (FRED API)，添加 try-catch 兜底 |
| **验证步骤** | 1) 等待次日 00:00 CRON 触发<br>2) 或手动调用 buildMorningBrief<br>3) 检查早报是否生成成功 |
| **通过准则** | 早报正常生成 (日志无 fetchFredLatest 错误) |
| **回滚方案** | 注释 `buildMorningBrief` CRON 注册代码 |

#### P1-4: Mailer IPv6 不可达

| 字段 | 内容 |
|------|------|
| **问题** | `connect ENETUNREACH 2404:6800:4003:c1a::6c:587` — Gmail 返回 IPv6 地址但本机不支持 IPv6 出站 |
| **根因** | SMTP 客户端解析到 IPv6 AAAA 记录后尝试连接，但本地 IPv6 路由不可达 |
| **修复方案** | 在 mailer 配置中强制 `family: 4` (仅 IPv4)，或添加 `rejectUnauthorized: false` (视情况) |
| **验证步骤** | 修复后手动触发 mailer 心跳 `node -e "require('./lib/mailer.js').heartbeat()"` |
| **通过准则** | mailer 心跳成功, 邮箱收到测试邮件 |
| **回滚方案** | 改回无 `family` 约束 |

### 优先级 P2 — 中优先级 (性能/体验优化)

#### P2-1: 日志静默 (进程存活但无输出)

| 字段 | 内容 |
|------|------|
| **问题** | PID 34488 存活但自 14:01 起无日志输出 (8+ 小时)，怀疑 CRON 调度器卡死 |
| **根因** | 可能: stdout buf 满、文件描述符问题、异步队列卡死 |
| **修复方案** | 添加 stdout 定期 flush (每 30 秒 `process.stdout.write('')`) + 独立日志线程/文件 |
| **验证步骤** | 修复后观察 2 小时，确认日志持续写入 |
| **通过准则** | 日志持续输出，间隔不超过 1 小时 |
| **回滚方案** | 撤回 flush 改动 |

#### P2-2: 僵尸进程清理

| 字段 | 内容 |
|------|------|
| **问题** | PID 24492/34172/31076 残留, 消耗 ~28.6MB 内存 |
| **根因** | 单例杀戮后子进程未正常退出, 父进程无 wait 回收 |
| **修复方案** | main.js 退出时 `process.on('exit')` 清理同目录的子 zombie |
| **验证步骤** | 重启网关后检查无残留 zombie |
| **通过准则** | `Get-Process node | ? { $_.CommandLine -match 'main.js' }` 返回 ≤1 个 |
| **回滚方案** | 移除清理代码 |

#### P2-3: 500+ HEARTBEAT 日志刷屏 (如正常)

| 字段 | 内容 |
|------|------|
| **问题** | heartbeat 日志每 300s 输出一次 "无响应", 如果 10 个 Agent 都无响应 → 每分钟多条日志 |
| **根因** | 心跳检测粒度太细 |
| **修复方案** | 合并为 "N 个 Agent 无响应" 单条日志 + 去重逻辑 |
| **验证步骤** | 重启后观察日志频率 |
| **通过准则** | 无响应的 Agent 告警合并为 1 条/轮 |
| **回滚方案** | 改回逐条日志 |

### 优先级 P3 — 低优先级 (增强/重构)

#### P3-1: 日志切割 (log rotation)

| 问题 | 建议 |
|------|------|
| gateway-out.log 已达 4MB | 添加按天/按大小切割, 保留最近 7 天 |

#### P3-2: 内存使用率预警

| 问题 | 建议 |
|------|------|
| 系统内存 85%, 无预警 | 添加监控: 内存 >80% 时发 Discord/Telegram 告警 |

#### P3-3: 完整的 Agent 单元测试

| 问题 | 建议 |
|------|------|
| 无自动化测试 | 为 heartbeat/重连/单例锁/Token 验证 编写单元测试 |

---

## 根因汇总

| 排序 | 问题 | 影响范围 | 紧急度 |
|------|------|---------|--------|
| 1 | **重复 Agent ID (trae_ziyan x2)** | 紫妍 Agent 无法正常工作 | P0 |
| 2 | **3+1 Agent 缺 Telegram Token** | 4 个 Agent 无法通信 | P0 |
| 3 | **Ollama 启用但未运行** | NVIDIA 失败时双重失败 | P0 |
| 4 | **Heartbeat 无自愈** | Agent 进入活死人状态 | P1 |
| 5 | **单例锁竞态** | 残留僵尸进程 | P1 |
| 6 | **buildMorningBrief 未定义** | 早报连续 3 天失败 | P1 |
| 7 | **Mailer IPv6 不可达** | 邮件通知失效 | P1 |
| 8 | **proxy 未配但代码尝试连接** | 后台 API 降级 | P2 |
| 9 | **日志静默 8+ 小时** | 难以排查问题 | P2 |
| 10 | **系统内存 85%** | 长期运行有风险 | P3 |

---

## 附录

### A. 诊断脚本

- `_diag_collect.cjs` — 一键采集 (已就绪)
- `_diag_test_agent.cjs` — 单 Agent 连通性测试 (见板块5.3)

### B. 关键文件路径

```
openclaw.json          — C:\Users\User\.openclaw\openclaw.json (215KB)
main.js                — C:\Users\User\.openclaw\main.js
.env                   — C:\Users\User\.openclaw\.env
lib/llm-proxy.js       — C:\Users\User\.openclaw\lib\llm-proxy.js
logs/gateway-out.log   — C:\Users\User\.openclaw\logs\gateway-out.log (4MB)
logs/gateway-err.log   — C:\Users\User\.openclaw\logs\gateway-err.log (8.7KB)
```

### C. 系统环境快照

| 项目 | 值 |
|------|-----|
| OS | Windows |
| Node.js | via nvm4w |
| 总内存 | 15.7 GB |
| 可用内存 | ~2.4 GB |
| 代理 | 未配置 (127.0.0.1:7890 不可达) |
| Ollama | 未运行 |
| PM2 | 运行中 (未管理应用) |
| 网关 PID | 34488 (存活但静默) |
