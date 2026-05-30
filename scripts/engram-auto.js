#!/usr/bin/env node
'use strict';

/**
 * engram-auto.js — Engram 定时观察
 * 读取 engram.yaml，扫描 sessions 目录下的最近会话文件（1小时内）
 * 调用 EngramEngine.observe() 处理
 * 适用于 CRON 或 schtasks 定时触发
 * 用法: node scripts/engram-auto.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const ENGRAM_YAML = path.join(ROOT, 'engram.yaml');

// 简易 YAML 解析（仅适配 engram.yaml 的扁平/两级结构）
function parseSimpleYaml(text) {
  const result = {};
  let currentKey = null;
  let currentObj = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trimEnd(); // 去除注释
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // 二级 key (缩进)
    const indentMatch = line.match(/^(\s+)(\S[^:]*?):\s*(.*)$/);
    if (indentMatch && currentObj !== null) {
      const [, , key, val] = indentMatch;
      if (val) {
        currentObj[key.trim()] = val.trim();
      } else {
        currentObj[key.trim()] = '';
      }
      continue;
    }

    // 一级 key
    const topMatch = line.match(/^(\S[^:]*?):\s*(.*)$/);
    if (topMatch) {
      const [, key, val] = topMatch;
      currentKey = key.trim();
      if (val) {
        result[currentKey] = val.trim();
        currentObj = null;
      } else {
        result[currentKey] = {};
        currentObj = result[currentKey];
      }
    }
  }
  return result;
}

// 展开 ~ 为用户 home 目录
function expandHome(p) {
  if (!p) return '';
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1).replace(/^[/\\]/, ''));
  }
  return path.resolve(ROOT, p);
}

// 尝试加载 EngramEngine
function loadEngramEngine() {
  const candidates = [
    path.join(ROOT, 'lib', 'engram-engine.js'),
    path.join(ROOT, 'lib', 'memory-palace.js'),
    path.join(ROOT, 'lib', 'memory.js'),
    path.join(ROOT, 'lib', 'reflection-engine.js'),
  ];
  for (const c of candidates) {
    try {
      const mod = require(c);
      if (mod && mod.EngramEngine) return mod.EngramEngine;
      if (mod && typeof mod.observe === 'function') return mod;
      // 如果模块整体有 observe 方法
      if (typeof mod === 'function' && mod.observe) return mod;
    } catch {
      continue;
    }
  }
  return null;
}

// 默认的 observe 实现：读取文件内容，输出摘要
function defaultObserve(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const summary = {
      path: filePath,
      size: content.length,
      lines: lines.length,
      preview: lines.slice(0, 5).join('\n').substring(0, 200)
    };
    return summary;
  } catch (e) {
    return { path: filePath, error: e.message };
  }
}

async function run() {
  // 读取 engram.yaml
  if (!fs.existsSync(ENGRAM_YAML)) {
    console.error('[engram-auto] engram.yaml 不存在');
    process.exit(1);
  }

  const yamlText = fs.readFileSync(ENGRAM_YAML, 'utf8');
  const config = parseSimpleYaml(yamlText);

  const scanDirRaw = config.sessions?.scan_dir || config['sessions.scan_dir'];
  const baseDirRaw = config.storage?.base_dir || config['storage.base_dir'];

  if (!scanDirRaw) {
    console.error('[engram-auto] engram.yaml 中未配置 sessions.scan_dir');
    process.exit(1);
  }

  const scanDir = expandHome(scanDirRaw);
  const baseDir = baseDirRaw ? expandHome(baseDirRaw) : null;

  console.log(`[engram-auto] 扫描目录: ${scanDir}`);
  if (baseDir) console.log(`[engram-auto] 存储目录: ${baseDir}`);

  if (!fs.existsSync(scanDir)) {
    console.log('[engram-auto] 扫描目录不存在');
    return;
  }

  // 获取 1 小时内的文件
  const cutoff = Date.now() - 60 * 60 * 1000;
  const allEntries = fs.readdirSync(scanDir);

  const recent = allEntries
    .map(name => ({ name, fullPath: path.join(scanDir, name) }))
    .filter(entry => {
      try {
        const stat = fs.statSync(entry.fullPath);
        return stat.isFile() && stat.mtimeMs >= cutoff;
      } catch {
        return false;
      }
    });

  if (recent.length === 0) {
    console.log('[engram-auto] 最近 1 小时内无新会话文件');
    return;
  }

  console.log(`[engram-auto] 发现 ${recent.length} 个新会话文件`);

  // 加载 EngramEngine
  const Engine = loadEngramEngine();
  const observeFn = Engine?.observe ? Engine.observe.bind(Engine) : null;

  let successCount = 0;
  let errorCount = 0;

  for (const entry of recent) {
    console.log(`  [observe] ${entry.name}`);
    try {
      if (observeFn) {
        const result = observeFn(entry.fullPath);
        if (result && typeof result.then === 'function') {
          await result;
        }
      } else {
        defaultObserve(entry.fullPath);
      }
      successCount++;
    } catch (e) {
      console.error(`    ✗ ${e.message}`);
      errorCount++;
    }
  }

  console.log(`\n[engram-auto] 完成: ${successCount} 成功, ${errorCount} 失败`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[engram-auto] 执行失败:', e);
      process.exit(1);
    });
}

module.exports = { run };
