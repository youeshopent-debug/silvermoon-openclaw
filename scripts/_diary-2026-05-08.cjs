const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const today = '2026-05-08';
const now = new Date();
const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });

const DROPBOX_DIR = path.join(require('os').homedir(), 'Dropbox');
const DIARY_DIR = path.join(DROPBOX_DIR, '银月钱庄_日记');
if (!fs.existsSync(DIARY_DIR)) fs.mkdirSync(DIARY_DIR, { recursive: true });

const FILE_NAME = `${today}_银月钱庄工作日记.pdf`;
const FILE_PATH = path.join(DIARY_DIR, FILE_NAME);

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 50, right: 50 },
  info: {
    Title: `银月钱庄工作日记 ${today}`,
    Author: '李长寿',
    Subject: '自动化管道流水线 · 全栈架构实装',
  }
});

const w = fs.createWriteStream(FILE_PATH);
doc.pipe(w);

// ── Helper: section title ──
function section(text) {
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1a1a2e');
  doc.text(text, { underline: true });
  doc.moveDown(0.3);
}

// ── Helper: body text ──
function body(text, opts = {}) {
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  doc.text(text, { lineGap: 4, ...opts });
}

// ── Helper: bullet ──
function bullet(text) {
  doc.font('Helvetica').fontSize(10).fillColor('#333');
  doc.text(`• ${text}`, { indent: 15, lineGap: 4 });
}

// ═════════════════════  HEADER  ═════════════════════
doc.font('Helvetica-Bold').fontSize(22).fillColor('#0a0a0a');
doc.text('银月钱庄 · 工作日记', { align: 'center' });
doc.moveDown(0.2);
doc.font('Helvetica').fontSize(11).fillColor('#666');
doc.text(`${today}  |  生成时间: ${timeStr}  |  作者: 李长寿`, { align: 'center' });
doc.moveDown(0.5);

// separator line
doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
doc.moveDown(0.8);

// ═════════════════════  BODY  ═════════════════════
section('一、今日核心目标');
body('将银月钱庄 5 大业务模块（电商增长/内容创作/合规审计/渲染输出/夜报汇总）整合为一套永久自动化的 CRON 流水线，确保每日无需人工干预即可全链路跑通。');

section('二、天机子架构推演（Phase 0）');
bullet('用户创建「天机子」角色——银月钱庄首席架构师，专属 Trae 侧（非 OpenClaw）');
bullet('天机子职责：架构决策、流水线设计、拓扑分析、提 GitHub Issue 指路，不写代码');
bullet('存储位置：.silvermoon_core/lcs_memory/architecture/天机子-架构军师.md');
bullet('核心铁律：每会话先查 Memory 不问主人；装傻时自训「你是架构师不是白痴」');
bullet('GitHub 权限仅 create_issue，无 Push/Merge 权限');

section('三、双系统架构厘清（Agent 归属修正）');
bullet('确认用户铁则：Trae = 总司令部（李长寿 + 天机子 + 寻宝鼠 + 蓝灵儿）');
bullet('OpenClaw = 执行层（15 Agent，含银月/药老/萧炎/海波东/小医仙/紫妍等）');
bullet('Shopify 归 OpenClaw 管理（药老 + 电商运营官），非 Trae');
bullet('更新 必看_双系统Agent清单.md v4，写入 4 条持久化 Core Memory');

section('四、CRON 调度系统整合（Phase 1）');
bullet('发现 3 套并行调度系统：scheduleDailyAt (main.js)、lib/cron.js、lib/scheduler.js');
bullet('删除 scheduleDailyAt 重复注册（银月_早报曾跑 3 次/天）');
bullet('保留 lib/cron.js（管道/记忆任务）和 lib/scheduler.js（交易/定时任务）');

section('五、新流水线脚本开发（Phase 2）');
bullet('pipeline-shared.js — 共享工具库（路径常量/阶段 I/O/dispatch 队列/报告查找）');
bullet('haibodong-compliance-check.js — 合规审计脚本');
body('  → 规则：禁止类关键词 / 高风险类目 / 商标保护');
body('  → 安全上下文豁免：gambling+research、token+SSE/LLM、hack+CVE');
bullet('ziyan-render-pipeline.js — 紫妍渲染参数生成脚本');
body('  → 解析分镜边界（Scene / 【 / 编号:），提取场景时长');
body('  → 智能匹配特效：zoom_in / product_highlight / cta_overlay / digital_human');

section('六、CRON 注册与启动（Phase 3）');
bullet('08:30  药老 → AI趋势报告    (lib/cron.js 独立调度)');
bullet('08:45  海波东 → 合规审计     (main.js CRON 注册)');
bullet('10:00  小医仙 → 脚本生成     (main.js CRON 注册)');
bullet('14:00  紫妍 → 渲染输出       (main.js CRON 注册)');
bullet('23:55  银月 → 夜报汇总      (lib/scheduler.js 注册)');
bullet('异常熔断：try-catch → email 通知 → 连续 3 次失败自动暂停');

section('七、全链路实跑验证（Phase 4 — 今日最重要环节）');
bullet('海波东合规审计 live run → 发现 3 条误报（gambling=剑桥研究/token=LLM SSE/hack=安全CVE）');
bullet('修复：runCheck() 改为逐行匹配 + SAFE_CONTEXT_EXCEPTIONS 映射');
bullet('修复后实跑结果：status=pass, 5 info 级豁免, 0 critical ✅');
bullet('小医仙脚本生成 → 603 字英文 TikTok 脚本，6 场景网络安全主题');
bullet('紫妍渲染参数输出 → 6 场景 × 15 秒 = 90 秒，闪剪就绪');
bullet('dispatch 中转站：海波东→小医仙(consumed) → 紫妍→银月(pending)');

section('八、main.js 守护进程部署');
bullet('清理重复进程：PID 8848（旧 main.js）+ PID 14460（孤儿进程）已 kill');
bullet('新 main.js 以背景进程启动，PID 8400（父）→ PID 46320（子），稳定运行 20+ 秒');
bullet('明日（2026-05-09）管线将全自动触发，无需任何人工介入');

section('九、遗留事项与风险提示');
bullet('P0 — main.js 若异常退出，管道会停摆。需监控进程健康状态');
bullet('P1 — dispatch-consumer.js 依赖 main.js，目前仅 polling 未做持久化守护');
bullet('P2 — 海波东规则库目前硬编码在脚本中，后续应抽离为 YAML 配置文件');

// ── Footer ──
doc.moveDown(1);
doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
doc.moveDown(0.5);
doc.font('Helvetica-Oblique').fontSize(9).fillColor('#999');
doc.text('银月钱庄 · 李长寿 · 自动化管道流水线', { align: 'center' });
doc.text('本文档自动生成，未经审计不可作为生产环境凭据', { align: 'center' });

doc.end();

w.on('finish', () => {
  const stats = fs.statSync(FILE_PATH);
  console.log(`✅ PDF 已生成: ${FILE_PATH}`);
  console.log(`   文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
});
