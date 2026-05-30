const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const urls = [
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/7f750af9a51f2be175d97254e0ff33b5~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/b5127d4eac541c8908b6aed8d1159ae5~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/ab550376776db2d5108b32c25c5dd36a~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/c0554a2641e5193af7daa4f6246b6629~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/6a86c861cd3a9bab1dae8358d282d832~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/beba22709ca999a24593c2f77236e342~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/71a480e0ef526ff8245aae5c3456c082~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/87c2102ee8f5a61960033adc7e9894f2~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/4b8d85d5b58bb4279586d174611e410b~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/1e544833e347d9ad40080b476b3facb4~tplv-h9hire4aei-image.jpeg',
  'https://p19-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/128df82bb272557c43fab73bfb103b01~tplv-h9hire4aei-image.jpeg',
  'https://p19-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/548c479ae7b4684fb59ddf6fe697c698~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/9ec5edf3a634d689d9bf384ddbc4b619~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/e4492e168da05ef58752791181b6cccf~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/918f8f8a2b160773bc05f890ca734708~tplv-h9hire4aei-image.jpeg',
  'https://p16-cc-image-search-sign-sg.ibyteimg.com/tos-alisg-i-h9hire4aei-sg/image/eac5fc89972ba7e2473b0c765cc24c05~tplv-h9hire4aei-image.jpeg'
];

const names = [
  'bwxkoen_main.jpg', 'bwxkoen_01_model.jpg', 'bwxkoen_02_angle.jpg',
  'bwxkoen_03_wear.jpg', 'bwxkoen_04_side.jpg', 'bwxkoen_05_features.jpg',
  'bwxkoen_06_translate.jpg', 'bwxkoen_07_chrome.jpg',
  'bwxkoen_09_colors.jpg', 'bwxkoen_11_battery.jpg',
  'bwxkoen_08_box.jpg', 'bwxkoen_10_boneconduction.jpg',
  'bwxkoen_12_app.jpg', 'bwxkoen_13_case.jpg',
  'bwxkoen_14_detail.jpg', 'bwxkoen_15_specs.jpg'
];

const dir = path.join(__dirname, '..', 'assets', 'bwxkoen_product');
fs.mkdirSync(dir, { recursive: true });

const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let ok = 0;
let done = 0;

function download(i) {
  const file = path.join(dir, names[i]);
  if (fs.existsSync(file)) { done++; ok++; console.log(`[SKIP] ${names[i]}`); if (done === urls.length) printDone(); return; }

  const url = new URL(urls[i]);
  const opts = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: { 'User-Agent': ua, 'Referer': 'https://www.dhgate.com/' }
  };

  https.get(opts, (res) => {
    if (res.statusCode !== 200) {
      console.log(`[FAIL] ${names[i]} HTTP ${res.statusCode}`);
      done++;
      if (done === urls.length) printDone();
      return;
    }
    const ws = fs.createWriteStream(file);
    res.pipe(ws);
    ws.on('finish', () => {
      const size = fs.statSync(file).size;
      console.log(`[OK] ${names[i]} (${(size/1024).toFixed(0)} KB)`);
      ok++; done++;
      if (done === urls.length) printDone();
    });
    ws.on('error', (e) => {
      console.log(`[FAIL] ${names[i]}: ${e.message}`);
      done++;
      if (done === urls.length) printDone();
    });
  }).on('error', (e) => {
    console.log(`[FAIL] ${names[i]}: ${e.message}`);
    done++;
    if (done === urls.length) printDone();
  });
}

function printDone() {
  console.log(`\n完成! ${ok}/${urls.length} 下载成功`);
  console.log(`目录: ${dir}`);
}

for (let i = 0; i < urls.length; i++) download(i);
