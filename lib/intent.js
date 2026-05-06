/**
 * intent.js — 意图分类器 + 正则拦截器（多语言版）
 * 优先使用正则匹配处理确定性查询（汇率/金价/BTC），跳过 LLM 调用
 * 支持语言自适应：中文 / English / Bahasa Melayu
 */

'use strict';

const weather = require('./weather');

// ─── 意图定义 ───────────────────────────────────────────────
const INTENT = {
  FX_QUERY:      'fx_query',
  GOLD_QUERY:    'gold_query',
  BTC_QUERY:     'btc_query',
  WEATHER_QUERY: 'weather_query',
  NEWS_QUERY:    'news_query',
  TIME_QUERY:    'time_query',
  REMINDER:      'reminder',
  ETH_QUERY:     'eth_query',
  TRADE_QUERY:   'trade_query',
  CRAWLER_QUERY: 'crawler_query',
  PICKING_QUERY: 'picking_query',
  SHOPIFY_QUERY: 'shopify_query',
  UNKNOWN:       'unknown',
};

// ─── 语言检测 ───────────────────────────────────────────────

/**
 * 检测用户输入语言
 * @param {string} text
 * @returns {'zh'|'en'|'ms'}
 */
function detectLang(text) {
  if (!text) return 'zh';
  // 包含中文字符 → 中文
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  // 马来文特征词
  if (/\b(saya|anda|berapa|harga|emas|ringgit|kadar|pertukaran|tukaran|bitcoin)\b/i.test(text)) return 'ms';
  // 默认英文
  return 'en';
}

// ─── 多语言模板 ─────────────────────────────────────────────

