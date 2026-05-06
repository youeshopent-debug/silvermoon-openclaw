'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

/** 代理配置 */
const PROXY_URL = process.env.PROXY_URL || 'http://127.0.0.1:7890';
const proxyAgent = new HttpsProxyAgent(PROXY_URL);
const proxyFetchOpts = { agent: proxyAgent };

/** 图片缓存目录 */
const CACHE_DIR = path.join(__dirname, '..', '.silvermoon_core', 'vision_cache');

/** 确保缓存目录存在 */
function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}

/**
 * 通过 Telegram Bot API 下载图片
 * @param {string} botToken - Bot 的 Token
 * @param {string} fileId - Telegram 的 file_id
 * @returns {Promise<{ok: boolean, base64?: string, path?: string, error?: string}>}
 */
async function downloadPhoto(botToken, fileId) {
  if (!botToken || !fileId) return { ok: false, error: 'missing token or fileId' };
  ensureCacheDir();
  try {
    // 1. 获取 file path
    const fileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileResp = await fetch(fileUrl, proxyFetchOpts);
    const fileJson = await fileResp.json();
    if (!fileJson.ok || !fileJson.result?.file_path) {
      return { ok: false, error: 'getFile failed: ' + (fileJson.description || 'unknown') };
    }
    const remotePath = fileJson.result.file_path;
    // 2. 下载文件
    const dlUrl = `https://api.telegram.org/file/bot${botToken}/${remotePath}`;
    const dlResp = await fetch(dlUrl, proxyFetchOpts);
    if (!dlResp.ok) return { ok: false, error: 'download failed: ' + dlResp.status };
    const buffer = Buffer.from(await dlResp.arrayBuffer());
    // 3. 缓存到本地
    const ext = path.extname(remotePath) || '.jpg';
    const hash = createHash('md5').update(fileId).digest('hex').slice(0, 12);
    const outPath = path.join(CACHE_DIR, `${hash}${ext}`);
    fs.writeFileSync(outPath, buffer);
    const base64 = buffer.toString('base64');
    return { ok: true, base64, path: outPath, mime: `image/${ext.replace('.', '')}` };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * 通过 Gemini API 分析图片内容
 * @param {string} base64 - 图片 base64 编码
 * @param {string} [mime] - 图片 MIME 类型，默认 image/jpeg
 * @returns {Promise<{ok: boolean, description?: string, error?: string}>}
 */
async function analyzeImage(base64, mime) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'GEMINI_API_KEY not configured' };
  }
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{
      parts: [
        { text: '请用中文详细描述这张图片的内容。包括：图片中有什么物体/人物、文字内容（如果有）、颜色、布局、以及任何值得注意的细节。如果图片包含文字，请完整转录。' },
        { inline_data: { mime_type: mime || 'image/jpeg', data: base64 } },
      ],
    }],
  };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      ...proxyFetchOpts,
    });
    const json = await resp.json();
    if (!resp.ok) {
      return { ok: false, error: json?.error?.message || 'Gemini API error: ' + resp.status };
    }
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
    if (!text) return { ok: false, error: 'empty response from Gemini' };
    return { ok: true, description: text.trim() };
  } catch (e) {
    // 降级：尝试用 OpenRouter 的视觉模型
    return fallbackAnalyzeImage(base64, mime);
  }
}

/**
 * 降级方案：用 OpenRouter 视觉模型分析图片
 */
async function fallbackAnalyzeImage(base64, mime) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, error: 'no vision model available' };
  try {
    const dataUri = `data:${mime || 'image/jpeg'};base64,${base64}`;
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '请用中文详细描述这张图片的内容。包括图片中的物体、文字、颜色、布局等细节。如果包含文字请完整转录。' },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        }],
        max_tokens: 1024,
      }),
      ...proxyFetchOpts,
    });
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content || '';
    if (!text) return { ok: false, error: 'empty response from OpenRouter vision' };
    return { ok: true, description: text.trim() };
  } catch (e) {
    return { ok: false, error: 'all vision models failed: ' + (e?.message || String(e)) };
  }
}

module.exports = { downloadPhoto, analyzeImage };
