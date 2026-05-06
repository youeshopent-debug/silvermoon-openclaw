/**
 * weather.js — 通用天气查询模块
 * 支持任意城市查询，使用 wttr.in API（免费，无需 API Key）
 * 备用：OpenWeatherMap（需 API Key）
 */

'use strict';

const https = require('https');
const http = require('http');

// ─── 城市名映射（中文 → 英文） ──────────────────────────────

const CITY_MAP = {
  // 马来西亚
  '斗湖':     'Tawau',
  '吉隆坡':   'Kuala Lumpur',
  '槟城':     'Penang',
  '新山':     'Johor Bahru',
  '古晋':     'Kuching',
  '亚庇':     'Kota Kinabalu',
  '马六甲':   'Melaka',
  '怡保':     'Ipoh',
  '关丹':     'Kuantan',
  '瓜拉登嘉楼': 'Kuala Terengganu',
  '山打根':   'Sandakan',
  '诗巫':     'Sibu',
  '美里':     'Miri',

  // 中国
  '北京':     'Beijing',
  '上海':     'Shanghai',
  '广州':     'Guangzhou',
  '深圳':     'Shenzhen',
  '杭州':     'Hangzhou',
  '成都':     'Chengdu',
  '重庆':     'Chongqing',
  '武汉':     'Wuhan',
  '南京':     'Nanjing',
  '西安':     'Xian',
  '香港':     'Hong Kong',
  '澳门':     'Macau',
  '台北':     'Taipei',

  // 东南亚
  '新加坡':   'Singapore',
  '曼谷':     'Bangkok',
  '雅加达':   'Jakarta',
  '马尼拉':   'Manila',
  '河内':     'Hanoi',
  '胡志明':   'Ho Chi Minh City',

  // 其他
  '东京':     'Tokyo',
  '首尔':     'Seoul',
  '纽约':     'New York',
  '伦敦':     'London',
  '悉尼':     'Sydney',
  '迪拜':     'Dubai',
};

// 默认城市
const DEFAULT_CITY = 'Tawau';

// ─── 城市提取 ───────────────────────────────────────────────

/**
 * 从用户消息中提取城市名
 * @param {string} text - 用户消息
 * @returns {string} 英文城市名
 */
function extractCity(text) {
  if (!text) return DEFAULT_CITY;
  const cleaned = text.trim();

  // 1. 先尝试中文城市匹配（按名字长度倒序，避免"吉隆"匹配到"吉隆坡"前面）
  const zhCities = Object.keys(CITY_MAP).sort((a, b) => b.length - a.length);
  for (const zh of zhCities) {
    if (cleaned.includes(zh)) {
      return CITY_MAP[zh];
    }
  }

  // 2. 尝试英文城市匹配
  const enCities = Object.values(CITY_MAP);
  for (const en of enCities) {
    if (cleaned.toLowerCase().includes(en.toLowerCase())) {
      return en;
    }
  }

  // 3. 尝试从消息中提取可能的城市名（去掉天气相关词后的剩余部分）
  let candidate = cleaned
    .replace(/天气|气温|温度|下雨|预报|forecast|weather|temperature|cuaca|suhu|hujan/gi, '')
    .replace(/今天|明天|后天|这周|today|tomorrow|hari\s*ini|esok/gi, '')
    .replace(/怎么样|如何|多少|查|查询|看看/gi, '')
    .replace(/[?？！!。，,\s]+/g, ' ')
    .trim();

  if (candidate && candidate.length > 0 && candidate.length <= 30) {
    // 检查是否是中文城市映射中的
    if (CITY_MAP[candidate]) return CITY_MAP[candidate];
    // 否则直接用作城市名（可能是英文或马来文城市名）
    if (/^[A-Za-z\s]+$/.test(candidate)) return candidate;
  }

  return DEFAULT_CITY;
}

// ─── wttr.in API ────────────────────────────────────────────

/**
 * 通过 wttr.in 获取天气数据（免费，无需 API Key）
 * @param {string} city - 英文城市名
 * @returns {Promise<object|null>}
 */
async function fetchFromWttr(city) {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;

  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const current = json.current_condition?.[0];
          if (!current) { resolve(null); return; }

          resolve({
            city: city,
            temp: `${current.temp_C}°C`,
            feelsLike: `${current.FeelsLikeC}°C`,
            condition: current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '-',
            conditionEn: current.weatherDesc?.[0]?.value || '-',
            humidity: `${current.humidity}%`,
            wind: `${current.windspeedKmph} km/h ${current.winddir16Point}`,
            visibility: `${current.visibility} km`,
            uvIndex: current.uvIndex || '-',
            // 未来预报
            forecast: (json.weather || []).slice(0, 3).map((d) => {
              // 从多个时段取条件描述（凌晨、早上、中午、下午）
              const hourSlots = [0, 3, 6, 9, 12, 15, 18, 21];
              let cond = '-';
              let rainChance = '-';
              for (const h of hourSlots) {
                const slot = d.hourly?.[h];
                if (slot) {
                  const c = slot.lang_zh?.[0]?.value || slot.weatherDesc?.[0]?.value || '';
                  if (c) cond = c;
                  if (slot.chanceofrain && slot.chanceofrain !== '-' && parseInt(slot.chanceofrain) > 0) {
                    rainChance = `${slot.chanceofrain}%`;
                  }
                }
              }
              return {
                date: d.date,
                maxTemp: `${d.maxtempC}°C`,
                minTemp: `${d.mintempC}°C`,
                condition: cond,
                rainChance,
              };
            }),
          });
        } catch (e) {
          console.error('[weather] wttr.in parse error:', e.message);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[weather] wttr.in request error:', e.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[weather] wttr.in request timeout');
      resolve(null);
    });
  });
}

// ─── 统一查询入口 ───────────────────────────────────────────

/**
 * 获取指定城市的天气
 * @param {string} [city] - 城市名（中文或英文），不传则用默认城市
 * @returns {Promise<object|null>}
 */
async function fetchWeather(city) {
  const resolvedCity = city || DEFAULT_CITY;
  const englishCity = CITY_MAP[resolvedCity] || resolvedCity;

  console.log(`[weather] 查询天气: ${resolvedCity} → ${englishCity}`);

  // 增加重试逻辑
  let result = null;
  let attempts = 0;
  while (attempts < 2 && !result) {
    if (attempts > 0) console.log(`[weather] 重试查询: ${englishCity} (第 ${attempts} 次)`);
    result = await fetchFromWttr(englishCity);
    attempts++;
  }

  if (result) {
    result.displayCity = resolvedCity;
    return result;
  }
  
  // 失败时不返回 null，返回错误对象
  return {
    error: true,
    message: '❌ 抱歉主人，天气阵法（wttr.in）暂时波动，请稍后再试。',
    displayCity: resolvedCity
  };
}

/**
 * 从用户消息中提取城市并查询天气
 * @param {string} userText - 用户原始消息
 * @returns {Promise<object|null>}
 */
async function fetchWeatherFromMessage(userText) {
  const city = extractCity(userText);
  return fetchWeather(city);
}

// ─── 导出 ───────────────────────────────────────────────────
module.exports = {
  fetchWeather,
  fetchWeatherFromMessage,
  extractCity,
  CITY_MAP,
  DEFAULT_CITY,
};
