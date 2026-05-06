from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1500, 500
img = Image.new('RGB', (W, H), '#0a0a1a')
draw = ImageDraw.Draw(img)

accent = '#00d4aa'
gray = '#8899aa'

rect_h = 4
for i in range(3):
    y = 100 + i * 150
    draw.rectangle([0, y, W, y + rect_h], fill=accent)

try:
    font_title = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 52)
    font_sub = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 24)
    font_tag = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
except:
    font_title = ImageFont.load_default()
    font_sub = font_title
    font_tag = font_title

draw.text((60, 60), 'SilverMoon Bank', fill=accent, font=font_title)
draw.text((60, 130), '大马开发者出海第一站', fill='#ffffff', font=font_sub)

tags = ['AI 产业报告', 'Stripe/LS 收款', '申诉模板', '404 修复']
x_start = 60
for tag in tags:
    tw = draw.textlength(tag, font=font_tag)
    draw.rounded_rectangle([x_start - 8, 180, x_start + tw + 8, 215], radius=6, fill='#1a2a3a')
    draw.text((x_start, 185), tag, fill=accent, font=font_tag)
    x_start += tw + 30

draw.text((60, 260), 'Lemon Squeezy 实战指南 · 全球收款解决方案', fill=gray, font=font_sub)

draw.text((60, H - 50), '@lau_sii96989", fill='#555566', font=font_tag)

out = 'c:\\Users\\User\\.openclaw\\twitter_banner.png'
img.save(out, quality=95)
print(f'Banner saved: {out}')
