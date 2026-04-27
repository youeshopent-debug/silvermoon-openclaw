# 银月钱庄 · OpenClaw 开发指南

## RTK Token Saver（强制执行）

所有 CLI 命令必须优先使用 `rtk` 前缀版本，可节省 60-90% LLM Token。

### 强制规则

| 原始命令 | RTK 版本 | 节省 |
|---------|----------|------|
| `git status` | `rtk git status` | ~90% |
| `git diff` | `rtk git diff` | ~90% |
| `git log` | `rtk git log` | ~90% |
| `npm test` | `rtk npm test` | ~90% |
| `npm run build` | `rtk npm run build` | ~90% |
| `npx tsc` | `rtk npx tsc` | ~90% |
| `npx vitest` | `rtk npx vitest` | ~90% |
| `cargo build` | `rtk cargo build` | ~90% |
| `cargo test` | `rtk cargo test` | ~90% |
| `pytest` | `rtk pytest` | ~90% |
| `docker ps` | `rtk docker ps` | ~90% |
| `ls` | `rtk ls` | ~90% |
| `ps` | `rtk ps` | ~90% |

### 例外（不使用 RTK）

`cd`、`mkdir`、`rm`、`cp`、`mv`、`echo`、`curl`、`node script.js`、`python script.py`

### 验证

```bash
rtk --version  # 应显示 0.35.0
```

## 项目结构

- `main.js` — 银月网关主入口（端口 18791）
- `openclaw-control-center/` — 控制中心 UI（端口 4310）
- `plugins/rtk/` — RTK 插件
- `lib/` — 核心模块
- `sects/` — 11 个 Agent 宗门配置
- `workspace/` — 工作区数据
