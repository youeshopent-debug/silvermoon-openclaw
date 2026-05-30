#!/usr/bin/env node
'use strict';

/**
 * auto-backup.js — 自动备份
 * 备份 .silvermoon_core/、data/、.env 到 backups/auto/YYYY-MM-DD_HHmmss/
 * 保留最近 7 个备份，删除更旧的
 * 用法: node scripts/auto-backup.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_ROOT = path.join(ROOT, 'backups', 'auto');

// 需要备份的源路径（相对 ROOT）
const SOURCES = ['.silvermoon_core', 'data', '.env'];

function timestampDir() {
  const now = new Date();
  const y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${M}-${d}_${h}${m}${s}`;
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  return true;
}

function cleanOldBackups(maxKeep = 7) {
  if (!fs.existsSync(BACKUP_ROOT)) return;

  const entries = fs.readdirSync(BACKUP_ROOT)
    .map(name => ({
      name,
      time: fs.statSync(path.join(BACKUP_ROOT, name)).mtimeMs
    }))
    .sort((a, b) => b.time - a.time); // 最新的在前

  if (entries.length <= maxKeep) return;

  const toDelete = entries.slice(maxKeep);
  for (const entry of toDelete) {
    const fullPath = path.join(BACKUP_ROOT, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`  [clean] 删除旧备份: ${entry.name}`);
  }
}

async function run() {
  console.log(`[auto-backup] 开始备份...`);

  const backupName = timestampDir();
  const targetDir = path.join(BACKUP_ROOT, backupName);

  if (!fs.existsSync(BACKUP_ROOT)) {
    fs.mkdirSync(BACKUP_ROOT, { recursive: true });
  }

  let copiedCount = 0;
  for (const rel of SOURCES) {
    const src = path.join(ROOT, rel);
    const dest = path.join(targetDir, rel);

    if (rel === '.env') {
      // .env 是文件，直接处理
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        copiedCount++;
        console.log(`  ✓ ${rel}`);
      } else {
        console.log(`  - ${rel} (不存在，跳过)`);
      }
    } else {
      // 目录
      if (copyRecursive(src, dest)) {
        copiedCount++;
        console.log(`  ✓ ${rel}/`);
      } else {
        console.log(`  - ${rel}/ (不存在，跳过)`);
      }
    }
  }

  if (copiedCount === 0) {
    // 没有任何东西可备份，清理空目录
    try { fs.rmdirSync(targetDir); } catch {}
    console.log('[auto-backup] 没有可备份的内容');
    return;
  }

  console.log(`\n[auto-backup] 备份完成: ${targetDir} (${copiedCount} 项)`);

  // 清理旧备份
  cleanOldBackups(7);

  // 发送成功通知
  try {
    const alert = require('./alert');
    await alert('success', 'auto-backup', `备份完成: ${backupName} (${copiedCount} 项)`);
  } catch (e) {
    // alert 不可用时不阻塞
    console.warn('[auto-backup] 通知发送失败:', e.message);
  }
}

// 主流程
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[auto-backup] 备份失败:', e);
      try {
        const alert = require('./alert');
        alert('failure', 'auto-backup', '备份失败', e);
      } catch {}
      process.exit(1);
    });
}

module.exports = { run };
