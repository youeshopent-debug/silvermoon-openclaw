const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

// 尽量模拟 main.js 的环境
process.env.NODE_ENV = 'development';

const MAIN = path.resolve('main.js');

// 直接 require main.js 会启动 Telegram 等，不可取
// 用 child_process fork main.js，传参触发仅执行 buildMorningBrief
// 更好：直接提取相关函数

// 方法：写一段代码放入临时文件，require 相关模块，执行 buildMorningBrief
const code = `
const path = require('path');
const fs = require('fs');

// 设置全局
global.__dirname = __dirname;
global.__basedir = path.resolve('.');

// 拖入主模块函数
${fs.readFileSync(MAIN, 'utf8').match(/async function buildMorningBrief[\s\S]*?^async function runSilverMoonMorningBrief/m)[0]}

// 还需要 fetchText, fetchJson, getTzNow, formatYmd, formatTs, formatDate, readJsonSafe, writeFileSafe, loadUserProfile, getWeatherByCoords
// pickHeadline, pickWorldHeadlines, translateToChineseShort, safeChineseOnly
// fetchUsdMyr, fetchMetalsSpotUsd, fetchFredLatest, fetchCryptoUsd
// DOMParser, logError, logAt, BRIEF_CACHE_PATH, CRON_DIR, CONFIG

// 太难了，换思路
console.log('直接调 buildMorningBrief 需要太多依赖');
process.exit(1);
`;

fs.writeFileSync('scripts/_diag_temp.cjs', code);
console.log('Built diagnostic script');