const TEMPLATES = {
  zh: {
    address:    '主人',
    fxTitle:    '✅ 主人，以下是最新汇率信息：',
    goldTitle:  '✅ 主人，以下是最新黄金行情：',
    btcTitle:   '✅ 主人，以下是最新比特币行情：',
    silverLabel:'现货白银 (XAG/USD)',
    fxLabel:    '美元/马币 (USD/MYR)',
    goldLabel:  '现货黄金 (XAU/USD)',
    goldMyrLabel:'折合马币 (XAU/MYR)',
    btcUsdLabel: 'BTC/USD',
    btcMyrLabel: 'BTC/MYR',
    footer:     '如有其他需要，随时吩咐银月～',
    errorFx:    '主人，银月暂时无法获取汇率数据，请稍后再试～',
    errorGold:  '主人，银月暂时无法获取金价数据，请稍后再试～',
    errorBtc:   '主人，银月暂时无法获取比特币数据，请稍后再试～',
    errorGenericFx:   '主人，银月在获取汇率时遇到了问题，请稍后再试～',
    errorGenericGold: '主人，银月在获取金价时遇到了问题，请稍后再试～',
    errorGenericBtc:  '主人，银月在获取币价时遇到了问题，请稍后再试～',
    // 天气
    weatherTitle:     '✅ 主人，以下是当前天气信息：',
    weatherCity:      '城市',
    weatherTemp:      '温度',
    weatherCondition: '天气',
    weatherHumidity:  '湿度',
    errorWeather:     '主人，银月暂时无法获取天气数据，请稍后再试～',
    // 新闻
    newsTitle:        '✅ 主人，以下是最新资讯：',
    errorNews:        '主人，银月暂时无法获取新闻数据，请稍后再试～',
    // 时间
    timeTitle:        '✅ 主人，当前时间信息：',
    timeLocal:        '本地时间',
    timeDate:         '日期',
    timeDay:          '星期',
    // 提醒
    reminderSet:      '✅ 主人，银月已记下提醒：',
    reminderWhen:     '时间',
    reminderContent:  '内容',
    reminderConfirm:  '届时银月会准时提醒主人～',
    reminderFail:     '主人，银月无法解析提醒时间，请用"提醒我 30分钟后 做某事"的格式～',
    // ETH
    ethTitle:         '✅ 主人，以下是最新以太坊行情：',
    ethUsdLabel:      'ETH/USD',
    ethMyrLabel:      'ETH/MYR',
    errorEth:         '主人，银月暂时无法获取以太坊数据，请稍后再试～',
    errorGenericEth:  '主人，银月在获取以太坊数据时遇到了问题，请稍后再试～',
  },
  en: {
    address:    'Master',
    fxTitle:    '✅ Master, here\'s the latest exchange rate:',
    goldTitle:  '✅ Master, here\'s the latest gold price:',
    btcTitle:   '✅ Master, here\'s the latest Bitcoin price:',
    silverLabel:'Spot Silver (XAG/USD)',
    fxLabel:    'USD/MYR',
    goldLabel:  'Spot Gold (XAU/USD)',
    goldMyrLabel:'Gold in MYR (XAU/MYR)',
    btcUsdLabel: 'BTC/USD',
    btcMyrLabel: 'BTC/MYR',
    footer:     'Let me know if you need anything else~',
    errorFx:    'Master, I\'m unable to fetch exchange rate data at the moment. Please try again later~',
    errorGold:  'Master, I\'m unable to fetch gold price data at the moment. Please try again later~',
    errorBtc:   'Master, I\'m unable to fetch Bitcoin data at the moment. Please try again later~',
    errorGenericFx:   'Master, I encountered an issue fetching the exchange rate. Please try again later~',
    errorGenericGold: 'Master, I encountered an issue fetching the gold price. Please try again later~',
    errorGenericBtc:  'Master, I encountered an issue fetching Bitcoin data. Please try again later~',
    weatherTitle:     '✅ Master, here\'s the current weather:',
    weatherCity:      'City',
    weatherTemp:      'Temperature',
    weatherCondition: 'Weather',
    weatherHumidity:  'Humidity',
    errorWeather:     'Master, I\'m unable to fetch weather data at the moment. Please try again later~',
    newsTitle:        '✅ Master, here\'s the latest news:',
    errorNews:        'Master, I\'m unable to fetch news data at the moment. Please try again later~',
    timeTitle:        '✅ Master, current time info:',
    timeLocal:        'Local Time',
    timeDate:         'Date',
    timeDay:          'Day',
    reminderSet:      '✅ Master, reminder has been set:',
    reminderWhen:     'When',
    reminderContent:  'Content',
    reminderConfirm:  'I\'ll remind you on time~',
    reminderFail:     'Master, I couldn\'t parse the reminder time. Please use format like "remind me in 30 minutes to do something"~',
    ethTitle:         '✅ Master, here\'s the latest Ethereum price:',
    ethUsdLabel:      'ETH/USD',
    ethMyrLabel:      'ETH/MYR',
    errorEth:         'Master, I\'m unable to fetch Ethereum data at the moment. Please try again later~',
    errorGenericEth:  'Master, I encountered an issue fetching Ethereum data. Please try again later~',
  },
  ms: {
    address:    'Tuan',
    fxTitle:    '✅ Tuan, berikut kadar pertukaran terkini:',
    goldTitle:  '✅ Tuan, berikut harga emas terkini:',
    btcTitle:   '✅ Tuan, berikut harga Bitcoin terkini:',
    silverLabel:'Perak Spot (XAG/USD)',
    fxLabel:    'USD/MYR',
    goldLabel:  'Emas Spot (XAU/USD)',
    goldMyrLabel:'Emas dalam MYR (XAU/MYR)',
    btcUsdLabel: 'BTC/USD',
    btcMyrLabel: 'BTC/MYR',
    footer:     'Jika ada keperluan lain, sila beritahu Yin Yue~',
    errorFx:    'Tuan, Yin Yue tidak dapat mendapatkan data kadar pertukaran buat masa ini. Sila cuba lagi~',
    errorGold:  'Tuan, Yin Yue tidak dapat mendapatkan data harga emas buat masa ini. Sila cuba lagi~',
    errorBtc:   'Tuan, Yin Yue tidak dapat mendapatkan data Bitcoin buat masa ini. Sila cuba lagi~',
    errorGenericFx:   'Tuan, Yin Yue menghadapi masalah mendapatkan kadar pertukaran. Sila cuba lagi~',
    errorGenericGold: 'Tuan, Yin Yue menghadapi masalah mendapatkan harga emas. Sila cuba lagi~',
    errorGenericBtc:  'Tuan, Yin Yue menghadapi masalah mendapatkan data Bitcoin. Sila cuba lagi~',
    weatherTitle:     '✅ Tuan, berikut maklumat cuaca semasa:',
    weatherCity:      'Bandar',
    weatherTemp:      'Suhu',
    weatherCondition: 'Cuaca',
    weatherHumidity:  'Kelembapan',
    errorWeather:     'Tuan, Yin Yue tidak dapat mendapatkan data cuaca buat masa ini. Sila cuba lagi~',
    newsTitle:        '✅ Tuan, berikut berita terkini:',
    errorNews:        'Tuan, Yin Yue tidak dapat mendapatkan berita buat masa ini. Sila cuba lagi~',
    timeTitle:        '✅ Tuan, maklumat masa semasa:',
    timeLocal:        'Masa Tempatan',
    timeDate:         'Tarikh',
    timeDay:          'Hari',
    reminderSet:      '✅ Tuan, peringatan telah ditetapkan:',
    reminderWhen:     'Bila',
    reminderContent:  'Kandungan',
    reminderConfirm:  'Yin Yue akan mengingatkan Tuan tepat pada masanya~',
    reminderFail:     'Tuan, Yin Yue tidak dapat memahami masa peringatan. Sila guna format "ingatkan saya 30 minit lagi untuk..."~',
    ethTitle:         '✅ Tuan, berikut harga Ethereum terkini:',
    ethUsdLabel:      'ETH/USD',
    ethMyrLabel:      'ETH/MYR',
    errorEth:         'Tuan, Yin Yue tidak dapat mendapatkan data Ethereum buat masa ini. Sila cuba lagi~',
    errorGenericEth:  'Tuan, Yin Yue menghadapi masalah mendapatkan data Ethereum. Sila cuba lagi~',
  },
};

