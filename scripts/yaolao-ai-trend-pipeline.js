const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CASHCLAW_DIR = path.join(ROOT, 'workspace', 'CASHCLAW');
const CRON_DIR = path.join(ROOT, 'workspace', 'CRON');
const REPORT_DIR = path.join(CASHCLAW_DIR, 'reports');

[CASHCLAW_DIR, CRON_DIR, REPORT_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

async function fetchJSON(url, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function fetchTopicContent(url) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    const html = await r.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000);
  } catch {
    return '';
  }
}

function extractKeywords(text) {
  const patterns = [
    { cat: 'AI/ML', terms: ['AI', 'LLM', 'GPT', 'transformer', 'neural network', 'deep learning',
      'machine learning', 'agent', 'RAG', 'fine.tune', 'diffusion', 'embedding', 'vector database',
      'inference', 'open source AI', 'open.source'] },
    { cat: '开发工具', terms: ['JavaScript', 'TypeScript', 'Python', 'Rust', 'React', 'Next.js',
      'cloud', 'serverless', 'Kubernetes', 'edge computing', 'database', 'API', 'CLI',
      'framework', 'library', 'compiler', 'debugger', 'IDE'] },
    { cat: '硬件/设备', terms: ['hardware', 'device', 'gadget', 'wearable', 'smart.', 'dock',
      'hub', 'sensor', 'chip', 'processor', 'GPU', 'display', 'headset', 'headphone',
      'speaker', 'camera', 'keyboard', 'mouse', 'RGB', 'mechanical'] },
    { cat: '安全/隐私', terms: ['security', 'privacy', 'encryption', 'crypto', 'blockchain',
      'authentication', 'zero.trust', 'firewall', 'VPN'] },
    { cat: '效率/自动化', terms: ['productivity', 'automation', 'workflow', 'pipeline', 'CI/CD',
      'DevOps', 'monitoring', 'observability', 'logging', 'testing'] }
  ];
  const lower = text.toLowerCase();
  const found = [];
  for (const group of patterns) {
    for (const term of group.terms) {
      const pattern = term.replace(/\./g, '[\\s.-]');
      if (new RegExp(pattern, 'i').test(lower)) {
        found.push({ cat: group.cat, term });
        break;
      }
    }
  }
  return found;
}

