const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let bot = null;
let _onMessageCb = null;
let _started = false;
let _onVoiceCb = null;

const TMP_DIR = path.join(__dirname, '..', 'tmp', 'tg_voice');
const TTS_DIR = path.join(__dirname, '..', 'tmp', 'tg_tts');

function ensureDir(d) {
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); } catch {}
}

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
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

function startTelegramBridge(onMessage, onVoice) {
  if (_started) {
    console.log('[telegram-bridge] 已在运行，跳过重复启动');
    return { ok: true, message: 'already started' };
  }
  const token = getToken();
  if (!token || token.length < 10) {
    console.log('[telegram-bridge] 无有效 Token，跳过启动');
    return { ok: false, message: 'no token' };
  }
  _onMessageCb = typeof onMessage === 'function' ? onMessage : null;
  _onVoiceCb = typeof onVoice === 'function' ? onVoice : null;
  try {
    bot = new TelegramBot(token, { polling: { params: { timeout: 10 } } });
    bot.on('polling_error', (err) => {
      const msg = String(err?.message || '');
      if (msg.includes('409') || msg.includes('Conflict')) {
        console.error('[telegram-bridge] 409 Conflict，重置 polling...');
        try {
          bot.stopPolling();
          // 用 getUpdates 手动确认旧会话已释放
          bot.getUpdates({ offset: 0, timeout: 1 }).catch(() => {});
        } catch {}
        setTimeout(() => {
          try { bot.startPolling(); } catch (e) {
            console.error('[telegram-bridge] 重启 polling 失败:', e?.message || e);
          }
        }, 3000);
      } else {
        console.error('[telegram-bridge] polling_error:', msg);
      }
    });
    bot.on('webhook_error', (err) => {
      console.error('[telegram-bridge] webhook_error:', err?.message || err);
    });
    bot.on('message', async (tgMsg) => {
      try {
        if (!tgMsg || tgMsg.from?.is_bot) return;
        const chatId = tgMsg.chat.id;

        // ── 检测语音消息 ──
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

        // ── 检测音频文件附件 ──
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

        // ── 文字消息 ──
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

    // 进程退出时自动清理 polling 连接
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
  try {
    const safeText = String(text || '').slice(0, 4000);
    const msg = await bot.sendMessage(chatId, safeText, { parse_mode: 'Markdown' });
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendMessage error:', e?.message || e);
    try {
      const plainText = String(text || '').replace(/[*_`[\]()]/g, '').slice(0, 4000);
      const msg = await bot.sendMessage(chatId, plainText);
      return { ok: true, message: msg };
    } catch (e2) {
      console.error('[telegram-bridge] sendMessage plain fallback error:', e2?.message || e2);
      return { ok: false, message: e2?.message || String(e2) };
    }
  }
}

async function sendTelegramReply(chatId, text, replyToMessageId) {
  if (!bot || !_started) return { ok: false, message: 'bot not started' };
  try {
    const safeText = String(text || '').slice(0, 4000);
    const opts = { parse_mode: 'Markdown' };
    if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
    const msg = await bot.sendMessage(chatId, safeText, opts);
    return { ok: true, message: msg };
  } catch (e) {
    console.error('[telegram-bridge] sendReply error:', e?.message || e);
    try {
      const plainText = String(text || '').replace(/[*_`[\]()]/g, '').slice(0, 4000);
      const opts = {};
      if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;
      const msg = await bot.sendMessage(chatId, plainText, opts);
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

module.exports = {
  startTelegramBridge,
  stopTelegramBridge,
  sendTelegramMessage,
  sendTelegramReply,
  sendTelegramVoice,
  sendTelegramTextWithVoice,
  downloadTelegramFile,
  transcribeBuffer,
  generateTts,
  isRunning,
  getToken,
};