// ─── 正则规则（多语言） ─────────────────────────────────────
const PATTERNS = [
  {
    intent: INTENT.FX_QUERY,
    patterns: [
      // 中文
      /汇率/i, /美[金元].*[马令]|[马令].*美[金元]/i, /外汇/i, /马币/i,
      /[换兑].*[美马]|[美马].*[换兑]/i,
      // 英文
      /usd\s*(?:to\s*)?myr|myr\s*(?:to\s*)?usd/i,
      /exchange\s*rate/i, /forex.*myr|myr.*forex/i,
      /how\s*much.*(?:usd|dollar|ringgit)/i,
      // 马来文
      /kadar\s*(?:pertukaran|tukaran)/i, /berapa.*ringgit/i,
      /tukaran.*(?:usd|dollar)/i,
    ],
  },
  {
    intent: INTENT.GOLD_QUERY,
    patterns: [
      // 中文
      /金价/i, /黄金.*价|价.*黄金/i, /现货黄金/i,
      /金[的]?[多少几]|[多少几].*金价/i,
      // 英文
      /gold\s*price/i, /xau/i, /price\s*of\s*gold/i,
      /how\s*much.*gold/i, /spot\s*gold/i,
      // 马来文
      /harga\s*emas/i, /emas.*berapa|berapa.*emas/i,
    ],
  },
  {
    intent: INTENT.BTC_QUERY,
    patterns: [
      // 中文
      /btc|比特币/i, /btc.*价|价.*btc/i,
      /比特币.*[多少几]|[多少几].*比特币/i, /币价/i,
      // 英文
      /bitcoin/i, /btc\s*price/i, /price\s*of\s*(?:btc|bitcoin)/i,
      /how\s*much.*(?:btc|bitcoin)/i,
      // 马来文
      /harga\s*(?:btc|bitcoin)/i, /berapa.*(?:btc|bitcoin)/i,
    ],
  },
  {
    intent: INTENT.ETH_QUERY,
    patterns: [
      // 中文
      /以太坊|以太币/i, /eth.*价|价.*eth/i,
      /以太坊.*[多少几]|[多少几].*以太坊/i,
      // 英文
      /\beth\b/i, /ethereum/i, /eth\s*price/i,
      /price\s*of\s*(?:eth|ethereum)/i, /how\s*much.*(?:eth|ethereum)/i,
      // 马来文
      /harga\s*(?:eth|ethereum)/i, /berapa.*(?:eth|ethereum)/i,
    ],
  },
  {
    intent: INTENT.WEATHER_QUERY,
    patterns: [
      // 中文
      /天气/i, /气温/i, /下雨/i, /多云/i, /晴天/i,
      /今天.*热|热.*今天/i, /温度/i, /预报/i,
      // 英文
      /weather/i, /temperature/i, /is\s*it\s*(raining|hot|cold|sunny|cloudy)/i,
      /forecast/i, /how\s*is\s*the\s*weather/i,
      // 马来文
      /cuaca/i, /suhu/i, /hujan/i, /panas\s*ke/i,
    ],
  },
  {
    intent: INTENT.NEWS_QUERY,
    patterns: [
      // 中文
      /新闻/i, /今日头条/i, /最新消息/i, /今天.*发生/i,
      /有什么.*新闻|新闻.*有什么/i,
      // 英文
      /\bnews\b/i, /headline/i, /what.*happened\s*today/i,
      /latest\s*news/i, /what'?s\s*(happening|going\s*on)/i,
      // 马来文
      /berita/i, /terkini/i, /apa.*berlaku/i,
    ],
  },
  {
    intent: INTENT.TIME_QUERY,
    patterns: [
      // 中文
      /几点了/i, /现在.*时间|时间.*现在/i, /今天.*号|今天.*日/i,
      /星期几/i, /什么时候/i, /几月几号/i,
      // 英文
      /what\s*time/i, /what.*date\s*(?:is\s*)?(?:it|today)/i,
      /what\s*day\s*is/i, /current\s*time/i,
      // 马来文
      /pukul\s*berapa/i, /tarikh\s*hari\s*ini/i, /hari\s*apa/i,
    ],
  },
  {
    intent: INTENT.REMINDER,
    patterns: [
      // 中文
      /提醒我/i, /提醒一下/i, /[0-9]+\s*分钟后.*提醒/i,
      /[0-9]+\s*小时后.*提醒/i, /帮我记得/i, /别忘了提醒/i,
      // 英文
      /remind\s*me/i, /set\s*(?:a\s*)?reminder/i,
      /don'?t\s*(?:let\s*me\s*)?forget/i,
      // 马来文
      /ingatkan\s*saya/i, /peringatan/i, /jangan\s*lupa/i,
    ],
  },
  {
    intent: INTENT.TRADE_QUERY,
    patterns: [
      // 中文
      /交易/i, /下单/i, /平仓/i, /做多|做空/i, /买入.*卖出|卖出.*买入/i,
      /持仓/i, /仓位/i, /止损|止盈/i, /交易计划/i, /提交.*交易/i,
      /批准|同意.*交易|执行.*交易/i, /查看.*持仓/i, /MT4|MT5/i,
      // 英文
      /trade/i, /place\s*order/i, /close\s*position/i, /buy\s*sell|sell\s*buy/i,
      /position/i, /stop\s*loss|take\s*profit/i, /trade\s*plan/i,
      /approve.*trade|execute.*trade/i, /open\s*positions/i,
      // 马来文
      /dagang/i, /pesanan/i, /beli|jual/i, /posisi/i,
    ],
  },
  {
    intent: INTENT.SHOPIFY_QUERY,
    patterns: [
      // 中文
      /上架|下架|商品|产品|订单|库存|店铺|shopify/i,
      /电商|运营|铺货|listing/i,
      /创建.*商品|添加.*产品|更新.*商品|删除.*商品/i,
      /查.*订单|订单.*状态|发货|退款/i,
      // 英文
      /shopify/i, /product.*list|list.*product/i,
      /create.*product|add.*product|update.*product|delete.*product/i,
      /order.*status|ship.*order|refund/i, /inventory/i,
      /dropship|drop.?ship/i,
      // 马来文
      /produk|pesanan|stok|kedai/i,
      /naikkan.*produk|turunkan.*produk/i,
    ],
  },
  {
    intent: INTENT.CRAWLER_QUERY,
    patterns: [
      // 中文
      /爬虫|爬取|抓取|采集/i, /金融.*新闻|新闻.*金融/i,
      /市场.*数据|数据.*采集/i, /全网.*搜索|搜索.*全网/i,
      /最新.*行情|行情.*最新/i, /Web3.*数据|DeFi.*数据/i,
      /加密货币.*价格|比特币.*价格/i, /宏观.*数据|经济.*数据/i,
      // 英文（排除 Crawlee 框架名，那是通用工具非银月专属）
      /(?:^|[^a-zA-Z])crawl(?:er|ing|ed)?(?:[^a-zA-Z]|$)/i,
      /scrape|scraper|collect.*data/i,
      /market.*data|financial.*news/i, /web3.*data|defi.*data/i,
      /crypto.*price|bitcoin.*price/i, /macro.*data|economic.*data/i,
      // 马来文
      /kutip.*data|data.*pasaran/i, /berita.*kewangan/i,
    ],
  },
];

