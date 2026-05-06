const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Config ───
const PROXY = 'http://127.0.0.1:7890';
const IMG_DIR = path.join(__dirname, '_product_images');
const LOG_FILE = path.join(__dirname, '_img_upload.log');
const STORE = 'aigenie-hub.myshopify.com';
const TOKEN = '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';

// ─── Image Registry ───
// All CDN URLs collected from Alibaba / DHgate sourcing
const PRODUCTS = [
  {
    id: 8005574623331,
    handle: 'silvermoon-vision',
    name: 'SilverMoon Vision',
    urls: [
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/2a5d3b81e2370541d5a6b64f9a3d77e9~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=9exPlx5GB41t58CjlQGu%2BONRY7w%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/3f6cfaeff55d2de5a5c909fcb3e59e60~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=7D0AUl6f7LJOGb5BPMqek12wpxM%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/37ef9e8e307a66bb6309a203c72e8b95~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=yUTM8UZHCjn82Sm80jLgCk%2FHupA%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/f9dfc67e40d30004cc13d854f3230c44~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=1jR%2BQ8yqDfnQ%2Byhfx%2FWZvhmpJY0%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/bc51cce5a6bff2defa9ff8e0bda76f3b~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=VUTSqhlFG2fFMfE9BI%2ByJObBSYQ%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/2f3717b360c93e930b586727feefbce0~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=iW8aRfPVJOBRQOmpMlnkOmvEJvo%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/097af3a34fb676a7466e51d62f482d76~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=PyR5VfLDpKWQqR9GRBD7e%2BwR%2B%2Bc%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/f5cda4665231ccf7d52e7a5edc070ebd~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=F3xkARnKE4x%2FQB3tK5AsyQRHmmo%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/70b7541feb1c11b9b3b1796d69cc1f69~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=osSVyoq1CXOBmDf1EVyMz9fUxjo%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/78f62ef1a193ca8dd9f54297f12d0ad4~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=MuxF8WH%2FHjmzUdoYffpm0FyRy1s%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/ca2f5e34d8e49ccecc0e7550bbc71ea5~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=FyI1qPM7zXFNp8xHEYSCqFVt0tA%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/5faeff6a51af3d3b0b4f23c120e1e68e~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=YcEEHcAMl0JZYxEDHIlQ9RS0SfY%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/24b89a98814f676a38e9d6925b4f8beb~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=%2BX2G3WOs%2BK2QCjOPR2YcMF8YWMQ%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/0c05b36cb7ac2a65163c5b5e20daac1c~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=0d6Xg%2F8am11NS8JQWUYP5Zv7U78%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/a3c7fd70de44e226648d9962b1287802~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=YPUR8JNZHNNl1YHEMZuXL84T5kg%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/7f2993e3c94d73223e7b079acf1686e9~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=l9fVhEFMzm%2B1em6HS7FnNXzDNq4%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/accdd4f5b3460e83a5d3e80a3d2a86ee~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=FQ0qyMGmHXgH01FlBHvj0XHlIdA%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/1a519c801eb14ff4f065e0da86f618f7~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=W4EB3NB%2B3pQv5XGeUpjJjPynC6U%3D',
    ]
  },
  {
    id: 8006707282019,
    handle: 'silvermoon-buds-pro',
    name: 'SilverMoon Buds Pro',
    urls: [
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/091e33decbbb8995eeeb1a37fb593e02~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=bbW1VOPS8S9dHuWSOvX%2Bwo3CM4I%3D',
    ]
  },
  {
    id: 8006680871011,
    handle: 'silvermoon-scanpen-pro',
    name: 'SilverMoon ScanPen Pro',
    urls: [
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/b3f4574c679615ba0327d2a24af9e5cb~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=BoI6JX9kQbnFZQX6YUqBCyH8Mvs%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/ec3e44413d3f98c6fd0feb017089d3be~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=HttUp7BOLtYXY3NakCw3SYpQ4n4%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/be09209543cc95ea26c6f9c3b668b8b3~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268614&x-signature=VtAdQifQaYKHz%2FhksgCj4qkjRc0%3D',
    ]
  },
  {
    id: 8006680641635,
    handle: 'silvermoon-recorderpen',
    name: 'SilverMoon RecorderPen',
    urls: [
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/b9dc1e72e9c3371ec6174126f09033bb~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268774&x-signature=TUBHWyIhYMzZzFFrqDDrQbYvR8c%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/78bd5aee7fcc64d6f77ef5ce1cf0906c~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268774&x-signature=xZ6uoHJ0kKluZJ%2ByrqrdTIf45ks%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/47a9af64c990263e5bf378c1fd261e31~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268774&x-signature=zvukC2npmDEiS4S%2B0JmJL9KTUPc%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/f6791e93cf1ba605cb7c636ec61378db~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268774&x-signature=koTIvECkJr53H4qAooV6P1UC9GI%3D',
    ]
  },
  {
    id: 8006680772707,
    handle: 'silvermoon-notepad',
    name: 'SilverMoon Notepad',
    urls: [
      // Smart Digital Writing Pen (xzy)
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/e6dea3ee0afc592e2d1b54ba6fda2190~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=JcA%2B8VKhZiOHSdn1l8%2BurFWo7l8%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/986e0c608519c61494cfa3508f92b66b~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=ahJp6dDoqeGrP6XZe7n4RKt0zMU%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/3621775d4ab782cf7fb4bad9c2a85905~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=t%2BAUxfIDAxnbaAbpEYf1UXbtSF4%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/91745af58897ff2e01815196dd14d165~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=Vm6Zl69PBXwUad5feDUbgroD5QI%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/6557ec73689247f74932765c4a949f3b~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=FXRU6dGEYNPtIs6D%2B3rGGs%2F%2BNrs%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/84cf6e00c90835bea98015c2524203d8~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=P06UH%2Fl1gtDSRWjt5O2mSN1puT0%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/8bf21919ad4acd5f56d33aafa3226ab8~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=wVFmgvn1%2FpZxiFnzuFXZi%2FLsDSM%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/d6f217d5f2117cf2adaa5b1a74e1d4c5~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=slplTwumN6%2FICS9DulvLwRLXzvY%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/d22c1a2e5d7545527913267fd4897084~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=CHP9q9QFV69YRzzDxGS6yArWgMU%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/img/0bbccbd2f6308490c79cfc8d9a5618a0~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=T47Fp19j0HOuhaKZyf0KvMNmMME%3D',
      // Huion Note X10
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/80950b5533f30a926423119366076ab9~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=WMOWLVikVMXxw2B9Emv9q2vyG7k%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/36f385764301275c27481d58ab106b09~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=Eg2yhPqWfNsdu9XNZi%2BAZv%2BdNBQ%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/083bd445d50e6ec8c9d1a3c22615806f~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=yH4a%2BAd4uLtbT4RK0IVndsV22mU%3D',
      'https://p19-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/a26fc5c02aa829eb9186fe1a72d99a95~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=8uEXd2ifDYRAZBuuu3OYGv7w6eY%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/3af7bddf1897bb97a17aa1ca72139737~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=Ph9R7NhiqTmnNTUNuuCCaoQIkPI%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/5e5251d2f8188cf093402046042b7488~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=MsiktuRr7z3xVQu0gdJdvYgzHD4%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/7c632ad98cad1457591e897d75506f16~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=igMrJP5%2BmjRbMU6kCmpKl%2FQ%2FIfA%3D',
    ]
  },
  {
    id: 8006707314787,
    handle: 'silvermoon-writepad',
    name: 'SilverMoon WritePad',
    urls: [
      // Huion Note X10 images (shows digital writing pad)
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/a26fc5c02aa829eb9186fe1a72d99a95~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=8uEXd2ifDYRAZBuuu3OYGv7w6eY%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/7c632ad98cad1457591e897d75506f16~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=igMrJP5%2BmjRbMU6kCmpKl%2FQ%2FIfA%3D',
      'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/d22c1a2e5d7545527913267fd4897084~tplv-h9hire4aei-image.jpeg?rk3s=add9cc80&x-expires=1783268903&x-signature=CHP9q9QFV69YRzzDxGS6yArWgMU%3D',
    ]
  },
];

