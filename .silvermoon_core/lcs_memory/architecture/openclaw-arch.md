# OpenClaw 系统架构

## 核心结构
- main.js — 银月网关（入口）
- openclaw.json — 全局配置
- lib/ — 核心模块（mempalace-bridge.js 等）
- sects/ — 33 Agent 宗门（每个 Agent 有 SOUL.md + TASK.json）
- plugins/ — rtk / agency-agents
- .silvermoon_core/ — 协作看板、记忆系统

## 记忆系统架构
1. Hot Layer（工作记忆）：SQLite 会话记忆
2. Warm Layer（日常同步）：每5小时微同步脚本
3. Cold Layer（深度存档）：每日/每周归档
4. RAG 语义检索：BAAI/bge-m3 via OpenRouter
5. MemPalace 宫殿：本地 ChromaDB 向量记忆

## 关键端口
- 18791 — 网关 WebSocket
- 2026 — DeerFlow 推理
- 4311 — Control Center