// ─── 分类函数 ───────────────────────────────────────────────

/**
 * 对用户消息进行意图分类
 * @param {string} text
 * @returns {{ intent: string, confidence: number }}
 */
function classify(text) {
  if (!text || typeof text !== 'string') {
    return { intent: INTENT.UNKNOWN, confidence: 0 };
  }

  const cleaned = text.trim();

  // 包含 URL 的消息跳过所有意图匹配，交给银月自己处理
  if (/https?:\/\/[^\s,，。]+/.test(cleaned)) {
    return { intent: INTENT.UNKNOWN, confidence: 0 };
  }

  for (const rule of PATTERNS) {
    for (const re of rule.patterns) {
      if (re.test(cleaned)) {
        return { intent: rule.intent, confidence: 1.0 };
      }
    }
  }

  return { intent: INTENT.UNKNOWN, confidence: 0 };
}

// ─── 响应处理器（多语言） ───────────────────────────────────

/**
 * 格式化汇率查询结果
 */
async function handleFxQuery({ fetchUsdMyr, formatNum, lang }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  try {
    const rate = await fetchUsdMyr();
    if (!rate || rate <= 0) return t.errorFx;
    const lines = [
      t.fxTitle,
      '',
      `🔹 ${t.fxLabel}：${formatNum(rate, 4)}`,
      `🔹 1000 USD ≈ ${formatNum(rate * 1000, 2)} MYR`,
      `🔹 1000 MYR ≈ ${formatNum(1000 / rate, 2)} USD`,
      '',
      t.footer,
    ];
    return lines.join('\n');
  } catch (err) {
    console.error('[intent] FX query error:', err.message);
    return t.errorGenericFx;
  }
}

