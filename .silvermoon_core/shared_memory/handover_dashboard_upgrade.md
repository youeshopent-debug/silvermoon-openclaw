# 交接清单 · Dashboard 全面升级

## 已完成
1. **dashboard/index.html** — 全新运营看板 SPA
   - 美杜莎设计 Token（深色 Glassmorphism、品牌色 #00D4FF）
   - 5 View 切换：总览/Agent 管理/管道监控/系统日志/用量分析
   - 16 位 Agent 网格卡片 + 完整表格
   - 实时心跳时间线 + 日志筛选搜索
   - Chart.js 横向柱状图（Token/LLM 调用）
   - Agent 详情 Modal
   - 5 秒轮询刷新

2. **lib/control-center.js** — `_serveDashboard()` 改为文件读取 `dashboard/index.html`

3. **start_dashboard.cjs** — 更新 16 位 Agent 角色名，注入 7 人在线演示数据

4. **landing/design-system/DASHBOARD_BRIEF.md** — 美杜莎设计 Brief（5 Frame 需求）

## 运行状态
- ControlCenter 运行在 `http://127.0.0.1:4310/`
- 7 人演示数据在线（银月/李长寿/药老/韩立/萧炎/雅妃/墨影）
- 其他 Agent 离线（需 main.js 启动后自动推送数据）
- 管道页为占位状态，需 main.js 启动后获取 CRON 数据

## 待办
- [ ] 等美杜莎出正式设计稿后逐像素还原
- [ ] 银月网关 main.js 是否启动（待主人决定）
- [ ] 接入 WebSocket 实时推送（当前是 5 秒 HTTP 轮询）

## 17 位 Agent 完整清单（含最新 CC_曹操）
OC 直辖: 银月/韩立/雅妃/墨影/许青/紫灵/紫妍/紫研
TR 出身: 李长寿/药老/萧炎/美杜莎/寻宝鼠/小医仙/海波东/蓝灵儿
CC 外援: 曹操
