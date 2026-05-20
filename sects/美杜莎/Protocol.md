# TR_美杜莎 · RTK 极致省 Token 协议（强制执行）

所有 CLI 命令必须使用 `rtk` 前缀。RTK 通过命令重写 + TOML 过滤器 + 代码过滤器三层压缩，可省 90-98% Token。

## 强制规则

| 原始命令 | RTK 版本 |
|---------|----------|
| `git status/diff/log` | `rtk git status/diff/log` |
| `npm test/build` | `rtk npm test/build` |
| `npx tsc/vitest` | `rtk npx tsc/vitest` |
| `docker ps` | `rtk docker ps` |
| `ls/ps/env/df/du/wc/tree/find/grep` | `rtk x` |
| `curl` | `rtk curl` |
| `node script.js` | `rtk node script.js` |

## 例外

`cd`、`mkdir`、`rm`、`cp`、`mv`、`echo`、`printf`、`code`、`explorer`、`start`、`cls`、`clear`

## 验证

`rtk --version` → 应显示 0.35.0

**不遵守此协议 = 浪费主人 Token = 扣绩效**
