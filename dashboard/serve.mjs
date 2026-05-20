import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4312;
const STAR_OFFICE_DIR = path.resolve(__dirname, '..', '_star_office_ref', 'frontend');
const MIME = {
  '.html':'text/html;charset=utf-8',
  '.css':'text/css;charset=utf-8',
  '.js':'application/javascript;charset=utf-8',
  '.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml',
  '.ico':'image/x-icon','.woff2':'font/woff2',
};

// Mock API responses for Star-Office-UI backend
const MOCK_API = {
  '/status':                    { state: 'idle', detail: '银月修炼场运行中', officeName: '银月修炼场' },
  '/yesterday-memo':            { success: true, date: '2026-05-19', memo: '今日无昨日日记' },
  '/agents':                    [],
  '/assets/auth':               { ok: false },
  '/assets/auth/status':        { authenticated: false },
  '/assets/list':               { items: [] },
  '/assets/positions':          { ok: true, items: {} },
  '/assets/defaults':           { ok: true, items: {} },
  '/config/gemini':             { apiKey: null },
  '/assets/restore-reference-background': { ok: true },
  '/assets/restore-last-generated-background': { ok: true },
  '/assets/restore-default':    { ok: true },
  '/assets/restore-prev':       { ok: true },
  '/assets/generate-rpg-background/poll': { status: 'done', ok: false, msg: '演示模式不支持生图' },
};

const MOCK_POST = {
  '/set_state':                 { ok: true },
  '/leave-agent':               { ok: true },
  '/agent-approve':             { ok: true },
  '/agent-reject':              { ok: true },
  '/assets/auth':               { ok: false },
  '/assets/upload':             { ok: true },
  '/assets/generate-rpg-background': { ok: false, msg: '演示模式不支持生图' },
  '/config/gemini':             { ok: true },
};

http.createServer((req,res)=>{
  const urlPath = req.url.split('?')[0];

  // Redirect /star-office to /star-office?demo=1 for full demo experience
  if (urlPath === '/star-office' && !req.url.includes('demo=')) {
    res.writeHead(302, { Location: '/star-office?demo=1' });
    res.end();
    return;
  }

  // Mock API: GET
  if (MOCK_API[urlPath] !== undefined) {
    jsonResponse(res, MOCK_API[urlPath]);
    return;
  }
  // Mock API: POST
  if (req.method === 'POST' && MOCK_POST[urlPath] !== undefined) {
    jsonResponse(res, MOCK_POST[urlPath]);
    return;
  }

  // Star-Office-UI static files
  if (urlPath.startsWith('/static/')) {
    const relPath = urlPath.slice('/static/'.length);
    const fpath = path.join(STAR_OFFICE_DIR, relPath);
    serveFile(res, fpath);
    return;
  }
  if (urlPath === '/star-office' || urlPath === '/star-office?demo=1') {
    serveFile(res, path.join(STAR_OFFICE_DIR, 'index.html'));
    return;
  }

  // Dashboard static files
  let fp = urlPath === '/' ? '/index.html' : urlPath;
  serveFile(res, path.join(__dirname, fp));
}).listen(PORT,'0.0.0.0',()=>{
  console.log(`Serving dashboard at http://localhost:${PORT}`);
  console.log(`Cultivation view: http://localhost:${PORT}/cultivation.html`);
  console.log(`Star Office UI: http://localhost:${PORT}/star-office`);
});

function jsonResponse(res, data) {
  res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(data));
}

function serveFile(res, fpath) {
  const ext = path.extname(fpath);
  fs.readFile(fpath,(err,data)=>{
    if(err){
      res.writeHead(404,{'Content-Type':'text/plain'});
      res.end('Not Found');
      return;
    }
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Access-Control-Allow-Origin':'*'});
    res.end(data);
  });
}
