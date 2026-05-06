/**
 * Embedding 服务 — RAG 语义检索引擎
 * 双后端：OpenRouter（云端/无GPU）| Ollama（本地/有GPU）
 * 多语言优化：默认使用阿里 Qwen 系列模型
 */

const AGENT = 'Mozilla/5.0 (compatible; SilverMoon-Bank-Embedding/1.0)';

function getConfig() {
  const backend = (process.env.OPENCLAW_EMBEDDING_BACKEND || 'openrouter').toLowerCase();
  const model =
    process.env.OPENCLAW_EMBEDDING_MODEL ||
    (backend === 'ollama' ? 'qwen2.5:7b' : 'BAAI/bge-m3');
  return {
    backend,
    model,
    openrouterKey: process.env.OPENROUTER_API_KEY || '',
    openrouterBase: 'https://openrouter.ai/api/v1/embeddings',
    ollamaBase: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
    dims: Number(process.env.OPENCLAW_EMBEDDING_DIMS || 1024),
    proxyUrl: process.env.OPENCLAW_PROXY_URL || '',
  };
}

/**
 * 获取单段文本的 embedding 向量
 * @param {string} text
 * @returns {Promise<{ok:boolean, vector?:Float32Array, model:string, error?:string}>}
 */
async function getEmbedding(text) {
  const cfg = getConfig();
  const input = String(text || '').trim();
  if (!input) return { ok: false, error: 'empty_text' };

  if (cfg.backend === 'ollama') {
    return getEmbeddingOllama(input, cfg);
  }
  return getEmbeddingOpenRouter(input, cfg);
}

/**
 * 批量获取 embedding（多段文本一次请求）
 * @param {string[]} texts
 * @returns {Promise<{ok:boolean, vectors?:Float32Array[], model:string, error?:string}>}
 */
async function getEmbeddings(texts) {
  const cfg = getConfig();
  const inputs = (Array.isArray(texts) ? texts : [texts]).map(t => String(t || '').trim()).filter(Boolean);
  if (inputs.length === 0) return { ok: false, error: 'empty_texts' };

  if (cfg.backend === 'ollama') {
    return getEmbeddingsOllama(inputs, cfg);
  }
  return getEmbeddingsOpenRouter(inputs, cfg);
}

// ─── OpenRouter 后端 ───────────────────────────────────────

async function getEmbeddingOpenRouter(text, cfg) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(cfg.openrouterBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.openrouterKey}`,
        'User-Agent': AGENT,
      },
      body: JSON.stringify({ model: cfg.model, input: text }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return { ok: false, error: `OpenRouter ${res.status}: ${err.slice(0, 200)}`, model: cfg.model };
    }
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    if (!vec || !Array.isArray(vec)) return { ok: false, error: 'no_embedding_in_response', model: cfg.model };
    return { ok: true, vector: new Float32Array(vec), model: data.model || cfg.model };
  } catch (e) {
    return { ok: false, error: `openrouter_fail: ${e?.message || e}`, model: cfg.model };
  }
}

async function getEmbeddingsOpenRouter(inputs, cfg) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(cfg.openrouterBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.openrouterKey}`,
        'User-Agent': AGENT,
      },
      body: JSON.stringify({ model: cfg.model, input: inputs }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return { ok: false, error: `OpenRouter ${res.status}: ${err.slice(0, 200)}`, model: cfg.model };
    }
    const data = await res.json();
    const embeddings = data?.data;
    if (!embeddings || !Array.isArray(embeddings)) return { ok: false, error: 'no_embeddings', model: cfg.model };
    const vectors = embeddings.map(e => new Float32Array(e.embedding));
    return { ok: true, vectors, model: data.model || cfg.model };
  } catch (e) {
    return { ok: false, error: `openrouter_fail: ${e?.message || e}`, model: cfg.model };
  }
}

// ─── Ollama 后端 ───────────────────────────────────────────

async function getEmbeddingOllama(text, cfg) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const url = `${cfg.ollamaBase}/api/embeddings`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, prompt: text }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return { ok: false, error: `Ollama ${res.status}: ${err.slice(0, 200)}`, model: cfg.model };
    }
    const data = await res.json();
    const vec = data?.embedding;
    if (!vec || !Array.isArray(vec)) return { ok: false, error: 'no_embedding', model: cfg.model };
    return { ok: true, vector: new Float32Array(vec), model: cfg.model };
  } catch (e) {
    return { ok: false, error: `ollama_fail: ${e?.message || e}`, model: cfg.model };
  }
}

async function getEmbeddingsOllama(inputs, cfg) {
  const results = [];
  for (const text of inputs) {
    const r = await getEmbeddingOllama(text, cfg);
    if (!r.ok) return { ok: false, error: r.error, model: cfg.model };
    results.push(r.vector);
  }
  return { ok: true, vectors: results, model: cfg.model };
}

// ─── 向量运算工具 ───────────────────────────────────────────

/** L2 归一化 */
function normalize(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm < 1e-10) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** 余弦相似度（已归一化的向量 = 点积） */
function cosineSim(a, b) {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

/** Float32Array ↔ Buffer 互转 */
function vecToBuf(v) { return Buffer.from(v.buffer); }
function bufToVec(buf) { return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4); }

module.exports = {
  getEmbedding,
  getEmbeddings,
  normalize,
  cosineSim,
  vecToBuf,
  bufToVec,
};