/**
 * 格式化金价查询结果
 */
async function handleGoldQuery({ fetchMetalsSpotUsd, fetchUsdMyr, formatNum, lang }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  try {
    const [metals, usdMyr] = await Promise.all([
      fetchMetalsSpotUsd(),
      fetchUsdMyr(),
    ]);
    const goldUsd = metals?.gold;
    if (!goldUsd || goldUsd <= 0) return t.errorGold;
    const goldMyr = goldUsd * (usdMyr || 1);
    const lines = [
      t.goldTitle,
      '',
      `🔹 ${t.goldLabel}：$${formatNum(goldUsd, 2)}`,
      `🔹 ${t.goldMyrLabel}：RM ${formatNum(goldMyr, 2)}`,
    ];
    if (metals?.silver) {
      lines.push(`🔹 ${t.silverLabel}：$${formatNum(metals.silver, 2)}`);
    }
    lines.push('', t.footer);
    return lines.join('\n');
  } catch (err) {
    console.error('[intent] Gold query error:', err.message);
    return t.errorGenericGold;
  }
}

/**
 * 格式化 BTC 查询结果
 */
async function handleBtcQuery({ fetchCryptoUsd, fetchUsdMyr, formatNum, lang }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  try {
    const [btcUsd, usdMyr] = await Promise.all([
      fetchCryptoUsd('bitcoin'),
      fetchUsdMyr(),
    ]);
    if (!btcUsd || btcUsd <= 0) return t.errorBtc;
    const btcMyr = btcUsd * (usdMyr || 1);
    const lines = [
      t.btcTitle,
      '',
      `🔹 ${t.btcUsdLabel}：$${formatNum(btcUsd, 0)}`,
      `🔹 ${t.btcMyrLabel}：RM ${formatNum(btcMyr, 0)}`,
      '',
      t.footer,
    ];
    return lines.join('\n');
  } catch (err) {
    console.error('[intent] BTC query error:', err.message);
    return t.errorGenericBtc;
  }
}

