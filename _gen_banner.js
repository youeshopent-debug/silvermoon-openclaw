const { createCanvas } = require('canvas');
const fs = require('fs');

const W = 1500, H = 500;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#0a0a1a';
ctx.fillRect(0, 0, W, H);

const accent = '#00d4aa';
ctx.fillStyle = accent;
for (let i = 0; i < 3; i++) ctx.fillRect(0, 100 + i * 150, W, 4);

ctx.font = 'bold 52px sans-serif';
ctx.fillStyle = accent;
ctx.fillText('SilverMoon Bank', 60, 90);

ctx.font = '24px sans-serif';
ctx.fillStyle = '#ffffff';
ctx.fillText('大马开发者出海第一站', 60, 140);

const tags = ['AI 产业报告', 'Stripe/LS 收款', '申诉模板', '404 修复'];
ctx.font = '18px sans-serif';
let x = 60;
for (const tag of tags) {
  const tw = ctx.measureText(tag).width;
  ctx.fillStyle = '#1a2a3a';
  ctx.beginPath();
  ctx.roundRect(x - 8, 180, tw + 16, 35, 6);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillText(tag, x, 205);
  x += tw + 40;
}

ctx.fillStyle = '#8899aa';
ctx.font = '24px sans-serif';
ctx.fillText('Lemon Squeezy 实战指南 · 全球收款解决方案', 60, 280);

ctx.fillStyle = '#555566';
ctx.font = '18px sans-serif';
ctx.fillText('@lau_sii96989', 60, H - 30);

const buf = canvas.toBuffer('image/png');
fs.writeFileSync('twitter_banner.png', buf);
console.log('Done: twitter_banner.png');
