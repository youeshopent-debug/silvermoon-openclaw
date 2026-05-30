const https = require('https');
const fs = require('fs');
const path = require('path');

const GH_OWNER = 'HighMark-31';
const GH_REPO = 'TRAE-Skills';
const GH_BRANCH = 'main';
const TARGET = 'c:\\Users\\User\\.openclaw\\.trae\\skills\\trae-skills';

const CATEGORIES = ['ai_engineering','architecture','frontend','backend','testing','devops','security','mobile','code_management','documentation'];

function fetch(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: timeoutMs,
      rejectUnauthorized: false
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function fetchJson(url, timeoutMs = 30000) {
  return fetch(url, timeoutMs).then(d => { try { return JSON.parse(d); } catch(e) { throw new Error('JSON parse fail: ' + d.slice(0,200)); }});
}

function toSkillName(filePath) {
  const name = path.basename(filePath, '.md');
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bVs\b/i,'vs').replace(/\bAnd\b/i,'and').replace(/\bOf\b/i,'of').replace(/\bIn\b/i,'in');
}
function toSkillId(filePath) {
  return 'trae-skills-' + path.basename(filePath, '.md').replace(/_/g, '-').toLowerCase();
}
function findCategory(filePath) {
  for (const cat of CATEGORIES) if (filePath.startsWith(cat + '/')) return cat;
  return 'other';
}

async function main() {
  const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/trees/${GH_BRANCH}?recursive=1`;
  console.log('Fetching file tree from GitHub API (direct)...');
  const json = await fetchJson(apiUrl, 60000);
  const tree = json.tree;
  const mdFiles = tree.filter(item => item.type === 'blob' && item.path.endsWith('.md'));
  console.log(`Found ${mdFiles.length} .md files\n`);

  let success = 0, fail = 0;

  for (let i = 0; i < mdFiles.length; i++) {
    const file = mdFiles[i];
    const category = findCategory(file.path);
    const localFile = path.join(TARGET, category, file.path.replace(/\//g, '\\'));
    fs.mkdirSync(path.dirname(localFile), { recursive: true });

    const rawUrl = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${file.path}`;
    try {
      const content = await fetch(rawUrl, 30000);
      const titleLine = content.split('\n')[0].replace(/^#\s*Skill:\s*/i, '').replace(/^#\s*/i, '');
      const skillName = titleLine || toSkillName(file.path);
      const skillId = toSkillId(file.path);
      const skillMd = `---
name: ${skillId}
description: ${skillName} - TRAE-Skills reference guide
---

${content}`;
      fs.writeFileSync(localFile, skillMd, 'utf-8');
      success++;
      process.stdout.write(`\r[${i+1}/${mdFiles.length}] ✅ ${file.path}        `);
    } catch (e) {
      fail++;
      process.stdout.write(`\r[${i+1}/${mdFiles.length}] ❌ ${file.path} - ${e.message.slice(0,60)}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n\nDone! ${success} success, ${fail} failed out of ${mdFiles.length} total`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
