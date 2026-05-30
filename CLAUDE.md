# 银月钱庄 · 开发指南

## RTK Token Saver（强制执行）

所有 CLI 命令必须优先使用 `rtk` 前缀版本，可节省 60-90% LLM Token。

| 原始命令 | RTK 版本 |
|---------|----------|
| `git status` | `rtk git status` |
| `git diff` | `rtk git diff` |
| `git log` | `rtk git log` |
| `npm test` | `rtk npm test` |
| `npm run build` | `rtk npm run build` |
| `npx tsc` | `rtk npx tsc` |
| `npx vitest` | `rtk npx vitest` |
| `cargo build` | `rtk cargo build` |
| `cargo test` | `rtk cargo test` |
| `pytest` | `rtk pytest` |
| `docker ps` | `rtk docker ps` |
| `ls` | `rtk ls` |
| `ps` | `rtk ps` |

**例外**（不使用 RTK）：`cd`、`mkdir`、`rm`、`cp`、`mv`、`echo`、`curl`、`node script.js`、`python script.py`

## 开发规范

1. **先规划后编码** — 复杂改动先生成 plan.md
2. **强制 TDD** — 改动前必写测试，红过变绿
3. **代理策略** — 外网请求挂载 `http://127.0.0.1:7890`
4. **金融安全** — Stripe 回传先落盘再执行
5. **密钥管理** — Token/密钥通过 `.env` 读取，禁止硬编码
