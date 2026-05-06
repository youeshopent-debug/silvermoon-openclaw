# 关键架构决策记录

## SaaS 转本地推理
- 原因：避免被云端割韭菜，成本控制
- 方案：Ollama + DeepSeek 本地推理为主
- 时间：2026-04

## 代理优先（非 Docker）
- n8n 包太重装不上，改用纯 Node.js 实现
- Crawlee 代替 n8n 做网页爬取
- 药老电商管线用 Crawlee 爬选品数据

## Stripe Webhook 隐私闭环
- 原始 webhook 不落云盘
- 云端内存持有 + Tailscale 内网转发本机
- 本机确认后才回 2xx

## 三层记忆系统
- Hot/Warm/Cold 分层
- RAG 语义检索 + MemPalace 宫殿双轨