function generateHashtags(keywords, topStoryTitles) {
  const base = ['#AILifestyle', '#DeveloperTools', '#TechTok', '#FutureOfWork',
    '#ProductivityHacks', '#BuildInPublic', '#IndieHacker', '#TechTrends'];
  const fromKeywords = [...new Set(keywords.map(k => {
    const tag = k.term.replace(/[\s.#/\\-]+/g, '');
    return `#${tag}`;
  }))];
  const fromTitles = topStoryTitles.slice(0, 3).map(t => {
    const words = t.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    return '#' + words.slice(0, 2).join('');
  });
  return [...new Set([...base, ...fromKeywords, ...fromTitles])].slice(0, 20);
}

function suggestProducts(keywords) {
  const cats = [...new Set(keywords.map(k => k.cat))];
  const map = {
    'AI/ML': { category: 'AI Workflows', tag: '#AIWorkflow', desc: 'AI 自动化工作流模板 & 开发者效率指南' },
    '开发工具': { category: 'Developer Tools', tag: '#DevTools', desc: '开发者效率工具包 & 命令行生产力套件' },
    '硬件/设备': { category: 'Tech Wearables', tag: '#TechWearables', desc: 'AI 智能穿戴 & 极客桌面美学设备' },
    '安全/隐私': { category: 'Security Tools', tag: '#CyberSec', desc: '隐私保护工具 & 安全硬件' },
    '效率/自动化': { category: 'Productivity', tag: '#Productivity', desc: '自动化工作流 & 效率提升工具' }
  };
  const suggestions = cats.filter(c => map[c]).map(c => map[c]);
  if (suggestions.length === 0) {
    suggestions.push({ category: 'AI Tech Gear', tag: '#TechGear', desc: '热门 AI 科技配件 & 极客装备' });
  }
  return suggestions;
}

function writeTrendReport(ymd, stories, keywords, hashtags, suggestions) {
  const lines = [];
  lines.push(`# 药老 · AI/科技趋势日报 ${ymd}`);
  lines.push('');
  lines.push(`> 数据来源：Hacker News Top 30 | 生成时间：${new Date().toISOString()}`);
  lines.push('');
  lines.push('## 热门话题 Top 15');
  lines.push('');
  stories.slice(0, 15).forEach((s, i) => {
    lines.push(`${i + 1}. [${s.title}](${s.url || 'https://news.ycombinator.com/item?id=' + s.id})`);
  });
  lines.push('');
  lines.push('## 提取关键词（按分类）');
  lines.push('');
  const grouped = {};
  keywords.forEach(k => {
    if (!grouped[k.cat]) grouped[k.cat] = [];
    grouped[k.cat].push(k.term);
  });
  for (const [cat, terms] of Object.entries(grouped)) {
    lines.push(`**${cat}**：\`${[...new Set(terms)].join('`, `')}\``);
    lines.push('');
  }
  lines.push('## 推荐 Hashtag');
  lines.push('');
  hashtags.forEach(h => lines.push(`- ${h}`));
  lines.push('');
  lines.push('## 商品上架建议');
  lines.push('');
  suggestions.forEach(s => {
    lines.push(`### ${s.category} ${s.tag}`);
    lines.push(`${s.desc}`);
    lines.push('');
  });
  lines.push('## 上架状态');
  lines.push('');
  lines.push('- Shopify 店铺已就绪');
  lines.push('- 建议结合趋势关键词优化现有产品 Tags & Description');
  lines.push('- 如需上架新品，需通过 Crawlee 采集供应商数据');
  lines.push('');
  lines.push('---');
  lines.push(`_自动生成 · ${ymd} · 银月钱庄 药老管线_`);

  const fp = path.join(REPORT_DIR, `trend_report_${ymd}.md`);
  fs.writeFileSync(fp, lines.join('\n'), 'utf-8');
  return fp;
}

async function run({ dryRun = true, force = false } = {}) {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10);
  const marker = path.join(CRON_DIR, `${ymd}_yaolao_trend.sent`);
  if (!force && fs.existsSync(marker)) {
    return { ok: true, skipped: true, reason: '今日已执行' };
  }

  const log = [];
  log.push(`[药老趋势] 开始 | dryRun=${dryRun} | ymd=${ymd}`);

  let stories;
  try {
    const ids = (await fetchJSON(HN_TOP)).slice(0, 30);
    stories = (await Promise.all(
      ids.map(id => fetchJSON(HN_ITEM(id)).catch(() => null))
    )).filter(Boolean);
    log.push(`HN 获取 ${stories.length} 条`);
  } catch (e) {
    log.push(`HN 失败: ${e.message}`);
    stories = [];
  }

  if (stories.length === 0) {
    return { ok: false, error: '所有数据源均不可用', log };
  }

  const keywords = extractKeywords(stories.map(s => s.title + ' ' + (s.url || '')).join(' '));
  log.push(`关键词 ${keywords.length} 条`);

  const hashtags = generateHashtags(keywords, stories.map(s => s.title));
  const suggestions = suggestProducts(keywords);
  const reportPath = writeTrendReport(ymd, stories, keywords, hashtags, suggestions);
  log.push(`报告已写: ${reportPath}`);

  let listing = { skipped: true };
  if (!dryRun) {
    try {
      const srcFile = path.join(CASHCLAW_DIR, 'sourcing_results.jsonl');
      if (fs.existsSync(srcFile)) {
        const lp = require('./listing-pipeline');
        listing = await lp.run(false);
        log.push(`listing-pipeline 执行完毕`);
      } else {
        log.push(`无 sourcing_data，跳过上架`);
      }
    } catch (e) {
      log.push(`上架失败: ${e.message}`);
      listing = { skipped: true, error: e.message };
    }
    fs.writeFileSync(marker, `sentAt=${now.toISOString()}\n`);
  }

  return {
    ok: true, dryRun,
    storiesCount: stories.length,
    keywordsCount: keywords.length,
    suggestions: suggestions.map(s => s.category),
    reportPath,
    listing,
    log
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const force = args.includes('--force');
  run({ dryRun, force })
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => console.error('[药老趋势] 异常:', e));
}

module.exports = { run };
