const https = require('https');
const fs = require('fs');
const path = require('path');

// 原生 .env 加载器（无需 dotenv 包）
try {
  const envRaw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const API_KEY = process.env.LEMON_SQUEEZY_API_KEY;
if (!API_KEY) {
  console.error('❌ 环境变量 LEMON_SQUEEZY_API_KEY 未设置');
  console.error('  请在 .env 文件中添加: LEMON_SQUEEZY_API_KEY=your_key_here');
  process.exit(1);
}
const BASE = 'https://api.lemonsqueezy.com/v1';
const STORE_ID = '341601';
const HEADERS = {
  'Accept': 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
  'Authorization': `Bearer ${API_KEY}`
};

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    https.get(url, { headers: HEADERS }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse failed: ${data.slice(0,200)}`)); }
      });
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`LS API ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        }
        catch { reject(new Error(`Parse failed (${res.statusCode}): ${data.slice(0,300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function put(urlStr, fileBuffer) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0,200) }));
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

function multipartPost(apiPath, fields, fileField, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = filePath.split(/[\\/]/).pop();
    let parts = [];

    for (const [k, v] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const payload = Buffer.concat(parts);
    const url = new URL(apiPath, BASE);

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        'Accept': 'application/vnd.api+json'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ status: res.statusCode, raw: data.slice(0,200) }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function createProduct(title, description) {
  return post('/v1/products', {
    data: {
      type: 'products',
      attributes: { title, description },
      relationships: {
        store: { data: { type: 'stores', id: STORE_ID } }
      }
    }
  });
}

async function createVariant(productId, name, priceCents) {
  return post('/v1/variants', {
    data: {
      type: 'variants',
      attributes: {
        name,
        price: priceCents,
        is_subscription: false,
        has_free_trial: false
      },
      relationships: {
        product: { data: { type: 'products', id: String(productId) } }
      }
    }
  });
}

async function uploadFile(filePath, variantId) {
  return multipartPost('/v1/files', {
    variant_id: String(variantId)
  }, 'file', filePath);
}

const action = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];
const arg3 = process.argv[5];
const arg4 = process.argv[6];
const arg5 = process.argv[7];

(async () => {
  try {
    switch (action) {
      case 'orders':
        console.log(JSON.stringify(await get('/v1/orders'), null, 2));
        break;

      case 'products':
        console.log(JSON.stringify(await get('/v1/products'), null, 2));
        break;

      case 'create-product':
        if (!arg1) throw new Error('用法: node _fetch_ls.js create-product "标题" "描述"');
        const prod = await createProduct(arg1, arg2 || '');
        const prodId = prod.data?.id || prod.data?.data?.id;
        console.log(JSON.stringify({ ok: true, productId: prodId, product: prod }, null, 2));
        break;

      case 'create-variant':
        if (!arg1 || !arg2 || !arg3) throw new Error('用法: node _fetch_ls.js create-variant <productId> "名称" <价格美分>');
        const varResult = await createVariant(arg1, arg2, parseInt(arg3));
        console.log(JSON.stringify({ ok: true, variant: varResult }, null, 2));
        break;

      case 'upload-file':
        if (!arg1 || !arg2) throw new Error('用法: node _fetch_ls.js upload-file <filePath> <variantId>');
        const fileResult = await uploadFile(arg1, arg2);
        console.log(JSON.stringify({ ok: true, file: fileResult }, null, 2));
        break;

      case 'full-publish':
        if (!arg1 || !arg2 || !arg3 || !arg4) throw new Error('用法: node _fetch_ls.js full-publish "标题" "描述" "变体名" <价格美分> [PDF路径]');
        const p = await createProduct(arg1, arg2);
        const pid = p.data?.id || p.data?.data?.id;
        if (!pid) throw new Error(`创建产品失败: ${JSON.stringify(p)}`);
        console.log(`✅ 产品创建成功 ID: ${pid}`);
        const v = await createVariant(pid, arg3, parseInt(arg4));
        const vid = v.data?.id || v.data?.data?.id;
        if (!vid) throw new Error(`创建变体失败: ${JSON.stringify(v)}`);
        console.log(`✅ 变体创建成功 ID: ${vid}`);
        if (arg5) {
          const f = await uploadFile(arg5, vid);
          console.log(`✅ 文件上传成功: ${JSON.stringify(f).slice(0,200)}`);
        }
        console.log(JSON.stringify({ ok: true, productId: pid, variantId: vid }, null, 2));
        break;

      case 'create-checkout':
        if (!arg1) throw new Error('用法: node _fetch_ls.js create-checkout <variantId> [价格美分(可选)]');
        const checkoutBody = {
          data: {
            type: 'checkouts',
            relationships: {
              store: { data: { type: 'stores', id: STORE_ID } },
              variant: { data: { type: 'variants', id: String(arg1) } }
            }
          }
        };
        if (arg2) checkoutBody.data.attributes = { checkout_data: { custom: { price: parseInt(arg2) } } };
        const checkout = await post('/v1/checkouts', checkoutBody);
        const chkUrl = checkout.data?.attributes?.url;
        console.log(JSON.stringify({ ok: true, checkoutUrl: chkUrl, checkout }, null, 2));
        break;

      case 'product':
        if (!arg1) throw new Error('用法: node _fetch_ls.js product <productId>');
        console.log(JSON.stringify(await get(`/v1/products/${arg1}`), null, 2));
        break;

      case 'variant':
        if (!arg1) throw new Error('用法: node _fetch_ls.js variant <variantId>');
        console.log(JSON.stringify(await get(`/v1/variants/${arg1}`), null, 2));
        break;

      default:
        console.log('可用命令: orders | products | product <id> | variant <id> | create-checkout <variantId> [price] | create-product | create-variant | upload-file | full-publish');
    }
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: e.message }, null, 2));
    process.exit(1);
  }
})();
