'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '.silvermoon_core', 'github_releases.json');
const DISPATCH_FILE = path.join(__dirname, '..', '.silvermoon_core', 'dispatched_tasks.jsonl');

const WATCH_REPOS = [
  { owner: 'n8n-io', repo: 'n8n', target: '银月', tag: 'n8n 新版本' },
  { owner: 'Zie619', repo: 'n8n-workflows', target: '银月', tag: 'n8n-workflows 更新' },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: url,
      headers: { 'User-Agent': 'OpenClaw/1.0', Accept: 'application/vnd.github.v3+json' },
      timeout: 15000,
    };
    https.get(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch (_) {}
  return {};
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function dispatchTask(target, task, priority) {
  const entry = JSON.stringify({
    at: new Date().toISOString(),
    target,
    task,
    priority: priority || 'low',
    status: 'pending',
    source: 'github-release-watch',
  }) + '\n';
  fs.mkdirSync(path.dirname(DISPATCH_FILE), { recursive: true });
  fs.appendFileSync(DISPATCH_FILE, entry, 'utf-8');
  console.log(`[github-release-watch] 已派发任务 -> ${target}: ${task.slice(0, 60)}...`);
}

async function run() {
  const state = loadState();
  const now = new Date().toISOString().slice(0, 10);
  let found = 0;

  for (const repo of WATCH_REPOS) {
    const key = `${repo.owner}/${repo.repo}`;
    try {
      const releases = await fetchJson(`/repos/${repo.owner}/${repo.repo}/releases?per_page=1`);
      if (!Array.isArray(releases) || releases.length === 0) {
        console.log(`[github-release-watch] ${key}: 无 release`);
        continue;
      }
      const latest = releases[0].tag_name || releases[0].name || 'unknown';
      const prev = state[key] || '';
      if (latest !== prev) {
        const releaseUrl = releases[0].html_url || `https://github.com/${key}/releases/tag/${latest}`;
        const taskDesc = `${repo.tag}：${latest}\n${releaseUrl}\n发布于 ${(releases[0].published_at || '').slice(0, 10)}`;
        dispatchTask(repo.target, taskDesc, 'low');
        state[key] = latest;
        state[`${key}_last_check`] = now;
        found++;
      } else {
        console.log(`[github-release-watch] ${key}: 无更新 (${latest})`);
      }
    } catch (err) {
      console.error(`[github-release-watch] ${key} 检查失败: ${err.message}`);
    }
  }

  saveState(state);
  console.log(`[github-release-watch] 完成: 发现 ${found} 个新版本`);
  return { checked: WATCH_REPOS.length, found };
}

if (require.main === module) {
  run().then((r) => {
    console.log(JSON.stringify(r));
    process.exit(0);
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

module.exports = { run };
