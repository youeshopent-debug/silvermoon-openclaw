# OpenClaw 全流程自动化架构蓝图

> 版本: v1.0 | 银月钱庄 · 自动化系统设计

---

## 一、自动化全景（As-Is → To-Be）

### 现有节点（As-Is）

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenClaw 自动化现状                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  CI/CD   │   测试   │   监控   │   日志   │  自愈    │  告警    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│test.yml  │40测试文件│watchdog  │log-rotate│self-heal │alert.js  │
│deploy-   │(分散)    │task-patrol│exec-audit│断路器    │mailer.js │
│landing   │          │task-watch│          │降级开关  │TG桥接    │
│.yml      │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 目标节点（To-Be）

```
┌──────────────────────────────────────────────────────────────────────┐
│                    OpenClaw 全流程自动化（本方案目标）                       │
├───────────┬───────────┬───────────┬───────────┬───────────┬──────────┤
│   部署    │   测试    │   监控    │   日志    │   自愈    │   告警   │
│  CI/CD   │   套件    │   运维    │   审计    │   恢复    │   通知   │
├───────────┼───────────┼───────────┼───────────┼───────────┼──────────┤
│✅test.yml │✅单元测试  │✅watchdog  │✅log-rotate│✅self-heal│✅alert.js│
│✅deploy-  │✅集成测试  │✅resource  │✅exec-    │✅断路器    │✅mailer  │
│  landing  │(新增)     │  monitor  │  audit    │✅降级开关  │✅TG桥接   │
│✅deploy-  │✅E2E测试  │✅perf      │✅统一日志  │✅自愈管道  │✅Discord │
│  gateway  │(新增)     │  metrics  │  管道     │  扩展     │  告警    │
│(新增)     │✅coverage  │✅health    │✅审计     │          │          │
│✅staging  │  报告     │  dashboard│  追溯     │          │          │
│  CD       │(新增)     │(新增)     │(新增)     │          │          │
└───────────┴───────────┴───────────┴───────────┴───────────┴──────────┘
```

---

## 二、CI/CD 流水线设计（Phase 2）

### 工作流拓扑

```
Git Push
  │
  ├── main 分支
  │     ├── test.yml        → npm ci → npm test → npm run lint
  │     ├── deploy-gateway  → 构建 → 部署网关到生产
  │     └── deploy-landing  → Vercel 部署 Landing 页
  │
  ├── staging 分支
  │     └── deploy-staging  → 构建 → 部署到测试环境
  │
  └── feature/* 分支
        └── test.yml        → npm ci → npm test
```

### 新增工作流

| 工作流 | 文件 | 触发 | 动作 |
|--------|------|------|------|
| 网关部署 | `deploy-gateway.yml` | push main | 构建 + 部署网关到生产 |
| 预发布部署 | `deploy-staging.yml` | push staging | 构建 + 部署到测试环境 |

---

## 三、自动化测试套件设计（Phase 3）

### 测试金字塔

```
         ╱╲
        ╱ E2E ╲          ← 新增：social-pipeline.e2e.js
       ╱────────╲          新增：cron-engine.e2e.js
      ╱  集成测试  ╲      ← 新增：gateway-integration.test.js
     ╱──────────────╲      新增：pipeline-flow.test.js
    ╱   单元测试      ╲   ← 已有40个 + 新增补充
   ╱────────────────────╲
```

### 测试覆盖范围

| 层级 | 文件 | 覆盖内容 |
|------|------|----------|
| 单元测试 | `tests/*.test.js` | 各模块独立逻辑（已有40个） |
| 集成测试 | `tests/gateway-integration.test.js` | 模块间交互、CRON调度、工具链 |
| 集成测试 | `tests/pipeline-flow.test.js` | 管线全链路：trend→generate→post |
| E2E测试 | `tests/social-pipeline.e2e.js` | 社交媒体管线端到端 |
| E2E测试 | `tests/cron-engine.e2e.js` | CRON引擎调度端到端 |

---

## 四、自动化运维监控设计（Phase 4）

### 监控架构

```
┌──────────────────────────────────────────────────┐
│                 监控数据采集层                        │
├──────────────────────────────────────────────────┤
│ resource-monitor.js ← CPU/内存/磁盘/进程健康度       │
│ health-dashboard.html ← 可视化仪表盘               │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│                 告警触发层                          │
├──────────────────────────────────────────────────┤
│ CPU > 80% → alert.js → TG通知                     │
│ 内存 > 85% → alert.js → TG通知                     │
│ 磁盘 > 90% → alert.js → TG通知                     │
│ 进程宕机 → watchdog → 自动重启                      │
└──────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────┐
│                 自愈执行层                          │
├──────────────────────────────────────────────────┤
│ self-heal.js → 根因分类 → 6种修复策略               │
│ openclaw-switch.js → 断路器 → 隔离降级              │
└──────────────────────────────────────────────────┘
```

### 新增模块

| 模块 | 路径 | 功能 |
|------|------|------|
| 资源监控 | `scripts/resource-monitor.js` | CRON调度，采集CPU/内存/磁盘/进程状态 |
| 健康仪表盘 | `lib/health-dashboard.js` | HTTP端点 `GET /health` → HTML仪表盘 |
| 性能指标 | `lib/perf-metrics.js` | 记录请求延迟、错误率、吞吐量 |

---

## 五、日志留存与审计设计（Phase 5）

### 统一日志管道

```
日志源 → 统一日志管道 (lib/unified-logger.js) → 日志文件 + 审计追踪
  ├── main.js gateway.log
  ├── CRON管线 → workspace/CRON/*.log
  ├── 执行审计 → exec-audit.log
  ├── 任务巡检 → task_patrol.log
  └── 资源配置 → logs/resource-monitor.log
```

### 新增模块

| 模块 | 路径 | 功能 |
|------|------|------|
| 统一日志器 | `lib/unified-logger.js` | 标准化日志格式+级别+写入（替代inline日志） |
| 审计摘要 | `scripts/audit-summary.js` | 每日审计摘要 → TG推送 |
| 日志查询 | `lib/log-query.js` | 按时间/级别/模块检索日志 |

---

## 六、实施路线图

| 阶段 | 内容 | 产出物 | 预估文件数 |
|------|------|--------|-----------|
| Phase 2 | CI/CD流水线 | deploy-gateway.yml + deploy-staging.yml | 2 |
| Phase 3 | 测试套件 | 4个测试文件 | 4 |
| Phase 4 | 运维监控 | 2个模块 + 1个脚本 + 1个仪表盘 | 4 |
| Phase 5 | 日志审计 | 3个模块 + 1个CRON | 4 |
| Phase 6 | 压力测试 | stress-test + 验证结果 | 1 |
| Phase 7 | GitHub推送 | 新仓库 + README | 1 |
| Phase 8 | 文档手册 | DEPLOY.md + MANUAL.md | 2 |

---

## 七、依赖与对接逻辑

```
Phase 2 (CI/CD) ──────────► Phase 7 (GitHub) ──► 代码托管完成
       │
       ▼
Phase 3 (测试) ──────────► Phase 6 (压力测试) ──► 稳定性验证
       │
       ▼
Phase 4 (监控) ──────────► Phase 6 (压力测试) ──► 监控验证
       │
       ▼
Phase 5 (日志) ──────────► Phase 6 (压力测试) ──► 日志验证
                                    │
                                    ▼
                              Phase 8 (文档) ──► 交付完成
```
