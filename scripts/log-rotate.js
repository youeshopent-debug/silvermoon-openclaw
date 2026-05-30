#!/usr/bin/env node
'use strict';

/**
 * log-rotate.js — 日志轮转
 * 扫描 logs/ 目录下所有 *.log 文件，超过 50MB 的压缩归档到 logs/archive/YYYY-MM-DD/
 * 保留最近 7 天的归档
 * 用法: node scripts/log-rotate.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const ARCHIVE_DIR = path.join(LOG_DIR, 'archive');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const RETENTION_DAYS = 7;

function todayDir() {
  const now = new Date();
  const y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${M}-${d}`;
}

function gzipFile(srcPath, destPath) {
  return new Promise((resolve, reject) => {
    const reader = fs.createReadStream(srcPath);
    const writer = fs.createWriteStream(destPath);
    const gzip = zlib.createGzip({ level: 6 });

    reader.pipe(gzip).pipe(writer);

    writer.on('finish', () => resolve(true));
    writer.on('error', (e) => reject(e));
    reader.on('error', (e) => reject(e));
    gzip.on('error', (e) => reject(e));
  });
}

function isOlderThanDays(filePath, days) {
  try {
    const stat = fs.statSync(filePath);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return stat.mtimeMs < cutoff;
  } catch {
    return true;
  }
}

async function run() {
  if (!fs.existsSync(LOG_DIR)) {
    console.log('[log-rotate] logs/ 目录不存在');
    return;
  }

  const logFiles = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.log'))
    .map(f => path.join(LOG_DIR, f));

  if (logFiles.length === 0) {
    console.log('[log-rotate] 没有需要处理的日志文件');
    return;
  }

  const dateStr = todayDir();
  const todayArchiveDir = path.join(ARCHIVE_DIR, dateStr);
  let rotatedCount = 0;

  for (const filePath of logFiles) {
    const stat = fs.statSync(filePath);
    if (stat.size <= MAX_FILE_SIZE) {
      continue; // 文件大小未超标
    }

    const basename = path.basename(filePath);
    const destGz = path.join(todayArchiveDir, basename + '.gz');
    const destRotate = path.join(todayArchiveDir, basename + '.rotate');

    fs.mkdirSync(todayArchiveDir, { recursive: true });

    console.log(`  [rotate] ${basename} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);

    try {
      // 先尝试 gzip 压缩
      await gzipFile(filePath, destGz);
      // 压缩成功后删除源文件
      fs.unlinkSync(filePath);
      console.log(`    → 已压缩归档: ${basename}.gz`);
    } catch (e) {
      // gzip 失败（如磁盘空间不足），降级为重命名 + .rotate 后缀
      console.warn(`    ⚠ gzip 失败: ${e.message}，降级为 .rotate`);
      try {
        // 清空原文件而不是重命名（保留文件以便继续写入）
        // 改成：将原文件重命名，新建空白文件
        fs.renameSync(filePath, destRotate);
        // 创建新的空文件替代
        fs.writeFileSync(filePath, '', 'utf8');
        console.log(`    → 已旋转: ${basename} → ${basename}.rotate`);
      } catch (e2) {
        console.error(`    ✗ 旋转失败: ${e2.message}`);
        continue;
      }
    }
    rotatedCount++;
  }

  // 清理超过 7 天的归档
  if (fs.existsSync(ARCHIVE_DIR)) {
    const archives = fs.readdirSync(ARCHIVE_DIR)
      .map(name => path.join(ARCHIVE_DIR, name));

    for (const dirPath of archives) {
      if (!fs.statSync(dirPath).isDirectory()) continue;
      if (isOlderThanDays(dirPath, RETENTION_DAYS)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`  [clean] 删除过期归档: ${path.basename(dirPath)}`);
      }
    }
  }

  console.log(`\n[log-rotate] 完成: ${rotatedCount} 个文件已旋转`);

  // 发送通知
  if (rotatedCount > 0) {
    try {
      const alert = require('./alert');
      await alert('success', 'log-rotate', `日志轮转完成: ${rotatedCount} 个文件`);
    } catch (e) {
      console.warn('[log-rotate] 通知发送失败:', e.message);
    }
  }
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[log-rotate] 轮转失败:', e);
      try {
        const alert = require('./alert');
        alert('failure', 'log-rotate', '日志轮转失败', e);
      } catch {}
      process.exit(1);
    });
}

module.exports = { run };
