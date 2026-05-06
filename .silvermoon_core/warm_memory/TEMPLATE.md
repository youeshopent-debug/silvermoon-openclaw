# 暖记忆模板（Warm Memory）

## 每日总结格式（Daily Wrap-up）
文件名：`YYYY-MM-DD.md`

```yaml
---
date: 2026-05-04
type: daily-wrapup
source: ^ agents/main/sessions/*.jsonl
---
```

### Decisions（决策）
- [决策1]：[原因] → [结论]

### Action Items（待办事项）
- [ ] [事项]（负责人，优先级）

### Key Dialogues（关键对话）
- [主题]：[摘要]

### 技术笔记/问题排除
- [问题] → [原因] → [解决方案]

### 未完成/明天任务
- [任务]

---

## 微同步格式（Microsync）
文件名：`YYYY-MM-DD_HH-mm.json`

```json
{
  "at": "2026-05-04T10:00:00.000Z",
  "type": "microsync",
  "range": ["2026-05-04T07:00:00Z", "2026-05-04T10:00:00Z"],
  "entries": [
    {
      "reason": "触发原因/场景",
      "discovery": "发现了什么",
      "conclusion": "最终结论/决策"
    }
  ]
}
```