// ─── 统一分发入口 ───────────────────────────────────────────

/**
 * 格式化 ETH 查询结果
 */
async function handleEthQuery({ fetchCryptoUsd, fetchUsdMyr, formatNum, lang }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  try {
    const [ethUsd, usdMyr] = await Promise.all([
      fetchCryptoUsd('ethereum'),
      fetchUsdMyr(),
    ]);
    if (!ethUsd || ethUsd <= 0) return t.errorEth;
    const ethMyr = ethUsd * (usdMyr || 1);
    const lines = [
      t.ethTitle,
      '',
      `🔹 ${t.ethUsdLabel}：$${formatNum(ethUsd, 2)}`,
      `🔹 ${t.ethMyrLabel}：RM ${formatNum(ethMyr, 2)}`,
      '',
      t.footer,
    ];
    return lines.join('\n');
  } catch (err) {
    console.error('[intent] ETH query error:', err.message);
    return t.errorGenericEth;
  }
}

/**
 * 格式化天气查询结果
 * @param {object} deps
 * @param {Function} deps.fetchWeather - 天气获取函数
 * @param {string} deps.userText - 用户原始消息
 */
async function handleWeatherQuery({ fetchWeather, lang, userText }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  try {
    // 斩首行动：强制使用 weather.js 模块
    const w = await weather.fetchWeatherFromMessage(userText);
    
    if (!w) return '❌ 抱歉主人，天气阵法暂时无法响应，请稍后再试。';
    if (w.error) return w.message;

    const lines = [
      t.weatherTitle,
      '',
      `🔹 ${t.weatherCity}：${w.displayCity || w.city || '-'}`,
      `🔹 ${t.weatherTemp}：${w.temp || '-'}`,
      `🔹 ${t.weatherCondition}：${w.condition || '-'}`,
      `🔹 ${t.weatherHumidity}：${w.humidity || '-'}`,
      '',
      t.footer,
    ];
    return lines.join('\n').trim();
  } catch (err) {
    console.error('[intent] Weather query error:', err.message);
    return '❌ 抱歉主人，天气阵法运行异常，已强制拦截废话。';
  }
}

/**
 * 格式化新闻查询结果
 * @param {object} deps
 * @param {Function} deps.fetchNews - 新闻获取函数，返回 [{ title, source? }]
 */
