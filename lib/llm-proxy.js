const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'llm_cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROXY_PORT = 19999;

const UPSTREAM_MAP = {
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com', apiKey: process.env.NVIDIA_API_KEY || '' },
  groq: { baseUrl: 'https://api.groq.com/openai', apiKey: process.env.GROQ_API_KEY || '' },
  openrouter: { baseUrl: 'https://openrouter.ai/api', apiKey: process.env.OPENROUTER_API_KEY || '' },
  'or-ollama': { baseUrl: 'http://127.0.0.1:18765/ollama', apiKey: 'unused', api: 'anthropic-messages' },
  ollama: { baseUrl: 'http://127.0.0.1:11434', apiKey: 'unused' },
  deepseek: { baseUrl: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY || '' },
};

function initDb() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('[llm-proxy] 缓存目录已创建:', CACHE_DIR);
  }
}

function hashRequest(messages, model) {
  const raw = JSON.stringify({ messages, model });
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function cacheFilePath(hash) {
  return path.join(CACHE_DIR, hash + '.json');
}

function getCached(hash) {
  return new Promise((resolve) => {
    const fpath = cacheFilePath(hash);
    try {
      if (!fs.existsSync(fpath)) return resolve(null);
      const raw = fs.readFileSync(fpath, 'utf8');
      const entry = JSON.parse(raw);
      const now = Date.now();
      if (now - entry.created_at > CACHE_TTL_MS) {
        fs.unlinkSync(fpath);
        return resolve(null);
      }
      entry.hit_count = (entry.hit_count || 0) + 1;
      entry.updated_at = now;
      fs.writeFileSync(fpath, JSON.stringify(entry, null, 0));
      resolve(entry);
    } catch {
      resolve(null);
    }
  });
}

function setCache(hash, provider, model, messages, response, tokensIn, tokensOut) {
  const preview = JSON.stringify(messages).slice(0, 200);
  const now = Date.now();
  const entry = {
    hash, provider, model, prompt_preview: preview,
    response: JSON.stringify(response),
    tokens_input: tokensIn || 0, tokens_output: tokensOut || 0,
    hit_count: 1, created_at: now, updated_at: now,
  };
  try {
    fs.writeFileSync(cacheFilePath(hash), JSON.stringify(entry, null, 0));
  } catch {}
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function forwardRequest(targetUrl, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Authorization': body.headers?.Authorization || '',
      },
      timeout: 120000,
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { error: data } });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

function getProviderConfig(providerId) {
  const configPath = path.join(__dirname, '..', 'openclaw.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    const config = JSON.parse(raw);
    const provider = config.models?.providers?.[providerId] || config.providers?.[providerId];
    if (!provider) return null;
    return {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey?.replace(/\$\{(\w+)\}/g, (_, k) => process.env[k] || ''),
      api: provider.api || 'openai-completions',
    };
  } catch { return null; }
}

function buildTargetUrl(providerConf, model) {
  const base = providerConf.baseUrl.replace(/\/+$/, '');
  if (providerConf.api === 'anthropic-messages') {
    return `${base}/v1/messages`;
  }
  return `${base}/v1/chat/completions`;
}

function buildRequestBody(providerConf, model, messages) {
  if (providerConf.api === 'anthropic-messages') {
    const system = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    return {
      model,
      system: system?.content || '',
      messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    };
  }
  return { model, messages, max_tokens: 4096 };
}

