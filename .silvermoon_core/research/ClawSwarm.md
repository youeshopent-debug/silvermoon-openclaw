# ClawSwarm 研究笔记

> 来源：https://github.com/The-Swarm-Corporation/ClawSwarm
> 存档日期：2026-04-29
> 状态：待评估（当前 OpenClaw 架构够用，暂不迁移）

## 概述
OpenClaw 的轻量版 Python 替代品，基于 Swarms 框架。
原生多 Agent 编排，可编译到 Rust，统一 gRPC 网关接入 TG/DC/WhatsApp。

## 技术栈
- Python 3.10+
- gRPC 网关
- Swarms 框架（Agent 编排）
- Claude 作为推理工具（可选）
- Docker 部署

## 架构
```
TG / DC / WhatsApp → gRPC Gateway → Swarms Agent → Replier → 各平台
```

## 对银月钱庄的价值
- 原生多 Agent 编排（比 OpenClaw 的 33 宗门更轻量）
- 统一 gRPC API，加新平台不改 Agent 逻辑
- 可编译到 Rust，性能更好
- 和 OpenClaw 同源，架构理念一致

## 迁移成本
- Python 技术栈 vs 现有 Node.js 技术栈
- 需要重写所有 Agent 逻辑
- 依赖 Claude（付费）vs 现有 OpenRouter 免费模型
- 运维成本翻倍

## 后续行动
- [ ] 等 OpenClaw 架构遇到瓶颈时再评估
- [ ] 可借鉴 gRPC 网关设计思路到现有架构
