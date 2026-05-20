# 银月钱庄 · 自动化系统部署文档

> 部署前确保：Node.js ≥18、npm ≥9、Git 已配置、GitHub 远程仓库已设置

---

## 1. 基础环境

```bash
node -v  # ≥18
npm -v   # ≥9
git config --global user.name "your name"
git config --global user.email "your@email.com"
```

## 2. CI/CD 流水线部署

### GitHub Actions（无需手动部署）
- `.github/workflows/test.yml` — PR & push 自动跑测试
- `.github/workflows/deploy-gateway.yml` — push main 触发，排除 landing/
- `.github/workflows/deploy-staging.yml` — push staging 触发
- `.github/workflows/deploy-landing.yml` — 已有 landing/ 部署

**配置事项：**
- 若需真正部署（非 echo 占位），在 Settings → Secrets → Actions 添加：
  - `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_KEY`（SSH 部署用）
  - `VERCEL_TOKEN`（Vercel 部署用）

## 3. 监控模块部署

### 资源监控（resource-monitor.js）
```bash
# 一次性运行
node scripts/resource-monitor.js --threshold-cpu=80 --threshold-mem=85 --threshold-disk=90

# 定时模式（每60秒）
node scripts/resource-monitor.js --interval=60000

# CRON 注册（main.js 自动加载）
# logs/resource-monitor.log 查看输出
```

### 健康仪表盘（health-dashboard.js）
```bash
node -e "require('./lib/health-dashboard').listen(19999)"
# 访问 http://localhost:19999
# 深色科技风UI，自动30秒刷新，含CPU/内存/磁盘/进程状态
```

### 性能指标（perf-metrics.js）
```javascript
const PerfMetrics = require('./lib/perf-metrics');
const pm = new PerfMetrics({ windowSize: 1000 });
pm.record('api.request', 45, true, { path: '/api/chat' });
console.log(pm.getStats());
// { total, successRate, avgDuration, p50, p90, p99, throughput1m }
```
数据持久化：`pm.save('./data/perf-snapshot.json')`

## 4. 日志系统部署

### 统一日志器（unified-logger.js）
```javascript
const log = require('./lib/unified-logger').getDefault();
log.info('服务启动', { pid: process.pid });
log.error('连接失败', { err: err.message });
```
自动轮转：超50MB → gzip 归档到 `logs/archived/`

### 审计摘要（audit-summary.js）
```bash
node scripts/audit-summary.js
# 输出: logs/audit/daily/YYYY-MM-DD.json

node scripts/audit-summary.js --console
# 同时打印到终端
```

### 日志查询（log-query.js）
```javascript
const LogQuery = require('./lib/log-query');
const lq = new LogQuery('./logs');
lq.query({ level: 'ERROR', since: '2026-05-20', limit: 50 });
lq.tail(20);
lq.stats({ since: '2026-05-01' }); // 按级别/模块汇总
```

## 5. 测试套件

```bash
npm test              # 全量测试
npm run test:coverage # 覆盖率报告
npm run ci:full       # test + lint + coverage

# 单独运行（新模块）
node tests/gateway-integration.test.js     # 网关集成测试
node tests/pipeline-flow.test.js           # 管线全链路测试
node tests/cron-engine.e2e.js              # CRON端到端测试
node tests/social-pipeline.e2e.js          # 社交媒体E2E测试
```

## 6. 网络要求

- 代理默认 `127.0.0.1:7890`（本地），GCP 生产自动停用
- 环境变量 `USE_PROXY=0` 强制禁用代理

## 7. 一键验证清单

```bash
# 1) 测试
npm test
# 2) 压力测试
node stress-test-runner.cjs
# 3) 监控试运行
node scripts/resource-monitor.js
# 4) 仪表盘（新窗口）
node -e "require('./lib/health-dashboard').listen(19999)"
# 5) 日志验证
node scripts/audit-summary.js --console
```