function buildForwardHeaders(providerConf, body, incomingReq) {
  const headers = { 'Content-Type': 'application/json' };
  if (providerConf.api === 'anthropic-messages') {
    headers['x-api-key'] = providerConf.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (providerConf.apiKey) {
    headers['Authorization'] = `Bearer ${providerConf.apiKey}`;
  } else if (incomingReq?.headers?.authorization) {
    headers['Authorization'] = incomingReq.headers.authorization;
  }
  body.headers = headers;
  return body;
}

function extractResponse(providerConf, rawResponse) {
  if (providerConf.api === 'anthropic-messages') {
    const content = rawResponse.content?.[0]?.text || '';
    return {
      content,
      tokensIn: rawResponse.usage?.input_tokens || estimateTokens(content),
      tokensOut: rawResponse.usage?.output_tokens || estimateTokens(content),
    };
  }
  const choice = rawResponse.choices?.[0];
  const content = choice?.message?.content || rawResponse.error || JSON.stringify(rawResponse);
  return {
    content,
    tokensIn: rawResponse.usage?.prompt_tokens || estimateTokens(content),
    tokensOut: rawResponse.usage?.completion_tokens || estimateTokens(content),
  };
}

function parseModelId(modelId) {
  const parts = modelId.split('/');
  if (parts.length >= 3) {
    return { provider: parts[0], model: parts.slice(1).join('/') };
  }
  if (parts.length === 2) {
    return { provider: parts[0], model: parts[1] };
  }
  return { provider: 'openai', model: modelId };
}

async function handleRequest(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let bodyStr = '';
  req.on('data', chunk => bodyStr += chunk);
  req.on('end', async () => {
    try {
      const body = JSON.parse(bodyStr);
      const { model, messages } = body;

      if (!model || !messages) {
        res.writeHead(400).end(JSON.stringify({ error: 'model and messages required' }));
        return;
      }

      // ===== 确定上游配置：header > UPSTREAM_MAP > openclaw.json =====
      const upstreamBase = req.headers['x-upstream-baseurl'];
      const apiKeyHeader = req.headers['x-api-key'];

      let providerConf;
      let modelName = model;
      let providerId = 'direct';

      if (upstreamBase) {
        // 方式1: 直接指定上游 URL（用于 main.js fallback 链）
        providerConf = {
            baseUrl: upstreamBase.replace(/\/+$/, '').replace(/\/v1$/, ''),
            apiKey: apiKeyHeader || '',
            api: body.api === 'anthropic-messages' ? 'anthropic-messages' : 'openai-completions',
        };
      } else {
        // 方式2: 通过 model ID 解析 provider
        const parsed = parseModelId(model);
        providerId = parsed.provider;
        modelName = parsed.model;

        // 优先查 UPSTREAM_MAP（独立映射，不依赖 openclaw.json）
        const upstreamEntry = UPSTREAM_MAP[providerId];
        if (upstreamEntry) {
          providerConf = {
            baseUrl: upstreamEntry.baseUrl.replace(/\/+$/, ''),
            apiKey: upstreamEntry.apiKey,
            api: upstreamEntry.api || 'openai-completions',
          };
          // Key 为空时从 openclaw.json 兜底（如 OpenRouter 的硬编码 key）
          if (!providerConf.apiKey) {
            const fallback = getProviderConfig(providerId);
            if (fallback && fallback.apiKey) {
              providerConf.apiKey = fallback.apiKey;
            }
          }
          console.log(`[llm-proxy] 🔑 provider=${providerId} key=${providerConf.apiKey ? providerConf.apiKey.slice(0, 12) + '...' : 'empty'}`);
        } else {
          // 降级到 openclaw.json
          providerConf = getProviderConfig(providerId);
          if (!providerConf) {
            res.writeHead(502).end(JSON.stringify({ error: `Unknown provider: ${providerId}` }));
            return;
          }
        }
      }

      const hash = hashRequest(messages, model);
      const cached = await getCached(hash);

      if (cached) {
        const cachedData = JSON.parse(cached.response);
        console.log(`[llm-proxy] ✅ 缓存命中: ${model} (命中${cached.hit_count}次)`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
        res.end(JSON.stringify(cachedData));
        return;
      }

      const targetUrl = buildTargetUrl(providerConf, modelName);
      let forwardBody = buildRequestBody(providerConf, modelName, messages);
      forwardBody = buildForwardHeaders(providerConf, forwardBody, req);

      console.log(`[llm-proxy] ➡️ 转发: ${model} -> ${targetUrl}`);
      const start = Date.now();
      const result = await forwardRequest(targetUrl, forwardBody);
      const elapsed = Date.now() - start;

      if (result.status >= 200 && result.status < 300) {
        const extracted = extractResponse(providerConf, result.data);
        const cacheBody = {
          choices: [{ message: { role: 'assistant', content: extracted.content } }],
          usage: { prompt_tokens: extracted.tokensIn, completion_tokens: extracted.tokensOut },
          model: modelName,
        };
        setCache(hash, providerId, modelName, messages, cacheBody, extracted.tokensIn, extracted.tokensOut);
        console.log(`[llm-proxy] ✅ 已缓存: ${model} (${elapsed}ms, in=${extracted.tokensIn}, out=${extracted.tokensOut})`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
        res.end(JSON.stringify(cacheBody));
      } else {
        console.error(`[llm-proxy] ❌ 上游错误: ${result.status}`);
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.data));
      }
    } catch (e) {
      console.error('[llm-proxy] 处理请求失败:', e.message);
      res.writeHead(500).end(JSON.stringify({ error: e.message }));
    }
  });
}

function startProxy() {
  initDb();
  const server = http.createServer(handleRequest);
  server.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log(`[llm-proxy] 🚀 中转缓存层已启动: http://127.0.0.1:${PROXY_PORT}`);
    console.log(`[llm-proxy] 缓存目录: ${CACHE_DIR}`);
    console.log(`[llm-proxy] 缓存 TTL: ${CACHE_TTL_MS / 1000 / 60 / 60}小时`);
  });
  return server;
}

function getCacheStats() {
  try {
    if (!fs.existsSync(CACHE_DIR)) return { total: 0, total_hits: 0 };
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let totalHits = 0;
    for (const f of files) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
        totalHits += entry.hit_count || 0;
      } catch {}
    }
    return { total: files.length, total_hits: totalHits };
  } catch {
    return { total: 0, total_hits: 0 };
  }
}

if (require.main === module) {
  startProxy();
}

module.exports = { startProxy, getCacheStats };
