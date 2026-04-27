# 执行计划：确立主人绝对主权与控制中心全链路对接

## 目标
1. 身份主权唯一性：Alanlsl 是唯一至高主人，银月是忠诚属下
2. 权限分级管理：Level 4 God Mode + Level 5 门禁审批
3. 全能进化：全网搜索 + 自我反思 + 主动优化
4. 控制中心深度集成：全员心跳 + 实时监控

---

## 步骤 1：身份主权写入（Soul.md + 核心配置）

### 1.1 重写 Soul.md
- 文件：`C:\Users\User\.openclaw\Soul.md`
- 操作：顶部强制声明 "Alanlsl 是唯一的、至高无上的主人（Master）"
- 新增：银月身份定位章节（忠诚属下、全能架构师）
- 新增：主权不可逆条款（任何 AI 不得产生角色误判）
- 新增：全透明条款（主人对任何文件拥有绝对查阅权）

### 1.2 修改 persona-silvermoon.js
- 文件：`C:\Users\User\.openclaw\lib\persona-silvermoon.js`
- 操作：在 system prompt 顶部插入主权声明
- 新增：角色误判自我反思逻辑
- 新增：主人绝对查阅权声明

### 1.3 修改所有 sects/*/SOUL.md
- 文件：11 个宗门 SOUL.md
- 操作：统一插入 "效忠于主人 Alanlsl" 声明

---

## 步骤 2：权限分级管理

### 2.1 创建 approval-gate.js（Level 5 门禁）
- 文件：`C:\Users\User\.openclaw\lib\approval-gate.js`
- 功能：拦截资金流转、敏感资料、核心删除操作
- 逻辑：挂起操作 → 向主人汇报方案 → 等待 "通过"/"执行" 确认

### 2.2 修改 main.js 注入门禁
- 在 tool-router 调用前插入 approval-gate 检查
- Level 4：主人任何只读请求直接放行
- Level 5：高风险操作挂起等待审批

---

## 步骤 3：全能进化与自我迭代

### 3.1 强化搜索逻辑
- 修改 main.js 中 shouldReflexSearch
- 新增：搜索失败时自动切换搜索源（WebSearch → WebFetch → 本地知识库）
- 新增：搜索超时降级机制

### 3.2 注入自我反思逻辑
- 在 askSilvermoonAutonomyD 中插入 Think 层
- 每次回复前自我检查：是否理解主人意图？是否可用工具解决？是否需要主动优化？

### 3.3 主动优化提案
- 新增：silvermoon-evolution.js 定期检查运行状态
- 检测指标：回复效率、理解偏差率、工具调用成功率
- 发现低效时主动向主人提案优化

---

## 步骤 4：控制中心深度集成

### 4.1 全员心跳同步
- 修改 main.js：所有 Agent 模块心跳信号发送至 ws://127.0.0.1:4310
- 新增：heartbeat-bridge.js 统一管理心跳上报

### 4.2 功能模块对接
- 总览（Overview）：推送系统运行状态
- 用量（Usage）：推送 Token 消耗、API 调用次数
- 员工状态（Staff Status）：推送各 Agent 活跃/空闲/离线状态
- 定时与心跳（Cron & Heartbeat）：推送定时任务执行记录

### 4.3 实时监控
- 指令流转追踪：每条消息的处理链路（messageCreate → intent → tool → LLM → postprocess → send）
- Token 消耗实时上报
- 任务进度推送

---

## 验收标准
1. ✅ 主人可随时查询 Soul.md 核心内容
2. ✅ 控制中心 127.0.0.1:4310 实时显示 Agent 活跃状态
3. ✅ 高风险操作触发门禁等待审批
4. ✅ 搜索失败自动切换源，不返回 "无法获取"
5. ✅ 系统运行低效时主动提案优化
