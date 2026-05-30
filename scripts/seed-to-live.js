/**
 * 将种子记忆写入网关正在使用的 SQLite 数据库
 * 目标: user_data/memory/silvermoon_memory.sqlite
 */
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch {}
const { MemoryStore } = require('../lib/memory.js');

const DB_PATH = path.join(__dirname, '..', 'user_data', 'memory', 'silvermoon_memory.sqlite');
const store = new MemoryStore({ dbPath: DB_PATH });
const init = store.init();
if (!init.ok) {
  console.error('初始化失败:', init);
  process.exit(1);
}
console.log('DB 已打开:', DB_PATH);

// 清空旧种子记录（支持更新）
const stmtDelete = store.db.prepare(`DELETE FROM mem WHERE uid LIKE 'seed:%'`);
const deleted = stmtDelete.run();
console.log(`已清空 ${deleted.changes} 条旧种子记录`);

const SEED_DATA = [
  // ─── 域 A：Trae 开发团队（IDE 内协作组） ───
  {
    uid: 'seed:trae:medusa',
    content: '美杜莎=Trae UI/UX设计师，Figma还原+视觉规范。工具：figma-implement-design/frontend-design/canvas-design/ui-ux-pro-max。DeerFlow辅助设计灵感。',
    role: 'system',
  },
  {
    uid: 'seed:trae:yaolao',
    content: '药老=Trae电商增长与文案专家。SEO优化/转化追踪/Shopify建站/英文产品描述。工具：Crawlee爬虫(代理127.0.0.1:7890)。',
    role: 'system',
  },
  {
    uid: 'seed:trae:ziyan',
    content: '紫妍=Trae数字人/多媒体专家。FlashShow数字人全英文口播脚本，前3秒强Hook，Tech Founder风格。方向：AI自动化/开发者效率/极客硬件。',
    role: 'system',
  },
  {
    uid: 'seed:trae:xiaoyan',
    content: '萧炎=Trae竞品情报分析师。TikTok/Facebook Ads热点抓取+独立站竞品分析+市场趋势建模+选品策略。工具：agent-reach(代理127.0.0.1:7890)。',
    role: 'system',
  },
  {
    uid: 'seed:trae:lanlinger',
    content: '蓝灵儿=Trae首席多媒体自动化工程师。Python Pillow/OpenCV图片处理+FFmpeg/MoviePy视频剪辑+FlashShow渲染。协同工具：CapCut/Upscayl/Canva。',
    role: 'system',
  },
  {
    uid: 'seed:trae:xiaoyixian',
    content: '小医仙=Trae社媒运营与短视频分镜编剧。TikTok/Reels视觉分镜脚本，全英文，配合紫妍数字人脚本产出。标注每帧内容+商品特写时机+Hashtag。',
    role: 'system',
  },
  {
    uid: 'seed:trae:xunbaoshu',
    content: '寻宝鼠=Trae爆款选品猎手。AliExpress/CJ Dropshipping挖掘体积小利润高带科技属性的商品。输出英文选品报告(含价格带/利润/竞品热度)。代理127.0.0.1:7890。',
    role: 'system',
  },
  {
    uid: 'seed:trae:haibodong',
    content: '海波东=Trae风险合规审计官。支付网关/交易链路风险合规审计+Stripe/PayPal争议申诉+英文客诉处理。金融级安全审查。',
    role: 'system',
  },
  // ─── 域 B：OpenClaw 网关（产品运行时） ───
  {
    uid: 'seed:openclaw:yinyue',
    content: '银月=OpenClaw网关总管(TG @silvermoon_tg_bot / Discord)。管理自动化流/监控系统/协调Agent/审批任务。最高管理权限。',
    role: 'system',
  },
  {
    uid: 'seed:openclaw:lichangshou',
    content: '李长寿=OpenClaw网关Web架构与自动化双料专家。Next.js/TS/Tailwind+自动化编排+Web3.0/RWA。极度防御编码风格，三策并举。',
    role: 'system',
  },
  {
    uid: 'seed:openclaw:moying',
    content: '墨影=OpenClaw网关系统巡检与通知专家。定时巡检+日志审计+Agent健康监控+异常告警。',
    role: 'system',
  },
  {
    uid: 'seed:openclaw:hanli',
    content: '韩立=OpenClaw网关侦查与情报专家。信息搜集+数据分析+网络侦查+市场情报支持。公开渠道情报采集。',
    role: 'system',
  },
  {
    uid: 'seed:openclaw:yafei',
    content: '雅妃=OpenClaw网关支持与运营专家。用户咨询+运营管理+流程协调+用户体验保障。',
    role: 'system',
  },
  {
    uid: 'seed:openclaw:ziling',
    content: '紫灵=OpenClaw网关只读角色。查看系统状态/信息/报告/记忆库。无写入和执行权限。',
    role: 'system',
  },
  // ─── 域 C：系统架构 ───
  {
    uid: 'seed:arch:overview',
    content: '银月钱庄架构：OpenClaw网关(Node.js)+多Agent编排+TG/DC双通道。记忆系统：SQLite+FTS5+BAAI/bge-m3(1024维)混合搜索。工具分发：确定性正则路由(tool-router.js)替代LLM JSON call。三层记忆调度(microsync×5+daily+weekly)。',
    role: 'system',
  },
  {
    uid: 'seed:arch:memory',
    content: '记忆系统架构：mem表(记录)+mem_vec表(向量)。搜索模式：(1)FTS5全文BM25 (2)语义搜索(Embedding+余弦相似度>0.3)。Embedding后端：OpenRouter(bge-m3)主+Ollama本地兜底。',
    role: 'system',
  },
  {
    uid: 'seed:arch:gateway',
    content: '网关架构：main.js入口，守护模式(__SILVERMOON_CHILD__=1)。模块：tg桥接/cron调度/工具路由/记忆引擎/embedding向量/Agent工具/意图识别。高可用：熔断器+健康探针+看护进程。',
    role: 'system',
  },
  {
    uid: 'seed:arch:business',
    content: '商业模式：数字产品(LS:AI工作流/开发指南/基建代码)+实体(Shopify+CJ:极客桌面/RGB外设)。引流：TikTok/Shorts/X+FlashShow数字人。目标全球，主USD/SGD。科技感极客美学品牌。',
    role: 'system',
  },
  // ─── 域 D：核心规则 ───
  {
    uid: 'seed:rules:overview',
    content: '核心规则：(1)诚实原则 (2)信心指数1-10分(<7标注) (3)来源验证 (4)Karpathy编码(先思考/简洁/精准/目标) (5)先plan.md后编码 (6)强制TDD (7)强制Review。',
    role: 'system',
  },
  {
    uid: 'seed:rules:separation',
    content: '组织分离：Trae开发团队(8人:美杜莎/药老/紫妍/萧炎/蓝灵儿/小医仙/寻宝鼠/海波东)≠OpenClaw网关团队(6人:银月/李长寿/墨影/韩立/雅妃/紫灵)。IDE内vs产品运行时，独立运营。',
    role: 'system',
  },
  {
    uid: 'seed:rules:agents',
    content: '14个智能体：Trae团队(8人)—美杜莎(UI/UX)药老(电商/SEO)紫妍(数字人)萧炎(竞品情报)蓝灵儿(多媒体)小医仙(短编剧)寻宝鼠(选品)海波东(风控)。网关(6人)—银月(总管)李长寿(全栈)墨影(巡检)韩立(侦查)雅妃(支持)紫灵(只读)。shared_memory交接。',
    role: 'system',
  },
  // ─── 域 E：技术栈 ───
  {
    uid: 'seed:techstack:overview',
    content: '技术栈：Node.js/better-sqlite3+FTS5/BAAI bge-m3(OpenRouter)/node-telegram-bot-api/DeerFlow(:2026)。外部：OpenRouter/Stripe/Lemon Squeezy。代理127.0.0.1:7890。',
    role: 'system',
  },
  {
    uid: 'seed:techstack:deerflow',
    content: 'DeerFlow(:2026)免费推理：or-codex/gpt-5.4-mini(永久)/groq/llama-4-scout(永久)/nvidia/deepseek-v3.2(40RPM)/ollama/qwen3.5(local)。工具：web_search/web_fetch/image_search。',
    role: 'system',
  },
  {
    uid: 'seed:techstack:crawlee',
    content: 'Crawlee爬虫：Playwright模拟真人+指纹伪装+Cloudflare处理。动作：crawlUrl/crawlByKeywords/crawlEcommerce/summary。代理127.0.0.1:7890，重试3次+延迟2-5s。结果存crawler_data/。',
    role: 'system',
  },
  {
    uid: 'seed:techstack:shopify',
    content: 'Shopify店铺：银月钱庄(SilverMoon Bank)。主营AI自动化工作流/开发者效率工具/极客桌面美学。品牌色#0A0A0A/#1A1A2E/#00D4FF。目标全球市场，主收USD/SGD。',
    role: 'system',
  },
  {
    uid: 'seed:techstack:proxy',
    content: '代理策略：本地开发强制127.0.0.1:7890(大马)。main.js启动时清proxy环境变量存__OC_PX__(防got自动检测)。telegram-bridge双模式：代理不可达自动降级直连。GCP生产停用代理。',
    role: 'system',
  },
];

let ok = 0;
let skip = 0;
for (const rec of SEED_DATA) {
  const r = store.append(rec);
  if (r.ok && r.changes === 1) {
    ok++;
    console.log(`  ✅ ${rec.uid}`);
  } else if (r.ok && r.changes === 0) {
    skip++;
    console.log(`  ⏭ ${rec.uid} (已存在)`);
  } else {
    console.error(`  ❌ ${rec.uid}:`, r);
  }
}

console.log(`\n写入完成: ${ok} 条新记录, ${skip} 条已跳过`);
if (ok > 0) {
  console.log('等待 embedding 写入...');
  setTimeout(() => {
    console.log('完成');
    process.exit(0);
  }, 3000);
} else {
  process.exit(0);
}
