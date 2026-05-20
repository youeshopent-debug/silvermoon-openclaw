const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

let bot = null;
let _onMessageCb = null;
let _started = false;
let _starting = false;
let _onVoiceCb = null;
let _agentBots = [];
let _agents = [];
let _getHandler = null;

const TMP_DIR = path.join(__dirname, '..', 'tmp', 'tg_voice');
const TTS_DIR = path.join(__dirname, '..', 'tmp', 'tg_tts');
const _logDir = path.join(__dirname, '..', 'logs');
const UPDATE_ID_PATH = path.join(_logDir, 'tg-update-id.json');

function ensureDir(d) {
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch {}
}

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function clearWebhook(token) {
  return new Promise((resolve) => {
    const url = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({ ok: false }); }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

function withTimeout(promise, ms, errorMsg) {
  let timer;
  const timeoutPromise = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function sanitizeTelegramMarkdown(text) {
  const boldPairs = (text.match(/\*\*/g) || []).length;
  const italicPairs = (text.match(/(?<!\*)_(?!\*)/g) || []).length;
  const codePairs = (text.match(/`/g) || []).length;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;
  const hasDashLine = /^-{3,}/m.test(text);
  if (boldPairs % 2 !== 0 || italicPairs % 2 !== 0 || codePairs % 2 !== 0 || openBrackets !== closeBrackets || hasDashLine) {
    return text.replace(/[*_`\[\]]/g, '').replace(/^-{3,}/gm, '───');
  }
  return text;
}

function buildProxyEnv() {
  try {
    if (String(process.env.NODE_ENV || '').trim() === 'production') return {};
    const proxy =
      String(process.env.OPENCLAW_PROXY_URL || '').trim() ||
      String(process.env.PROXY_URL || '').trim() ||
      String(process.env.HTTP_PROXY || '').trim() ||
      String(process.env.HTTPS_PROXY || '').trim() ||
      'http://127.0.0.1:7890';
    if (!proxy) return {};
    return {
      HTTP_PROXY: process.env.HTTP_PROXY || proxy,
      HTTPS_PROXY: process.env.HTTPS_PROXY || proxy,
      ALL_PROXY: process.env.ALL_PROXY || proxy,
    };
  } catch {
    return {};
  }
}

// ── update_id 持久化：断点续传 ──
function loadUpdateId() {
  try {
    if (!require('fs').existsSync(UPDATE_ID_PATH)) return null;
    const raw = require('fs').readFileSync(UPDATE_ID_PATH, 'utf8');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d?.update_id ? d.update_id : null;
  } catch { return null; }
}
function saveUpdateId(updateId) {
  if (!updateId) return;
  try {
    require('fs').writeFileSync(UPDATE_ID_PATH, JSON.stringify({ update_id: updateId, ts: Date.now() }), 'utf8');
  } catch {}
}

// ── Bot 健康探活 ──
async function healthCheck() {
  if (!_started || !bot) return false;
  try {
    const me = await withTimeout(bot.getMe(), 10_000, 'healthCheck timeout');
    return !!(me && me.id);
  } catch (e) {
    console.error('[telegram-bridge] healthCheck 失败:', e?.message || e);
    return false;
  }
}

// ── 全量 Bot 重启（级联兜底） ──
async function restartAllBots() {
  console.log('[telegram-bridge] 🚨 全量 Bot 重启开始');
  stopAgentBots();
  stopTelegramBridge();
  await new Promise(r => setTimeout(r, 2000));
  ensureDir(_logDir);
  const mainResult = startTelegramBridge(_onMessageCb, _onVoiceCb);
  if (_agents.length > 0) {
    await new Promise(r => setTimeout(r, 3000));
    startAgentBots(_agents, _getHandler);
  }
  console.log('[telegram-bridge] 🚨 全量 Bot 重启完成');
  return mainResult;
}

async function downloadTelegramFile(fileId) {
  if (!bot) throw new Error('bot not started');
  const link = await bot.getFileLink(fileId);
  if (!link) throw new Error('getFileLink returned empty');
  const resp = await fetch(link, {
    headers: { 'User-Agent': 'openclaw/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`download HTTP ${resp.status}`);
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function transcribeBuffer(buf, filename, mime) {
  const ZERO_TOKEN_BASE_URL = String(process.env.OPENCLAW_ZERO_TOKEN_URL || '').trim();
  const ZERO_TOKEN_GATEWAY_TOKEN = String(process.env.OPENCLAW_ZERO_TOKEN || '').trim();
  const model = String(process.env.OPENCLAW_STT_MODEL || 'whisper-1').trim() || 'whisper-1';

  if (ZERO_TOKEN_BASE_URL) {
    const base = ZERO_TOKEN_BASE_URL.replace(/\/+$/g, '');
    const key = ZERO_TOKEN_GATEWAY_TOKEN;
    const t = await callOpenAiTranscription(`${base}/v1/audio/transcriptions`, key, model, buf, filename, mime);
    if (t) return t;
  }

  if (process.env.OPENROUTER_API_KEY) {
    const t = await callOpenAiTranscription('https://openrouter.ai/api/v1/audio/transcriptions', String(process.env.OPENROUTER_API_KEY).trim(), 'openai/whisper-large-v3', buf, filename, mime);
    if (t) return t;
  }

  if (process.env.OPENAI_API_KEY) {
    const base = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com').trim().replace(/\/+$/g, '');
    const t = await callOpenAiTranscription(`${base}/v1/audio/transcriptions`, String(process.env.OPENAI_API_KEY).trim(), model, buf, filename, mime);
    if (t) return t;
  }

  return null;
}

async function callOpenAiTranscription(endpoint, apiKey, model, buf, filename, mime) {
  const url = String(endpoint || '').trim();
  if (!url) return null;
  const fd = new FormData();
  fd.append('model', String(model || 'whisper-1'));
  fd.append('file', new Blob([buf], { type: String(mime || 'audio/ogg') }), String(filename || 'audio.ogg'));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const headers = {};
    const key = String(apiKey || '').trim();
    if (key) headers.Authorization = `Bearer ${key}`;
    const resp = await fetch(url, { method: 'POST', body: fd, headers, signal: controller.signal });
    const txt = await resp.text();
    if (!resp.ok) throw new Error(`STT HTTP ${resp.status} ${txt}`.slice(0, 500));
    const j = JSON.parse(txt);
    const out = String(j?.text || '').trim();
    return out || null;
  } finally {
    clearTimeout(timer);
  }
}

async function generateTts(text, voice) {
  ensureDir(TTS_DIR);
  const stamp = Date.now();
  const absPath = path.join(TTS_DIR, `tts_${stamp}.mp3`);
  const v = String(voice || process.env.EDGE_TTS_VOICE || 'zh-CN-XiaoxiaoNeural').trim();
  const rate = String(process.env.EDGE_TTS_RATE || '').trim();
  const pitch = String(process.env.EDGE_TTS_PITCH || '').trim();

  const args = ['edge-tts', '--text', text, '--write-media', absPath, '--voice', v];
  if (rate) args.push(`--rate=${rate}`);
  if (pitch) args.push(`--pitch=${pitch}`);

  const code = await new Promise((resolve) => {
    const proc = spawn('uvx', args, {
      env: { ...process.env, ...buildProxyEnv() },
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (c) => resolve(c));
    proc.on('error', () => resolve(-1));
  });

  if (code !== 0 || !fs.existsSync(absPath)) {
    return { ok: false, path: null, error: `exit code ${code}` };
  }
  return { ok: true, path: absPath, error: null };
}

async function proxyAlive(url, ms) {
  const u = url || 'http://127.0.0.1:7890';
  const t = Math.max(1000, Math.min(10000, Number(ms) || 3000));
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), t);
    const resp = await fetch(u, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    return resp.ok || resp.status < 500;
  } catch {
    return false;
  }
}

function startTelegramBridge(onMessage, onVoice) {
  if (_started) {
    return { ok: true, message: 'already started' };
  }
  const token = getToken();
  if (!token || token.length < 10) {
    console.log('[telegram-bridge] 无有效 Token，跳过启动');
    return { ok: false, message: 'no token' };
  }
  _onMessageCb = typeof onMessage === 'function' ? onMessage : null;
  _onVoiceCb = typeof onVoice === 'function' ? onVoice : null;

  const proxyUrl = String(process.env.OPENCLAW_PROXY_URL || process.env.HTTP_PROXY || 'http://127.0.0.1:7890').trim();

  const doStart = (delayMs, useProxy=true) => {
    setTimeout(async () => {
      if (_started) return;
      let agent = undefined;
      if (useProxy) {
        const alive = await proxyAlive(proxyUrl, 3000);
        if (!alive) {
          if (_starting) return;
          console.log(`[telegram-bridge] 代理 ${proxyUrl} 不可达，60秒后重试代理，直连兜底`);
          doStart(60000, true);
          doStart(30000, false);
          return;
        }
        console.log(`[telegram-bridge] 代理 ${proxyUrl} 存活，走代理启动`);
        try {
          const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;
          agent = new HttpsProxyAgent(proxyUrl);
        } catch (e) {
          console.log(`[telegram-bridge] 代理模块加载失败，切换直连: ${e.message}`);
          useProxy = false;
        }
      }
      if (_starting) return;
      _starting = true;
      if (!useProxy) {
        console.log(`[telegram-bridge] 直连模式启动`);
      }
      try {
        clearWebhook(token);
        const savedOffset = loadUpdateId();
        bot = new TelegramBot(token, {
          polling: { params: { timeout: 60, ...(savedOffset ? { offset: savedOffset + 1 } : {}) }, interval: 1000 },
          request: { timeout: 120000, ...(agent ? { agent } : {}) },
        });
        if (savedOffset) {
          console.log(`[telegram-bridge] 从 update_id ${savedOffset} 断点续传`);
        }
        let _pollRetries = 0;
        bot.on('polling_error', (err) => {
          const msg = String(err?.message || '');
          if (msg.includes('409') || msg.includes('socket') || msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
            _pollRetries++;
            if (_pollRetries >= 3) {
              console.log(`[telegram-bridge] polling 已连续失败 ${_pollRetries} 次，触发全量 Bot 重启`);
              _pollRetries = 0;
              restartAllBots().catch(() => {});
              return;
            }
            const delay = Math.min(3000 * Math.pow(2, Math.min(_pollRetries - 1, 5)), 60000);
            console.log(`[telegram-bridge] polling 中断 #${_pollRetries}，${delay}ms后重试: ${msg.slice(0, 100)}`);
            setTimeout(async () => {
              try {
                await bot.stopPolling().catch(() => {});
                await clearWebhook(token);
                await new Promise(r => setTimeout(r, 1000));
                await bot.startPolling();
                _pollRetries = 0;
                console.log('[telegram-bridge] polling 重连成功');
              } catch (e) {
                console.error(`[telegram-bridge] polling 重连失败 #${_pollRetries}:`, e?.message || e);
              }
            }, delay);
          }
        });
        bot.on('webhook_error', (err) => {
          console.error('[telegram-bridge] webhook_error:', err?.message || err);
        });
        bot.on('message', async (tgMsg) => {
          try {
            if (!tgMsg || tgMsg.from?.is_bot) return;
            if (tgMsg.update_id) saveUpdateId(tgMsg.update_id);
            const chatId = tgMsg.chat.id;
            const voice = tgMsg.voice || tgMsg.audio || null;
            if (voice) {
              console.log(`[telegram-bridge] 收到语音 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId} duration=${voice.duration || '?'}s`);
              if (_onVoiceCb) {
                await _onVoiceCb({
                  chatId,
                  fileId: voice.file_id,
                  duration: voice.duration || 0,
                  mimeType: voice.mime_type || 'audio/ogg',
                  from: tgMsg.from,
                  chat: tgMsg.chat,
                  messageId: tgMsg.message_id,
                  raw: tgMsg,
                });
              }
              return;
            }
            const doc = tgMsg.document || null;
            if (doc && doc.mime_type && doc.mime_type.startsWith('audio/')) {
              console.log(`[telegram-bridge] 收到音频文件 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId} name=${doc.file_name}`);
              if (_onVoiceCb) {
                await _onVoiceCb({
                  chatId,
                  fileId: doc.file_id,
                  duration: 0,
                  mimeType: doc.mime_type || 'audio/ogg',
                  from: tgMsg.from,
                  chat: tgMsg.chat,
                  messageId: tgMsg.message_id,
                  raw: tgMsg,
                });
              }
              return;
            }
            const photos = tgMsg.photo || null;
            if (photos && photos.length > 0) {
              const best = photos.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
              console.log(`[telegram-bridge] 收到图片 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId} size=${best.width}x${best.height}`);
              if (_onMessageCb) {
                const caption = String(tgMsg.caption || '').trim();
                await _onMessageCb({
                  text: caption || '[图片]',
                  chatId,
                  from: tgMsg.from,
                  chat: tgMsg.chat,
                  messageId: tgMsg.message_id,
                  raw: tgMsg,
                  photoFileId: best.file_id,
                });
              }
              return;
            }
            // ── Location 类型消息 ──
            if (tgMsg.location) {
              const { latitude, longitude } = tgMsg.location;
              console.log(`[telegram-bridge] 收到位置分享 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId} lat=${latitude} lon=${longitude}`);
              if (_onMessageCb) {
                await _onMessageCb({
                  text: '[位置]',
                  chatId,
                  from: tgMsg.from,
                  chat: tgMsg.chat,
                  messageId: tgMsg.message_id,
                  raw: tgMsg,
                  location: { lat: latitude, lon: longitude },
                });
              }
              return;
            }

            const text = String(tgMsg.text || '').trim();
            if (!text) return;
            console.log(`[telegram-bridge] 收到消息 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId}: ${text.slice(0, 80)}`);
            if (_onMessageCb) {
              await _onMessageCb({
                text,
                chatId,
                from: tgMsg.from,
                chat: tgMsg.chat,
                messageId: tgMsg.message_id,
                raw: tgMsg,
              });
            }
          } catch (e) {
            console.error('[telegram-bridge] message handler error:', e?.message || e);
          }
        });
        _started = true;
        console.log('[telegram-bridge] 启动成功');
        const cleanup = () => {
          try { if (bot) bot.stopPolling(); } catch {}
        };
        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        return { ok: true, message: 'started' };
      } catch (e) {
        console.error('[telegram-bridge] 启动失败:', e?.message || e);
        return { ok: false, message: e?.message || String(e) };
      }
    }, delayMs);
  };
  doStart(0);
  return { ok: true, message: 'starting_async' };
}
function stopTelegramBridge() {
  if (!_started || !bot) return;
  try { bot.stopPolling(); } catch {}
  try { bot = null; } catch {}
  _started = false;
  console.log('[telegram-bridge] 已停止');
}

async function sendTelegramMessage(chatId, text) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  const fullText = String(text || '');
  const MAX_LEN = 3800;
  if (fullText.length > MAX_LEN) {
    const chunks = [];
    for (let i = 0; i < fullText.length; i += MAX_LEN) {
      chunks.push(fullText.slice(i, i + MAX_LEN));
    }
    console.log(`[telegram-bridge] 消息过长，自动分片为 ${chunks.length} 段`);
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const r = await _sendSingleMessage(chatId, chunks[i]);
      results.push(r);
      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    return { ok: results.some(r => r.ok), message: `分片发送 ${results.filter(r => r.ok).length}/${chunks.length}` };
  }
  return await _sendSingleMessage(chatId, fullText);
}

async function _sendSingleMessage(chatId, text) {
  try {
    const safeText = sanitizeTelegramMarkdown(text).slice(0, 4000);
    const msg = await withTimeout(
      bot.sendMessage(chatId, safeText, { parse_mode: 'Markdown' }),
      15_000, 'sendMessage timeout (15s)'
    );
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendMessage error:', e?.message || e);
    try {
      const plainText = text.replace(/[*_`\[\]]/g, '').slice(0, 4000);
      const msg = await withTimeout(
        bot.sendMessage(chatId, plainText),
        15_000, 'sendMessage plain timeout (15s)'
      );
      return { ok: true, message: msg };
    } catch (e2) {
      console.error('[telegram-bridge] sendMessage plain fallback error:', e2?.message || e2);
      return { ok: false, message: e2?.message || String(e2) };
    }
  }
}

async function sendTelegramPhoto(chatId, filePath, caption) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  try {
    if (!fs.existsSync(filePath)) return { ok: false, message: 'file not found' };
    const msg = await withTimeout(
      bot.sendPhoto(chatId, fs.readFileSync(filePath), {
        caption: String(caption || '').slice(0, 200),
        parse_mode: 'Markdown',
      }),
      30_000, 'sendPhoto timeout (30s)'
    );
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendPhoto error:', e?.message || e);
    return { ok: false, message: e?.message || String(e) };
  }
}

async function sendTelegramLocationRequest(chatId, text) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  try {
    const safeText = String(text || '请分享您的位置，这样我就能知道您在哪里啦 📍').slice(0, 1000);
    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: '📍 分享位置', request_location: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    };
    const msg = await bot.sendMessage(chatId, safeText, opts);
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendLocationRequest error:', e?.message || e);
    return { ok: false, message: e?.message || String(e) };
  }
}

async function sendTelegramRemoveKeyboard(chatId, text, replyToMessageId) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  try {
    const safeText = String(text || '').slice(0, 4000);
    const opts = { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } };
    if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
    const msg = await withTimeout(
      bot.sendMessage(chatId, safeText, opts),
      15_000, 'sendReply timeout (15s)'
    );
    return { ok: true, message: msg };
  } catch (e) {
    try {
      const plainText = String(text || '').replace(/[*`[\]]/g, '').slice(0, 4000);
      const opts = { reply_markup: { remove_keyboard: true } };
      if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
      const msg = await bot.sendMessage(chatId, plainText, opts);
      return { ok: true, message: msg };
    } catch (e2) {
      return { ok: false, message: e2?.message || String(e2) };
    }
  }
}

async function sendTelegramReply(chatId, text, replyToMessageId) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  console.log('[telegram-bridge] sendTelegramReply PREVIEW:', JSON.stringify(String(text || '').slice(0, 300)));
  try {
    const safeText = sanitizeTelegramMarkdown(String(text || '')).slice(0, 4000);
    const opts = { parse_mode: 'Markdown' };
    if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
    const msg = await withTimeout(
      bot.sendMessage(chatId, safeText, opts),
      15_000, 'sendReply timeout (15s)'
    );
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendReply error:', e?.message || e);
    try {
      const plainText = String(text || '').replace(/[*_`\[\]]/g, '').slice(0, 4000);
      const opts = {};
      if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
      const msg = await withTimeout(
        bot.sendMessage(chatId, plainText, opts),
        15_000, 'sendReply plain timeout (15s)'
      );
      return { ok: true, message: msg };
    } catch (e2) {
      return { ok: false, message: e2?.message || String(e2) };
    }
  }
}

async function sendTelegramVoice(chatId, audioPath, replyToMessageId) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  if (!audioPath || !fs.existsSync(audioPath)) return { ok: false, message: 'audio file not found' };
  try {
    const opts = {};
    if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
    const msg = await bot.sendAudio(chatId, audioPath, opts);
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendVoice error:', e?.message || e);
    try {
      const opts = {};
      if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
      const msg = await bot.sendVoice(chatId, audioPath, opts);
      return { ok: true, message: msg };
    } catch (e2) {
      console.error('[telegram-bridge] sendVoice fallback error:', e2?.message || e2);
      return { ok: false, message: e2?.message || String(e2) };
    }
  }
}

async function sendTelegramTextWithVoice(chatId, text, replyToMessageId) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };

  const textResult = await sendTelegramReply(chatId, text, replyToMessageId);

  const voice = String(process.env.EDGE_TTS_VOICE || 'zh-CN-XiaoxiaoNeural').trim();
  const tts = await generateTts(text, voice);
  if (tts.ok) {
    const voiceResult = await sendTelegramVoice(chatId, tts.path, replyToMessageId);
    try { fs.unlink(tts.path, () => {}); } catch {}
    return { ok: true, text: textResult, voice: voiceResult };
  }

  return { ok: true, text: textResult, voice: null };
}

function isRunning() {
  return _started && bot !== null;
}

function startAgentBots(agents, getHandler) {
  _agents = agents;
  _getHandler = getHandler;
  const mainToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const results = [];
  const agentRetries = {};
  for (const agent of agents) {
    const token = agent?.telegram?.token;
    const name = agent?.name || agent?.id || 'unknown';
    if (!token || token.length < 10) {
      console.log(`[telegram-bridge] Agent "${name}" 无有效 Token，跳过`);
      continue;
    }
    if (token.trim() === mainToken && mainToken) {
      console.log(`[telegram-bridge] Agent "${name}" Token 与主桥相同，跳过（避免 409 Conflict）`);
      continue;
    }
    try {
      clearWebhook(token);
      const agentBot = new TelegramBot(token, {
        polling: { params: { timeout: 60 }, interval: 1000 },
        request: { timeout: 120000 },
      });
      agentRetries[name] = 0;
      const handler = typeof getHandler === 'function' ? getHandler(agent) : null;
      agentBot.on('polling_error', (err) => {
        const msg = String(err?.message || '');
        if (msg.includes('409') || msg.includes('socket') || msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
          agentRetries[name] = (agentRetries[name] || 0) + 1;
          if (agentRetries[name] >= 3) {
            console.log(`[telegram-bridge][${name}] polling 已连续失败 ${agentRetries[name]} 次，触发全量 Bot 重启`);
            agentRetries[name] = 0;
            restartAllBots().catch(() => {});
            return;
          }
          console.log(`[telegram-bridge][${name}] polling 中断 #${agentRetries[name]}，3秒后重连: ${msg.slice(0, 100)}`);
          setTimeout(async () => {
            try {
              await agentBot.stopPolling().catch(() => {});
              await clearWebhook(token);
              await new Promise(r => setTimeout(r, 1000));
              await agentBot.startPolling();
              agentRetries[name] = 0;
              console.log(`[telegram-bridge][${name}] polling 重连成功`);
            } catch (e) {
              console.error(`[telegram-bridge][${name}] polling 重连失败:`, e?.message || e);
            }
          }, 3000);
        }
      });
      agentBot.on('message', async (tgMsg) => {
        try {
          if (!tgMsg || tgMsg.from?.is_bot) return;
          const chatId = tgMsg.chat.id;

          // 图片处理
          const photos = tgMsg.photo || null;
          if (photos && photos.length > 0) {
            const best = photos.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
            const caption = String(tgMsg.caption || '').trim();
            console.log(`[telegram-bridge][${name}] 收到图片 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId} size=${best.width}x${best.height}`);
            if (handler?.onMessage) {
              await handler.onMessage({
                text: caption || '[图片]',
                chatId,
                from: tgMsg.from,
                chat: tgMsg.chat,
                messageId: tgMsg.message_id,
                raw: tgMsg,
                agentId: agent.id,
                agentName: name,
                photoFileId: best.file_id,
              });
            }
            return;
          }

          const text = String(tgMsg.text || '').trim();
          if (!text) return;
          console.log(`[telegram-bridge][${name}] 收到消息 from=${tgMsg.from?.username || tgMsg.from?.id} chat=${chatId}: ${text.slice(0, 80)}`);
          if (handler?.onMessage) {
            await handler.onMessage({
              text,
              chatId,
              from: tgMsg.from,
              chat: tgMsg.chat,
              messageId: tgMsg.message_id,
              raw: tgMsg,
              agentId: agent.id,
              agentName: name,
            });
          }
        } catch (e) {
          console.error(`[telegram-bridge][${name}] message handler error:`, e?.message || e);
        }
      });
      _agentBots.push({ agentId: agent.id, name, bot: agentBot, token });
      console.log(`[telegram-bridge][${name}] Bot 启动成功`);
      results.push({ ok: true, agentId: agent.id, name });
    } catch (e) {
      console.error(`[telegram-bridge][${name}] Bot 启动失败:`, e?.message || e);
      results.push({ ok: false, agentId: agent.id, name, error: e?.message || String(e) });
    }
  }
  const ok = results.filter(r => r.ok).length;
  const total = agents.filter(a => a?.telegram?.token?.length >= 10).length;
  console.log(`[telegram-bridge] Agent Bot 启动完成: ${ok}/${total}`);
  return results;
}

function stopAgentBots() {
  for (const ab of _agentBots) {
    try { ab.bot.stopPolling(); } catch {}
    console.log(`[telegram-bridge][${ab.name}] Bot 已停止`);
  }
  _agentBots = [];
}

function getAgentBot(agentId) {
  return _agentBots.find(ab => ab.agentId === agentId) || null;
}

function getAllAgentBots() {
  return _agentBots;
}

async function sendAgentBotMessage(agentId, chatId, text) {
  const ab = _agentBots.find(a => a.agentId === agentId);
  if (!ab || !ab.bot) {
    return sendTelegramMessage(chatId, text);
  }
  try {
    const safeText = String(text || '').slice(0, 4000);
    const msg = await withTimeout(
      ab.bot.sendMessage(chatId, safeText, { parse_mode: 'Markdown' }),
      15_000, 'sendAgentBotMessage timeout (15s)'
    );
    return { ok: true, message: msg };
  } catch (e) {
    console.error(`[telegram-bridge] sendAgentBotMessage[${agentId}] markdown error:`, e?.message || e);
    try {
      const plainText = String(text || '').replace(/[*`[\]]/g, '').slice(0, 4000);
      const msg = await withTimeout(
        ab.bot.sendMessage(chatId, plainText),
        15_000, 'sendAgentBotMessage plain timeout (15s)'
      );
      return { ok: true, message: msg };
    } catch (e2) {
      console.error(`[telegram-bridge] sendAgentBotMessage[${agentId}] plain error:`, e2?.message || e2);
      return { ok: false, message: e2?.message || String(e2) };
    }
  }
}

module.exports = {
  startTelegramBridge,
  stopTelegramBridge,
  sendTelegramMessage,
  sendTelegramReply,
  sendTelegramLocationRequest,
  sendTelegramRemoveKeyboard,
  sendTelegramPhoto,
  sendTelegramVoice,
  sendTelegramTextWithVoice,
  downloadTelegramFile,
  transcribeBuffer,
  generateTts,
  isRunning,
  getToken,
  startAgentBots,
  stopAgentBots,
  getAgentBot,
  getAllAgentBots,
  sendAgentBotMessage,
  healthCheck,
  restartAllBots,
};