const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const CASHCLAW_DIR = path.join(ROOT, 'workspace', 'CASHCLAW');
const CRON_DIR = path.join(ROOT, 'workspace', 'CRON');
const REPORT_DIR = path.join(CASHCLAW_DIR, 'reports');
const STAGE_DIR = path.join(CRON_DIR, 'pipeline_stages');
const DISPATCH_FILE = path.join(ROOT, '.silvermoon_core', 'dispatched_tasks.jsonl');

[CASHCLAW_DIR, CRON_DIR, REPORT_DIR, STAGE_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function latestTrendReport() {
  const ymd = today();
  const fp = path.join(REPORT_DIR, `trend_report_${ymd}.md`);
  if (fs.existsSync(fp)) return fp;
  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.startsWith('trend_report_'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  const best = files[0];
  const ts = best.replace('trend_report_', '').replace('.md', '');
  if (Math.abs(new Date(ts).getTime() - Date.now()) > 3 * 24 * 60 * 60 * 1000) return null;
  return path.join(REPORT_DIR, best);
}

function writeStageOutput(stageName, data) {
  const fp = path.join(STAGE_DIR, `${stageName}_${today()}.json`);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  return fp;
}

function readStageOutput(stageName) {
  const fp = path.join(STAGE_DIR, `${stageName}_${today()}.json`);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeDispatchEntry(target, task, priority = 'medium', source = 'pipeline') {
  const entry = JSON.stringify({
    at: new Date().toISOString(),
    target, task, priority,
    status: 'pending',
    source
  });
  fs.appendFileSync(DISPATCH_FILE, entry + '\n', 'utf-8');
}

module.exports = {
  ROOT, CASHCLAW_DIR, CRON_DIR, REPORT_DIR, STAGE_DIR, DISPATCH_FILE,
  today, latestTrendReport, writeStageOutput, readStageOutput, writeDispatchEntry
};
