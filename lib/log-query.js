'use strict';

/**
 * log-query.js — 日志查询工具
 * 按时间/级别/模块/关键词检索日志，自动解压 .gz 归档
 *
 * 支持的日志格式:
 *   - unified-logger JSON 行格式: {"ts":"...","level":"INFO","module":"...","msg":"...","meta":{...}}
 *   - 兼容旧版文本格式: [2026-05-20T12:00:00.000Z] INFO [module] message
 *
 * 用法:
 *   const LogQuery = require('./lib/log-query');
 *   const lq = new LogQuery('./logs');
 *   const errors = lq.query({ level: 'error', since: '2026-05-19', limit: 50 });
 *   const stats = lq.stats({ since: '2026-05-01' });
 *   const tail = lq.tail(20);
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

class LogQuery {
  /**
   * @param {string} logDir - 日志目录路径
   */
  constructor(logDir) {
    this._logDir = path.resolve(logDir || path.join(__dirname, '..', 'logs'));
  }

  // ─── 查询日志 ──────────────────────────────────────────

  /**
   * @param {Object} options
   * @param {string} [options.level] - 过滤级别 (debug/info/warn/error)
   * @param {string} [options.module] - 过滤模块名 (gateway/cron/social 等)
   * @param {string|Date} [options.since] - 起始时间 (ISO字符串或Date)
   * @param {string|Date} [options.until] - 结束时间
   * @param {string} [options.keyword] - 关键词搜索
   * @param {number} [options.limit=100] - 最大返回条数
   * @param {number} [options.offset=0] - 偏移
   * @param {string} [options.file] - 指定文件名 (默认扫描所有 .log)
   * @returns {Array<Object>} 匹配的日志条目
   */
  query(options = {}) {
    const level = options.level ? options.level.toUpperCase() : null;
    const module = options.module || null;
    const keyword = options.keyword || null;
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    let sinceMs = null;
    let untilMs = null;

    if (options.since) {
      sinceMs = options.since instanceof Date ? options.since.getTime() : new Date(options.since).getTime();
    }
    if (options.until) {
      untilMs = options.until instanceof Date ? options.until.getTime() : new Date(options.until).getTime();
    }

    const logFiles = this._getLogFiles(options.file);
    const results = [];

    for (const filePath of logFiles) {
      const entries = this._readFile(filePath);
      for (const entry of entries) {
        // 级别过滤
        if (level && entry.level !== level) continue;

        // 模块过滤
        if (module && entry.module !== module) continue;

        // 时间范围过滤
        const tsMs = new Date(entry.ts).getTime();
        if (sinceMs !== null && tsMs < sinceMs) continue;
        if (untilMs !== null && tsMs > untilMs) continue;

        // 关键词搜索
        if (keyword) {
          const kw = keyword.toLowerCase();
          const msgMatch = entry.msg && entry.msg.toLowerCase().includes(kw);
          const metaMatch = entry.meta && JSON.stringify(entry.meta).toLowerCase().includes(kw);
          if (!msgMatch && !metaMatch) continue;
        }

        results.push(entry);
      }
    }

    // 按时间升序排列
    results.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    return results.slice(offset, offset + limit);
  }

  // ─── 快捷全文检索 ──────────────────────────────────────

  /**
   * @param {string} keyword - 搜索关键词
   * @param {Object} [options] - 同 query 的 options
   * @returns {Array<Object>}
   */
  search(keyword, options = {}) {
    return this.query({ ...options, keyword });
  }

  // ─── 统计摘要 ──────────────────────────────────────────

  /**
   * @param {Object} [options] - 过滤选项，同 query 的 since/until/file
   * @returns {Object} { total, byLevel, byModule, timeRange }
   */
  stats(options = {}) {
    const logFiles = this._getLogFiles(options.file);
    const byLevel = {};
    const byModule = {};
    let total = 0;
    let minTs = null;
    let maxTs = null;

    for (const filePath of logFiles) {
      const entries = this._readFile(filePath);
      for (const entry of entries) {
        // 时间范围过滤
        if (options.since) {
          const sinceMs = options.since instanceof Date ? options.since.getTime() : new Date(options.since).getTime();
          if (new Date(entry.ts).getTime() < sinceMs) continue;
        }
        if (options.until) {
          const untilMs = options.until instanceof Date ? options.until.getTime() : new Date(options.until).getTime();
          if (new Date(entry.ts).getTime() > untilMs) continue;
        }

        total++;
        const lvl = entry.level || 'UNKNOWN';
        byLevel[lvl] = (byLevel[lvl] || 0) + 1;

        const mod = entry.module || 'unknown';
        byModule[mod] = (byModule[mod] || 0) + 1;

        const tsMs = new Date(entry.ts).getTime();
        if (minTs === null || tsMs < minTs) minTs = tsMs;
        if (maxTs === null || tsMs > maxTs) maxTs = tsMs;
      }
    }

    return {
      total,
      byLevel,
      byModule,
      timeRange: {
        from: minTs ? new Date(minTs).toISOString() : null,
        to: maxTs ? new Date(maxTs).toISOString() : null,
      },
    };
  }

  // ─── 尾部读取 ──────────────────────────────────────────

  /**
   * @param {number} [lines=20] - 返回末尾行数
   * @param {string} [file] - 指定文件名
   * @returns {Array<Object>}
   */
  tail(lines = 20, file) {
    const logFiles = this._getLogFiles(file);
    if (logFiles.length === 0) return [];

    // 只读最近修改的文件
    const latestFile = logFiles.sort((a, b) => {
      return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
    })[0];

    const entries = this._readFile(latestFile);
    return entries.slice(-lines);
  }

  // ─── 获取日志文件列表 ──────────────────────────────────

  _getLogFiles(specificFile) {
    if (specificFile) {
      const fp = path.join(this._logDir, specificFile);
      return fs.existsSync(fp) ? [fp] : [];
    }

    const files = [];
    try {
      const entries = fs.readdirSync(this._logDir);
      for (const name of entries) {
        if (name.endsWith('.log')) {
          files.push(path.join(this._logDir, name));
        }
      }
    } catch {
      // 目录不存在
    }

    // 扫描归档目录中的 .gz 文件
    const archiveDir = path.join(this._logDir, 'archive');
    try {
      if (fs.existsSync(archiveDir)) {
        const dateDirs = fs.readdirSync(archiveDir);
        for (const dateDir of dateDirs) {
          const datePath = path.join(archiveDir, dateDir);
          if (!fs.statSync(datePath).isDirectory()) continue;
          const archived = fs.readdirSync(datePath);
          for (const name of archived) {
            if (name.endsWith('.log.gz')) {
              files.push(path.join(datePath, name));
            }
          }
        }
      }
    } catch {
      // 归档目录可能不存在
    }

    return files;
  }

  // ─── 读取文件（自动解压 .gz） ──────────────────────────

  _readFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) return [];

      let raw;
      if (filePath.endsWith('.gz')) {
        const compressed = fs.readFileSync(filePath);
        raw = zlib.gunzipSync(compressed).toString('utf8');
      } else {
        // 大文件只读尾部 10MB
        const stat = fs.statSync(filePath);
        if (stat.size > 10 * 1024 * 1024) {
          const fd = fs.openSync(filePath, 'r');
          const buf = Buffer.alloc(10 * 1024 * 1024);
          const bytesRead = fs.readSync(fd, buf, 0, buf.length, Math.max(0, stat.size - buf.length));
          fs.closeSync(fd);
          raw = buf.slice(0, bytesRead).toString('utf8');
        } else {
          raw = fs.readFileSync(filePath, 'utf8');
        }
      }

      const lines = raw.split('\n').filter(Boolean);
      return lines.map(line => this._parseLine(line)).filter(Boolean);
    } catch (e) {
      console.error(`[log-query] 读取失败 ${filePath}: ${e.message}`);
      return [];
    }
  }

  // ─── 解析单行日志 ──────────────────────────────────────

  _parseLine(line) {
    // 尝试 JSON 解析（unified-logger 格式）
    if (line.startsWith('{')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.ts && parsed.level) {
          return {
            ts: parsed.ts,
            level: parsed.level.toUpperCase(),
            module: parsed.module || 'unknown',
            msg: parsed.msg || '',
            meta: parsed.meta || null,
            _raw: line,
          };
        }
      } catch {
        // 不是 JSON，继续尝试文本格式
      }
    }

    // 兼容旧文本格式: [2026-05-20T12:00:00.000Z] INFO [module] message
    const textRe = /^\[([^\]]+)\]\s+(\w+)\s+\[([^\]]+)\]\s+(.*)$/;
    const textMatch = line.match(textRe);
    if (textMatch) {
      return {
        ts: textMatch[1],
        level: textMatch[2].toUpperCase(),
        module: textMatch[3],
        msg: textMatch[4],
        meta: null,
        _raw: line,
      };
    }

    // 兜底：返回带时间戳的通用格式
    const anyTsRe = /^\[?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/;
    const anyMatch = line.match(anyTsRe);
    if (anyMatch) {
      return {
        ts: anyMatch[1] + 'Z',
        level: 'INFO',
        module: 'unknown',
        msg: line,
        meta: null,
        _raw: line,
      };
    }

    // 完全无法解析
    return null;
  }

  // ─── 列出可用的日志文件 ────────────────────────────────

  listFiles() {
    const files = this._getLogFiles();
    return files
      .map(fp => {
        try {
          const stat = fs.statSync(fp);
          return {
            name: path.relative(this._logDir, fp),
            path: fp,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            isGz: fp.endsWith('.gz'),
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
  }
}

module.exports = LogQuery;