async function handleNewsQuery({ fetchNews, lang }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  try {
    if (typeof fetchNews !== 'function') return t.errorNews;
    const news = await fetchNews();
    if (!news || !Array.isArray(news) || news.length === 0) return t.errorNews;
    const lines = [t.newsTitle, ''];
    const items = news.slice(0, 5); // 最多展示 5 条
    items.forEach((item, i) => {
      const src = item.source ? ` (${item.source})` : '';
      lines.push(`🔹 ${i + 1}. ${item.title}${src}`);
    });
    lines.push('', t.footer);
    return lines.join('\n');
  } catch (err) {
    console.error('[intent] News query error:', err.message);
    return t.errorNews;
  }
}

/**
 * 格式化时间查询结果（纯本地，无需 API）
 */
function handleTimeQuery({ lang, timezone }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  const tz = timezone || 'Asia/Kuala_Lumpur';
  const now = new Date();

  const dayNames = {
    zh: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    ms: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
  };

  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dayIndex = new Date(now.toLocaleString('en-US', { timeZone: tz })).getDay();
  const dayStr = (dayNames[lang] || dayNames.zh)[dayIndex];

  const lines = [
    t.timeTitle,
    '',
    `🔹 ${t.timeLocal}：${timeStr} (${tz})`,
    `🔹 ${t.timeDate}：${dateStr}`,
    `🔹 ${t.timeDay}：${dayStr}`,
    '',
    t.footer,
  ];
  return lines.join('\n');
}

/**
 * 处理提醒设置
 * @param {object} deps
 * @param {string} deps.userText     - 用户原始消息
 * @param {Function} deps.setReminder - 设置提醒的函数 (ms, content) => boolean
 */
async function handleReminder({ userText, setReminder, lang }) {
  const t = TEMPLATES[lang] || TEMPLATES.zh;
  const text = userText || '';

  // 解析时间：支持"30分钟后"、"2小时后"、"in 30 minutes"、"30 minit lagi"
  let delayMs = 0;
  let content = '';

  // 中文：提醒我 30分钟后 做某事
  const zhMatch = text.match(/(\d+)\s*(分钟|小时|秒)/);
  if (zhMatch) {
    const num = parseInt(zhMatch[1], 10);
    const unit = zhMatch[2];
    if (unit === '秒') delayMs = num * 1000;
    else if (unit === '分钟') delayMs = num * 60 * 1000;
    else if (unit === '小时') delayMs = num * 3600 * 1000;
    content = text.replace(/.*?(提醒我|提醒一下|帮我记得)/, '').replace(/(\d+)\s*(分钟|小时|秒)(后|之后)?/, '').trim();
  }

  // 英文：remind me in 30 minutes to ...
  const enMatch = text.match(/(\d+)\s*(second|minute|hour|min|hr)s?/i);
  if (!delayMs && enMatch) {
    const num = parseInt(enMatch[1], 10);
    const unit = enMatch[2].toLowerCase();
    if (unit.startsWith('sec')) delayMs = num * 1000;
    else if (unit.startsWith('min')) delayMs = num * 60 * 1000;
    else if (unit.startsWith('h')) delayMs = num * 3600 * 1000;
    content = text.replace(/.*?(remind\s*me|set\s*(?:a\s*)?reminder)/i, '')
      .replace(/in\s*\d+\s*(second|minute|hour|min|hr)s?/i, '')
      .replace(/^[\s,to]+/, '').trim();
  }

  // 马来文：ingatkan saya 30 minit lagi
  const msMatch = text.match(/(\d+)\s*(saat|minit|jam)/i);
  if (!delayMs && msMatch) {
    const num = parseInt(msMatch[1], 10);
    const unit = msMatch[2].toLowerCase();
    if (unit === 'saat') delayMs = num * 1000;
    else if (unit === 'minit') delayMs = num * 60 * 1000;
    else if (unit === 'jam') delayMs = num * 3600 * 1000;
    content = text.replace(/.*?(ingatkan\s*saya|peringatan)/i, '')
      .replace(/(\d+)\s*(saat|minit|jam)\s*(lagi)?/i, '').trim();
  }

  if (delayMs <= 0) return t.reminderFail;
  if (!content) content = lang === 'zh' ? '（未指定内容）' : lang === 'ms' ? '(tiada kandungan)' : '(no content specified)';

  // 调用设置提醒
  if (typeof setReminder === 'function') {
    try {
      await setReminder(delayMs, content);
    } catch (e) {
      console.error('[intent] Reminder set error:', e.message);
    }
  }

  const whenStr = formatDelay(delayMs, lang);

  const lines = [
    t.reminderSet,
    '',
    `🔹 ${t.reminderWhen}：${whenStr}`,
    `🔹 ${t.reminderContent}：${content}`,
    '',
    t.reminderConfirm,
  ];
  return lines.join('\n');
}

