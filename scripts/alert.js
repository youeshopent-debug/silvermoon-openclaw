#!/usr/bin/env node
'use strict';

/**
 * alert.js — 异常告警系统
 * 支持命令行调用和模块调用
 * node scripts/alert.js success|failure <module> <message> [error]
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');

// 读取配置
function loadConfig() {
  const configPath = path.join(ROOT, 'openclaw.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

// 从 openclaw.json 获取 telegram bot token 和 channelId
function getTelegramConfig() {
  const config = loadConfig();
  const tg = config.channels && config.channels.telegram;
  // channelId: 从 commands.ownerAllowFrom 解析
  const ownerFrom = config.commands && config.commands.ownerAllowFrom;
  let channelId = null;
  if (Array.isArray(ownerFrom)) {
    for (const entry of ownerFrom) {
      const m = entry.match(/^telegram:(\d+)$/);
      if (m) { channelId = m[1]; break; }
    }
  }
  return {
    botToken: (tg && tg.botToken) || process.env.TELEGRAM_BOT_TOKEN || '',
    channelId: channelId || process.env.TELEGRAM_CHANNEL_ID || ''
  };
}

// 读取最近的日志片段（最后 N 行）
function getRecentLogSnippet(maxLines = 20) {
  const logsDir = path.join(ROOT, 'logs');
  if (!fs.existsSync(logsDir)) return '';
  try {
    const files = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(logsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);
    if (files.length === 0) return '';
    const latest = path.join(logsDir, files[0].name);
    const content = fs.readFileSync(latest, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const tail = lines.slice(-maxLines);
    return `\`\`\`\n${files[0].name} (tail ${tail.length}):\n${tail.join('\n')}\n\`\`\``;
  } catch {
    return '';
  }
}

// 发送 Telegram 消息
function sendTelegram(botToken, chatId, text) {
  return new Promise((resolve, reject) => {
    if (!botToken || !chatId) {
      console.warn('[alert] TELEGRAM_BOT_TOKEN 或 channelId 未配置，跳过通知');
      return resolve(false);
    }
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    const opts = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.ok === true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', (e) => {
      console.warn('[alert] Telegram 发送失败:', e.message);
      resolve(false);
    });
    req.setTimeout(10000, () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

// 核心告警函数
async function alert(type, module, message, error) {
  const now = new Date().toISOString();
  const { botToken, channelId } = getTelegramConfig();

  let text = '';
  if (type === 'failure') {
    const logSnippet = getRecentLogSnippet();
    text = [
      `🚨 <b>[${module}] 异常告警</b>`,
      `🕐 ${now}`,
      `📌 ${message}`,
      error ? `\n<pre>${error.stack || error}</pre>` : '',
      logSnippet ? `\n📋 最近日志：\n${logSnippet}` : ''
    ].join('\n');
  } else {
    // success 类型，检查是否被 suppress
    if (process.env.SUPPRESS_SUCCESS_ALERTS === '1' || process.env.SUPPRESS_SUCCESS_ALERTS === 'true') {
      console.log(`[alert] success suppressed: [${module}] ${message}`);
      return true;
    }
    text = `✅ <b>[${module}] 完成</b>\n🕐 ${now}\n📌 ${message}`;
  }

  // 控制台输出
  console.log(`[alert] ${type.toUpperCase()} [${module}] ${message}`);
  if (error) console.error(error);

  // 发送 Telegram
  const sent = await sendTelegram(botToken, channelId, text);
  return sent;
}

// 命令行入口
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.length < 3) {
      console.error('用法: node scripts/alert.js <success|failure> <module> <message> [error]');
      process.exit(1);
    }
    const [type, mod, msg, ...errParts] = args;
    const error = errParts.length > 0 ? errParts.join(' ') : undefined;
    try {
      await alert(type, mod, msg, error);
    } catch (e) {
      console.error('[alert] 告警函数出错:', e);
      process.exit(1);
    }
  })();
}

module.exports = alert;
