# 银月钱庄 · 自动化系统使用手册

> 面向运维人员与开发者的操作指南

---

## 1. 日常运维操作

### 1.1 查看系统健康状态
```bash
# 浏览器打开仪表盘
node -e "require('./lib/health-dashboard').listen(19999)"
# → http://localhost:19999 （CPU/内存/磁盘/进程实时视图）

# 命令行快速查看资源
node scripts/resource-monitor.js
```

### 1.2 查看运行日志
```bash
# 最新20行
node -e "const LQ=require('./lib/log-query'); new LQ('./logs').tail(20).then(console.log)"

# 今日错误
node -e "const LQ=require('./lib/log-query'); new LQ('./logs').query({level:'ERROR',since:'2026-05-20'}).then(console.log)"

# 按模块过滤
node -e "const LQ=require('./lib/log-query'); new LQ('./logs').query({module:'gateway',limit:10}).then(console.log)"
```

### 1.3 生成审计报告
```bash
node scripts/audit-summary.js --console
# 输出: 执行次数 / 错误分布 / 告警统计 / 健康评分
# 每日自动存入 logs/audit/daily/
```

---

## 2. 测试执行

### 2.1 全量回归测试
```bash
npm test
```

### 2.2 专项测试
| 测试文件 | 覆盖范围 | 命令 |
|---------|---------|------|
| gateway-integration.test.js | 网关核心模块加载、CRON注册 | `node tests/gateway-integration.test.js` |
| pipeline-flow.test.js | 17个管线脚本完整性 | `node tests/pipeline-flow.test.js` |
| cron-engine.e2e.js | CRON任务注册与调度 | `node tests/cron-engine.e2e.js` |
| social-pipeline.e2e.js | 社交媒体管线完整性 | `node tests/social-pipeline.e2e.js` |

### 2.3 压力测试
```bash
node stress-test-runner.cjs
# 5场景：并发100× / 内存30 / 健康200× / 长稳50× / 并发健康50×3
# 断言10项全部PASS才算通过
```

---

## 3. CI/CD 操作

### 3.1 触发流水线
| 动作 | 触发的工作流 | 说明 |
|------|------------|------|
| push main | test.yml + deploy-gateway.yml | 自动测试+部署网关 |
| push staging | test.yml + deploy-staging.yml | 预发布环境 |
| push feature/* | test.yml | 仅测试 |
| PR to main | test.yml | PR门禁检查 |

### 3.2 查看 CI 状态
```bash
# GitHub CLI
gh run list --repo youeshopent-debug/silvermoon-openclaw

# 或浏览器打开
# https://github.com/youeshopent-debug/silvermoon-openclaw/actions
```

---

## 4. 故障处理

### 4.1 资源告警阈值
| 指标 | 警告线 | 严重线 | 自愈动作 |
|------|--------|--------|---------|
| CPU | >70% | >80% | 记录到日志 |
| 内存 | >80% | >85% | 记录到日志 |
| 磁盘 | >85% | >90% | 记录到日志 |
| 进程挂起 | — | 进程消失 | 看门狗自动重启 |

### 4.2 常见故障
```bash
# 网关无响应
netstat -ano | findstr :18791   # 检查端口
tasklist | findstr node         # 检查进程

# 日志不写入
dir logs\                       # 确认目录存在
node -e "console.log(require('fs').existsSync('logs'))"

# 代理不可达
node -e "process.env.USE_PROXY='0'"  # 强制直连
```

### 4.3 自愈体系
- **进程级**：`silvermoon-watchdog.cjs` 60秒检测，进程消失自动拉起
- **Agent级**：`openclaw-switch.js` 断路器，失败率超阈值熔断
- **配置级**：`self-heal.js` 配置一致性自动修复

---

## 5. 架构要点

```
CI/CD层         → GitHub Actions（3个工作流）
├─ 测试套件     → 40+ 测试文件（单元/集成/E2E/压力）
├─ 监控模块     → resource-monitor / health-dashboard / perf-metrics
├─ 日志体系     → unified-logger / audit-summary / log-query
└─ 自愈层       → watchdog / 断路器 / 配置修复
```

各层独立部署，互不阻塞。错误从日志层捕获，经审计层汇总，触发告警层通知。

---

## 6. 开发扩展指南

### 新增 CRON 任务
```javascript
// 1. 创建脚本 scripts/my-task.js
// 2. 在 main.js 注册：
cron.register('my-task', '*/30 * * * *', () => require('./scripts/my-task').run());
// 3. 写测试 tests/my-task.test.js
```

### 新增监控指标
```javascript
// 在 resource-monitor.js 的 collectMetrics() 中添加
const myMetric = collectMyMetric();
metrics.custom.myMetric = myMetric;
```

### 新项目接入日志
```javascript
const log = require('./lib/unified-logger').getDefault();
// 自动使用当前文件名作为 module 名
```