/**
 * 辅助：将毫秒延迟格式化为人类可读文本
 */
function formatDelay(ms, lang) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) {
    return lang === 'zh' ? `${sec} 秒后` : lang === 'ms' ? `${sec} saat lagi` : `in ${sec} seconds`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) {
    return lang === 'zh' ? `${min} 分钟后` : lang === 'ms' ? `${min} minit lagi` : `in ${min} minutes`;
  }
  const hr = (min / 60).toFixed(1);
  return lang === 'zh' ? `${hr} 小时后` : lang === 'ms' ? `${hr} jam lagi` : `in ${hr} hours`;
}

// ─── 统一分发入口（扩展版） ─────────────────────────────────

/**
 * 尝试用正则拦截处理消息
 * 命中 → 返回多语言回复文本
 * 未命中 → 返回 null，交给 LLM
 *
 * @param {string} text - 用户消息文本
 * @param {object} deps - 依赖注入
 * @param {Function} deps.fetchUsdMyr
 * @param {Function} deps.fetchMetalsSpotUsd
 * @param {Function} deps.fetchCryptoUsd
 * @param {Function} deps.formatNum
 * @param {Function} [deps.fetchWeather]   - 可选：天气获取
 * @param {Function} [deps.fetchNews]      - 可选：新闻获取
 * @param {Function} [deps.setReminder]    - 可选：设置提醒
 * @param {string}   [deps.timezone]       - 可选：时区（默认 Asia/Kuala_Lumpur）
 * @returns {Promise<string|null>}
 */
async function tryIntentIntercept(text, deps) {
  const { intent } = classify(text);
  console.log('[intent] classify result:', intent, 'text:', String(text || '').slice(0, 40));
  if (intent === INTENT.UNKNOWN) return null;

  // 自动检测语言并注入到 deps
  const lang = detectLang(text);
  const d = { ...deps, lang, userText: text };

  switch (intent) {
    case INTENT.FX_QUERY:
      return handleFxQuery(d);
    case INTENT.GOLD_QUERY:
      return handleGoldQuery(d);
    case INTENT.BTC_QUERY:
      return handleBtcQuery(d);
    case INTENT.ETH_QUERY:
      return handleEthQuery(d);
    case INTENT.WEATHER_QUERY:
      return handleWeatherQuery(d);
    case INTENT.NEWS_QUERY:
      return handleNewsQuery(d);
    case INTENT.TIME_QUERY:
      return handleTimeQuery(d);
    case INTENT.REMINDER:
      return handleReminder(d);
    case INTENT.TRADE_QUERY:
      return { intent: INTENT.TRADE_QUERY, confidence: 1.0, text };
    case INTENT.CRAWLER_QUERY:
      return { intent: INTENT.CRAWLER_QUERY, confidence: 1.0, text };
    case INTENT.SHOPIFY_QUERY:
      return { intent: INTENT.SHOPIFY_QUERY, confidence: 1.0, text };
    default:
      return null;
  }
}

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  INTENT,
  classify,
  detectLang,
  tryIntentIntercept,
  handleFxQuery,
  handleGoldQuery,
  handleBtcQuery,
  handleEthQuery,
  handleWeatherQuery,
  handleNewsQuery,
  handleTimeQuery,
  handleReminder,
  TEMPLATES,
};