// ─── Helpers ───

function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + '\n');
}

function downloadViaProxy(urlStr, destPath) {
  return new Promise((resolve) => {
    const urlObj = new URL(urlStr);
    const useHttps = urlObj.protocol === 'https:';
    const mod = useHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 30000,
    };

    const req = mod.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadViaProxy(res.headers.location, destPath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        resolve({ ok: false, error: `HTTP ${res.statusCode}` });
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(destPath).size;
        resolve({ ok: true, size });
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.end();
  });
}

function uploadToShopify(productId, imagePath, filename) {
  return new Promise((resolve) => {
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const data = fs.readFileSync(imagePath);
    const attachment = data.toString('base64');

    const body = JSON.stringify({
      image: {
        attachment,
        filename: path.basename(filename),
      }
    });

    const urlObj = new URL(`https://${STORE}/admin/api/2025-10/products/${productId}/images.json`);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: `HTTP ${res.statusCode}: ${data.slice(0, 200)}` });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

// ─── Main ───

async function main() {
  log('=== START: Download + Upload Product Images ===');

  let totalDownloaded = 0;
  let totalFailed = 0;
  let totalUploaded = 0;
  let totalUploadFailed = 0;

  for (const product of PRODUCTS) {
    const prodDir = path.join(IMG_DIR, product.handle);
    if (!fs.existsSync(prodDir)) fs.mkdirSync(prodDir, { recursive: true });

    log(`\n--- ${product.name} (ID: ${product.id}) ---`);
    log(`  URLs to try: ${product.urls.length}`);

    const downloadedFiles = [];

    for (let i = 0; i < product.urls.length; i++) {
      const url = product.urls[i];
      const ext = url.includes('/img/') ? '.png' : '.jpeg';
      const fname = `image-${String(i + 1).padStart(2, '0')}${ext}`;
      const destPath = path.join(prodDir, fname);

      // Skip if already downloaded
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
        downloadedFiles.push(destPath);
        log(`  [SKIP] ${fname} (already exists)`);
        continue;
      }

      const result = await downloadViaProxy(url, destPath);
      if (result.ok && result.size > 1000) {
        downloadedFiles.push(destPath);
        totalDownloaded++;
        log(`  [OK] ${fname} (${(result.size / 1024).toFixed(1)}KB)`);
      } else {
        totalFailed++;
        log(`  [FAIL] ${fname}: ${result.error || 'empty or too small'}`);
      }
    }

    if (downloadedFiles.length === 0) {
      log(`  ⚠ No images downloaded for ${product.name}, skipping upload`);
      continue;
    }

    // Upload to Shopify
    log(`  Uploading ${downloadedFiles.length} images to Shopify...`);
    for (const filePath of downloadedFiles) {
      const fname = path.basename(filePath);
      const result = await uploadToShopify(product.id, filePath, fname);
      if (result.ok) {
        totalUploaded++;
        log(`  [UPLOAD OK] ${fname}`);
      } else {
        totalUploadFailed++;
        log(`  [UPLOAD FAIL] ${fname}: ${result.error}`);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
  }

  log(`\n=== SUMMARY ===`);
  log(`Downloaded: ${totalDownloaded}, Failed: ${totalFailed}`);
  log(`Uploaded: ${totalUploaded}, Upload Failed: ${totalUploadFailed}`);
  log(`Images saved to: ${IMG_DIR}`);
  log('=== DONE ===');
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
