const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'social_images');

const PLATFORM_SIZES = {
  facebook: { width: 1200, height: 630 },
  x: { width: 1200, height: 675 },
  reddit: { width: 1200, height: 600 },
  article: { width: 1200, height: 800 },
};

const BRAND_COLORS = {
  primary: '#0A0A2E',
  secondary: '#1A1A4E',
  accent: '#00D4FF',
  accent2: '#7C3AED',
  text: '#FFFFFF',
  textMuted: '#A0A0C0',
  gradientStart: '#0A0A2E',
  gradientEnd: '#1A1A3E',
};

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawGradientBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, BRAND_COLORS.gradientStart);
  gradient.addColorStop(0.5, '#0F0F3A');
  gradient.addColorStop(1, BRAND_COLORS.gradientEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const gridSize = 40;
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.05)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawAccentCircle(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, hexToRgba(color, 0.15));
  gradient.addColorStop(0.5, hexToRgba(color, 0.05));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = [];
  const chars = text.split('');
  let line = '';
  for (const char of chars) {
    const testLine = line + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line.length > 0) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  return lines;
}

function drawLogo(ctx, x, y, size) {
  const s = size / 3;
  ctx.save();
  ctx.shadowColor = BRAND_COLORS.accent;
  ctx.shadowBlur = 20;
  ctx.strokeStyle = BRAND_COLORS.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, s + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const gradient = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, 0, x, y, s);
  gradient.addColorStop(0, BRAND_COLORS.accent);
  gradient.addColorStop(0.5, BRAND_COLORS.accent2);
  gradient.addColorStop(1, BRAND_COLORS.secondary);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, s, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${s * 0.9}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DC', x, y + 1);
}

function drawBottomBar(ctx, width, height) {
  const barY = height - 50;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, barY, width, 50);
  ctx.fillStyle = BRAND_COLORS.textMuted;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Deep Calm — AI-Powered Neural Calm Technology  |  deepcalm-ai.com/en', width / 2, barY + 25);
}

async function generateSocialImage(title, platform = 'facebook') {
  const size = PLATFORM_SIZES[platform] || PLATFORM_SIZES.facebook;
  const { width, height } = size;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  drawGradientBackground(ctx, width, height);
  drawAccentCircle(ctx, width * 0.8, height * 0.2, 200, BRAND_COLORS.accent);
  drawAccentCircle(ctx, width * 0.2, height * 0.8, 150, BRAND_COLORS.accent2);
  drawAccentCircle(ctx, width * 0.5, height * 0.5, 300, BRAND_COLORS.accent);

  drawLogo(ctx, 80, 60, 55);
  ctx.fillStyle = BRAND_COLORS.accent;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Deep Calm', 115, 48);

  const maxTitleWidth = width - 160;
  const titleFontSize = platform === 'x' ? 36 : 44;
  ctx.fillStyle = BRAND_COLORS.text;
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const titleLines = wrapText(ctx, title, 80, 140, maxTitleWidth, titleFontSize + 10);

  let currentY = 140;
  for (const line of titleLines) {
    ctx.fillStyle = BRAND_COLORS.text;
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    ctx.fillText(line, 80, currentY);
    currentY += titleFontSize + 10;
  }

  currentY += 20;
  ctx.fillStyle = BRAND_COLORS.accent;
  ctx.font = '20px sans-serif';
  ctx.fillText('↓ Discover the science of calm ↓', 80, currentY);

  drawBottomBar(ctx, width, height);

  const outputDir = OUTPUT_DIR;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40);
  const filename = `${platform}_${safeTitle}_${Date.now()}.png`;
  const filepath = path.join(outputDir, filename);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buf);

  return { filepath, filename, width, height, platform };
}

async function generateArticleImage(title, subtitle) {
  const { width, height } = PLATFORM_SIZES.article;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  drawGradientBackground(ctx, width, height);
  drawAccentCircle(ctx, width * 0.15, height * 0.2, 250, BRAND_COLORS.accent);
  drawAccentCircle(ctx, width * 0.85, height * 0.8, 200, BRAND_COLORS.accent2);
  drawAccentCircle(ctx, width * 0.5, height * 0.4, 350, '#00D4FF');

  drawLogo(ctx, 80, 65, 60);
  ctx.fillStyle = BRAND_COLORS.accent;
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Deep Calm', 120, 52);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(60, 140, width - 120, 2);
  ctx.fillStyle = BRAND_COLORS.accent;
  ctx.fillRect(60, 140, 80, 2);

  ctx.fillStyle = BRAND_COLORS.text;
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleLines = wrapText(ctx, title, 0, 0, width - 160, 62);
  let titleY = height / 2 - (titleLines.length * 35);
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, titleY);
    titleY += 62;
  }

  if (subtitle) {
    ctx.fillStyle = BRAND_COLORS.textMuted;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const subLines = wrapText(ctx, subtitle, 0, 0, width - 200, 30);
    let subY = titleY + 40;
    for (const line of subLines) {
      ctx.fillText(line, width / 2, subY);
      subY += 30;
    }
  }

  drawBottomBar(ctx, width, height);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40);
  const filename = `article_${safeTitle}_${Date.now()}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(filepath, buf);

  return { filepath, filename, width, height };
}

module.exports = { generateSocialImage, generateArticleImage, PLATFORM_SIZES, BRAND_COLORS };
