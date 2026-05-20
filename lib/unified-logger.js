'use strict';

/**
 * unified-logger.js — 统一日志器
 * 标准化日志格式 + 级别过滤 + 多写入目标 + 自动轮转
 *
 * 格式: JSON 行存储，每行一条记录
 * {"ts":"2026-05-20T12:00:00.000Z","level":"INFO","module":"gateway","msg":"Server started","meta":{"port":18791}}
 *
 * 用法:
 *   const Logger = require('./lib/unified-logger');
 *   const log = new Logger({ name: 'gateway' });
 *   log.info('Server started', { port: 18791 });
 *   log.error('Task failed', { task: 'social', error: 'ETIMEDOUT' });
 *
 *   全局默认实例:
 *   const log = require('./lib/unified-logger').getDefault();
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── 级别常量 ──────────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// ─── 确保目录存在 ──────────────────────────────────────────

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

// ─── 脱敏工具 ──────────────────────────────────────────────

function maskSecrets(s) {
  const str = String(s || '');
  const re = /((token|secret|api[_-]?key|webhook[_-]?secret|password|bearer)\s*[:=]\s*)([^\s"'`$,;]{6,})/gi;
  return str.replace(re, (_, prefix) => `${prefix}***`);
}

class UnifiedLogger {
  /**
   * @param {Object} options
   * @param {string} options.name - 模块名（用于日志标识）
   * @param {string} [options.logDir] - 日志目录，默认 logs/
   * @param {string} [options.level='info'] - 最低日志级别
   * @param {number} [options.maxSize=52428800] - 单文件最大字节 (50MB)
   * @param {Array<{write:(entry:Object)=>void}>} [options.sinks] - 额外写入目标
   * @param {boolean} [options.console=true] - 是否同时输出到控制台
   */
  constructor(options = {}) {
    this._name = options.name || 'app';
    this._logDir = options.logDir || path.resolve(__dirname, '..', 'logs');
    this._level = (LEVELS[options.level] !== undefined) ? options.level : 'info';
    this._levelNum = LEVELS[this._level];
    this._maxSize = options.maxSize || 50 * 1024 * 1024;
    this._sinks = Array.isArray(options.sinks) ? options.sinks : [];
    this._console = options.console !== false;

    // 日志文件路径: logs/gateway.log
    ensureDir(this._logDir);
    this._filePath = path.join(this._logDir, this._name + '.log');

    // 缓存文件句柄，避免频繁 open/close
    this._fd = null;
    this._open();
  }

  // ─── 内部: 打开文件句柄 ────────────────────────────────

  _open() {
    try {
      this._fd = fs.openSync(this._filePath, 'a');
    } catch (e) {
      console.error(`[unified-logger] 无法打开日志文件 ${this._filePath}: ${e.message}`);
      this._fd = null;
    }
  }

  // ─── 内部: 关闭文件句柄 ────────────────────────────────

  _close() {
    if (this._fd !== null) {
      try { fs.closeSync(this._fd); } catch { /* ignore */ }
      this._fd = null;
    }
  }

  // ─── 级别快捷方法 ────────────────────────────────────────

  debug(msg, meta) { this._log('debug', msg, meta); }
  info(msg, meta)  { this._log('info', msg, meta); }
  warn(msg, meta)  { this._log('warn', msg, meta); }
  error(msg, meta) { this._log('error', msg, meta); }

  // ─── 核心日志方法 ────────────────────────────────────────

  _log(level, msg, meta) {
    const levelNum = LEVELS[level];
    if (levelNum < this._levelNum) return; // 级别过低，跳过

    const entry = {
      ts: new Date().toISOString(),
      level: level.toUpperCase(),
      module: this._name,
      msg: String(msg),
      meta: meta !== undefined ? this._sanitizeMeta(meta) : undefined,
    };

    // 写入文件
    this._writeFile(entry);

    // 写入额外 sink
    for (const sink of this._sinks) {
      try { sink.write(entry); } catch { /* ignore sink error */ }
    }

    // 控制台输出
    if (this._console) {
      this._writeConsole(entry);
    }
  }

  // ─── 元数据脱敏 ──────────────────────────────────────────

  _sanitizeMeta(meta) {
    if (meta === null || meta === undefined) return undefined;
    if (typeof meta === 'object') {
      // 不修改原对象，返回脱敏副本
      try {
        const raw = JSON.stringify(meta);
        const masked = maskSecrets(raw);
        return JSON.parse(masked);
      } catch {
        return { ok: false, error: 'meta_serialize_failed' };
      }
    }
    return meta;
  }

  // ─── 写入文件（JSON 行格式） ─────────────────────────────

  _writeFile(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      if (this._fd === null) {
        this._open();
      }
      if (this._fd !== null) {
        fs.writeSync(this._fd, line);
        this._rotateIfNeeded();
      }
    } catch (e) {
      console.error(`[unified-logger] 文件写入失败: ${e.message}`);
      // 写入失败时降级到控制台
      this._writeConsole(entry);
    }
  }

  // ─── 控制台输出 ──────────────────────────────────────────

  _writeConsole(entry) {
    const prefix = `[${entry.ts}] ${entry.level} [${entry.module}]`;
    const suffix = entry.meta ? ' ' + maskSecrets(JSON.stringify(entry.meta)) : '';
    switch (entry.level) {
      case 'ERROR':
        console.error(`${prefix} ${entry.msg}${suffix}`);
        break;
      case 'WARN':
        console.warn(`${prefix} ${entry.msg}${suffix}`);
        break;
      default:
        console.log(`${prefix} ${entry.msg}${suffix}`);
    }
  }

  // ─── 文件轮转 ──────────────────────────────────────────

  _rotateIfNeeded() {
    try {
      const stat = fs.statSync(this._filePath);
      if (stat.size <= this._maxSize) return;

      // 关闭当前文件句柄
      this._close();

      // 创建归档目录 logs/archive/YYYY-MM-DD/
      const now = new Date();
      const y = now.getFullYear();
      const M = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const archiveDir = path.join(this._logDir, 'archive', `${y}-${M}-${d}`);
      ensureDir(archiveDir);

      const basename = path.basename(this._filePath);
      const destGz = path.join(archiveDir, basename + '.gz');

      // gzip 压缩
      const reader = fs.createReadStream(this._filePath);
      const writer = fs.createWriteStream(destGz);
      const gzip = zlib.createGzip({ level: 6 });

      reader.pipe(gzip).pipe(writer);

      writer.on('finish', () => {
        try {
          // 压缩成功后清空原文件
          fs.writeFileSync(this._filePath, '', 'utf8');
          console.log(`[unified-logger] 轮转完成: ${basename} → archive/${y}-${M}-${d}/${basename}.gz`);
        } catch (e) {
          console.error(`[unified-logger] 轮转清空失败: ${e.message}`);
        }
        // 重新打开
        this._open();
      });

      writer.on('error', (e) => {
        console.error(`[unified-logger] 轮转压缩失败: ${e.message}，降级为清空`);
        try {
          fs.writeFileSync(this._filePath, '', 'utf8');
        } catch { /* ignore */ }
        this._open();
      });

    } catch (e) {
      console.error(`[unified-logger] 轮转检查失败: ${e.message}`);
      // 确保文件可写
      if (this._fd === null) this._open();
    }
  }

  // ─── 读取日志条目 ────────────────────────────────────────

  /**
   * @param {Object} [filter]
   * @param {string} [filter.level] - 过滤级别: debug|info|warn|error
   * @param {number} [filter.limit=100]
   * @param {number} [filter.offset=0]
   * @returns {Array<Object>}
   */
  getEntries(filter = {}) {
    try {
      if (!fs.existsSync(this._filePath)) return [];

      const raw = fs.readFileSync(this._filePath, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      let entries = lines.map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);

      // 级别过滤
      if (filter.level) {
        const lvl = filter.level.toUpperCase();
        entries = entries.filter(e => e.level === lvl);
      }

      const limit = filter.limit || 100;
      const offset = filter.offset || 0;
      return entries.slice(offset, offset + limit);
    } catch (e) {
      console.error(`[unified-logger] 读取失败: ${e.message}`);
      return [];
    }
  }

  // ─── 设置日志级别（运行时动态调整） ─────────────────────

  setLevel(level) {
    if (LEVELS[level] !== undefined) {
      this._level = level;
      this._levelNum = LEVELS[level];
      this.info('日志级别已变更', { newLevel: level });
      return true;
    }
    return false;
  }

  // ─── 关闭日志器 ────────────────────────────────────────

  close() {
    this._close();
  }

  // ─── 获取日志文件路径 ──────────────────────────────────

  getFilePath() {
    return this._filePath;
  }
}

// ─── 全局默认实例（懒加载） ────────────────────────────────

let _defaultInstance = null;

function getDefault() {
  if (!_defaultInstance) {
    _defaultInstance = new UnifiedLogger({ name: 'app' });
  }
  return _defaultInstance;
}

module.exports = UnifiedLogger;
module.exports.getDefault = getDefault;
module.exports.LEVELS = LEVELS;
