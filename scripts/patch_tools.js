const fs = require('fs');
const path = require('path');
const https = require('https');

const toolsPath = require.resolve(path.join(process.cwd(), 'lib', 'tools'));
let src = fs.readFileSync(toolsPath, 'utf8');

const idx = src.indexOf('async function toolCrawlee');
const endIdx = src.indexOf('async function toolDownloadFile');

const newFunc = `
async function toolCrawlee(args, ctx) {
  const urls = Array.isArray(args?.urls) ? args.urls : [String(args?.url || args?.urls || '').trim()].filter(Boolean);
  if (!urls.length) return { ok: false, reason: 'missing_url' };

  const results = [];
  const nonGithubUrls = [];

  for (const url of urls) {
    const match = url.match(/github\\.com\\/([^\\/]+)\\/([^\\/]+?)(?:\\/|\\?|$)/);
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\\.git$/, '');
      try {
        const [info, readme, contents] = await Promise.all([
          new Promise((ok, fail) => {
            https.get('https://api.github.com/repos/' + owner + '/' + repo, {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/vnd.github.v3+json'}}, (res) => {
              let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{ok(JSON.parse(d))}catch(e){fail(e)}});
            }).on('error', fail);
          }),
          new Promise((ok, fail) => {
            https.get('https://api.github.com/repos/' + owner + '/' + repo + '/readme', {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/vnd.github.v3.raw'}}, (res) => {
              let d=''; res.on('data',c=>d+=c); res.on('end',()=>ok(d));
            }).on('error', fail);
          }),
          new Promise((ok, fail) => {
            https.get('https://api.github.com/repos/' + owner + '/' + repo + '/contents', {headers:{'User-Agent':'Mozilla/5.0','Accept':'application/vnd.github.v3+json'}}, (res) => {
              let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{ok(JSON.parse(d))}catch(e){fail(e)}});
            }).on('error', fail);
          })
        ]);
        const dirTree = Array.isArray(contents) ? contents.map(f => (f.type === 'dir' ? '[dir] ' : '[file] ') + f.name).join('\\n') : '无法获取目录结构';
        results.push({
          url,
          title: info.full_name,
          textLength: (readme || '').length,
          text: '【仓库信息】名称: ' + info.full_name + '\\n描述: ' + (info.description || '') + '\\n星标: ' + info.stargazers_count + '\\n语言: ' + (info.language || '') + '\\n许可: ' + (info.license?.spdx_id || '') + '\\n\\n【目录结构】\\n' + dirTree + '\\n\\n【README】\\n' + (readme || '').substring(0, 8000),
          status: 'ok',
          method: 'github_api'
        });
      } catch (e) {
        results.push({ url, status: 'error', error: 'GitHub API 失败: ' + String(e?.message || e), method: 'github_api' });
      }
    } else {
      nonGithubUrls.push(url);
    }
  }

  if (nonGithubUrls.length > 0) {
    try {
      const { PlaywrightCrawler } = require('crawlee');
      const proxyUrl = 'http://127.0.0.1:7890';
      const crawler = new PlaywrightCrawler({
        proxyConfiguration: { proxyUrls: [proxyUrl] },
        requestHandler: async ({ page, request }) => {
          try {
            await page.waitForLoadState('networkidle', { timeout: 15000 });
            const text = await page.innerText('body');
            const title = await page.title();
            results.push({
              url: request.url,
              title,
              textLength: text.length,
              text: text.substring(0, 5000),
              status: 'ok',
              method: 'playwright'
            });
          } catch (err) {
            results.push({ url: request.url, status: 'error', error: err.message, method: 'playwright' });
          }
        },
        maxRequestsPerCrawl: nonGithubUrls.length,
        maxConcurrency: 2,
        headless: true,
        retryOnBlocked: true,
        retryOnBlockedCount: 2,
      });
      await crawler.run(nonGithubUrls);
    } catch (e) {
      return { ok: false, reason: 'crawlee_unavailable', error: String(e?.message || e), results };
    }
  }

  return { ok: true, results };
}
`;

const newSrc = src.substring(0, idx) + newFunc + src.substring(endIdx);
fs.writeFileSync(toolsPath, newSrc, 'utf8');
console.log('✅ toolCrawlee 已更新，GitHub 仓库走 API 直调');
