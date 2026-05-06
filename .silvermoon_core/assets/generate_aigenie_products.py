#!/usr/bin/env python3
"""
AIGenie Vision Shopify 产品图生成器
风格: Analog Retro x Digital Minimal
色板: 暖橙 + 纸张纹理
输出: 5张 1080x1080 统一风格产品展示图
"""

import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ─── 输出目录 ───
OUT_DIR = os.path.join(os.path.dirname(__file__), "aigenie_shopify")
os.makedirs(OUT_DIR, exist_ok=True)

# ─── 色板 ───
PAPER = (245, 240, 232)       # 底色
PAPER_DARK = (237, 228, 212)  # 纹理叠加色
ORANGE_PRIMARY = (212, 118, 74)    # #D4764A
ORANGE_SECONDARY = (232, 168, 124) # #E8A87C
ORANGE_ACCENT = (201, 98, 46)      # #C9642E
ORANGE_LIGHT = (244, 208, 181)     # #F4D0B5
TEXT_DARK = (44, 36, 22)
TEXT_MUTED = (122, 107, 88)
WARM_BROWN = (180, 140, 100)
CREAM_HIGHLIGHT = (252, 248, 240)

W = H = 1080

# ─── 纹理生成 ───
def make_paper_texture(size, seed=42):
    """生成仿纸张纹理的灰度图"""
    rng = random.Random(seed)
    img = Image.new("L", size, 200)
    pix = img.load()
    for x in range(size[0]):
        for y in range(size[1]):
            n = rng.gauss(0, 6)
            v = max(0, min(255, 200 + n))
            pix[x, y] = int(v)
    return img

def apply_paper(base_img, seed=42):
    """在底色上叠纸张纹理"""
    tex = make_paper_texture(base_img.size, seed).convert("L")
    paper_layer = Image.new("RGB", base_img.size, PAPER)
    result = Image.blend(paper_layer, base_img, 0.85)
    # 叠纹理
    tex_rgb = Image.merge("RGB", [tex, tex, tex])
    result = Image.blend(result, tex_rgb, 0.12)
    return result

# ─── 字体尝试 ───
def try_fonts(size):
    """尝试加载系统字体，fallback到默认"""
    candidates = [
        "C:\\Windows\\Fonts\\calibri.ttf",
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\georgia.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except:
                continue
    return ImageFont.load_default()

FONT_NAME = try_fonts(48)
FONT_TAGLINE = try_fonts(24)
FONT_SMALL = try_fonts(18)

# ─── 产品数据 ───
PRODUCTS = [
    {
        "name": "AIGenie Vision",
        "tagline": "See the world, understand it instantly",
        "desc": "AI Smart Glasses",
        "color": ORANGE_PRIMARY,
    },
    {
        "name": "AIGenie Translator Buds Pro",
        "tagline": "Real-time translation, seamless conversation",
        "desc": "AI Translation Earbuds",
        "color": ORANGE_PRIMARY,
    },
    {
        "name": "AIGenie ScanPen",
        "tagline": "Scan any text, store everywhere",
        "desc": "AI Scanning Pen",
        "color": ORANGE_PRIMARY,
    },
    {
        "name": "AIGenie Notepad",
        "tagline": "Write naturally, digitize instantly",
        "desc": "AI Smart Notepad",
        "color": ORANGE_PRIMARY,
    },
    {
        "name": "AIGenie RecorderPen",
        "tagline": "Capture voice, transcribe automatically",
        "desc": "AI Recording Pen",
        "color": ORANGE_PRIMARY,
    },
]

# ─── 产品插图绘制函数 ───

def draw_glasses(draw, cx, cy, scale=1.0):
    """AI眼镜"""
    s = scale * 90
    # 镜框 - 两个椭圆
    # 左镜框
    draw.ellipse([cx - s - 20, cy - s//2, cx - 20, cy + s//2], 
                 outline=ORANGE_PRIMARY, width=6)
    draw.ellipse([cx - s - 14, cy - s//2 + 6, cx - 26, cy + s//2 - 6],
                 outline=ORANGE_SECONDARY, width=2)
    # 右镜框
    draw.ellipse([cx + 20, cy - s//2, cx + s + 20, cy + s//2],
                 outline=ORANGE_PRIMARY, width=6)
    draw.ellipse([cx + 26, cy - s//2 + 6, cx + s + 14, cy + s//2 - 6],
                 outline=ORANGE_SECONDARY, width=2)
    # 鼻梁
    draw.arc([cx - 20, cy - 10, cx + 20, cy + 10], 0, 180, 
             fill=ORANGE_ACCENT, width=4)
    # 眼镜腿
    draw.line([cx - s - 20, cy - 10, cx - s - 80, cy - 30], 
              fill=ORANGE_ACCENT, width=4)
    draw.line([cx + s + 20, cy - 10, cx + s + 80, cy - 30],
              fill=ORANGE_ACCENT, width=4)
    # 科技感光点
    draw.ellipse([cx - 8, cy + 8, cx + 8, cy + 24], 
                 fill=ORANGE_LIGHT, outline=ORANGE_SECONDARY, width=1)

def draw_earbuds(draw, cx, cy, scale=1.0):
    """翻译耳机"""
    s = scale * 80
    # 左耳机
    draw.ellipse([cx - s - 20, cy - s//2, cx - 20, cy + s//2 - 10],
                 fill=None, outline=ORANGE_PRIMARY, width=6)
    draw.ellipse([cx - s - 14, cy - s//2 + 6, cx - 26, cy + s//2 - 16],
                 fill=ORANGE_LIGHT, outline=ORANGE_SECONDARY, width=1)
    # 右耳机
    draw.ellipse([cx + 20, cy - s//2, cx + s + 20, cy + s//2 - 10],
                 fill=None, outline=ORANGE_PRIMARY, width=6)
    draw.ellipse([cx + 26, cy - s//2 + 6, cx + s + 14, cy + s//2 - 16],
                 fill=ORANGE_LIGHT, outline=ORANGE_SECONDARY, width=1)
    # 连接线（颈挂式）
    draw.arc([cx - s, cy - s//4, cx + s, cy + s//4], 200, 340,
             fill=ORANGE_ACCENT, width=3)
    # 声波波纹
    for i, r in enumerate(range(20, 60, 15)):
        alpha = max(0, 100 - i * 30)
        draw.arc([cx - r, cy - r, cx + r, cy + r], 270, 290,
                 fill=(*ORANGE_SECONDARY, alpha), width=2)

def draw_scanpen(draw, cx, cy, scale=1.0):
    """扫描笔"""
    s = scale * 120
    # 笔身
    pen_top = cy - s - 20
    pen_bot = cy + s - 20
    pen_w = 30
    # 笔身主体（圆角矩形模拟）
    draw.rounded_rectangle(
        [cx - pen_w, pen_top, cx + pen_w, pen_bot],
        radius=12, outline=ORANGE_PRIMARY, width=5
    )
    # 笔尖（三角形）
    draw.polygon([
        (cx - 10, pen_bot),
        (cx + 10, pen_bot),
        (cx, pen_bot + 35),
    ], outline=ORANGE_ACCENT, fill=ORANGE_LIGHT)
    # 笔夹
    draw.rectangle([cx + pen_w - 2, pen_top + 20, cx + pen_w + 8, pen_top + 60],
                   fill=ORANGE_SECONDARY)
    # 扫描头（底部发光区域）
    scan_rect = [cx - 18, pen_bot - 15, cx + 18, pen_bot]
    draw.rectangle(scan_rect, fill=None, outline=ORANGE_LIGHT, width=2)
    # 扫描光线
    for i in range(-15, 16, 5):
        draw.line([cx + i, pen_bot, cx + i, pen_bot + 40],
                  fill=(*ORANGE_LIGHT, 80 + abs(i) * 5), width=1)
    # 按钮
    draw.ellipse([cx - 8, cy - 15, cx + 8, cy + 5],
                 fill=ORANGE_ACCENT)

def draw_notepad(draw, cx, cy, scale=1.0):
    """手写板"""
    s = scale * 100
    w, h = int(s * 1.4), int(s * 1.0)
    left = cx - w // 2
    top = cy - h // 2
    right = cx + w // 2
    bottom = cy + h // 2
    # 外壳
    draw.rounded_rectangle([left, top, right, bottom], radius=15,
                           outline=ORANGE_PRIMARY, width=6)
    # 内屏
    margin = 18
    draw.rounded_rectangle([left + margin, top + margin, right - margin, bottom - margin],
                           radius=8, outline=ORANGE_SECONDARY, width=2,
                           fill=(255, 250, 240))
    # 屏幕内容 - 手写线条
    for i in range(3):
        y = top + margin + 40 + i * 50
        draw.line([left + margin + 15, y, right - margin - 15, y],
                  fill=WARM_BROWN, width=2)
        draw.line([left + margin + 15, y + 18, right - margin - 60, y + 18],
                  fill=(*WARM_BROWN, 150), width=1)
    # 手写笔
    stylus_x = right + 30
    draw.line([stylus_x, bottom - 60, stylus_x - 15, bottom - 15],
              fill=ORANGE_ACCENT, width=5)
    draw.ellipse([stylus_x - 18, bottom - 18, stylus_x - 12, bottom - 12],
                 fill=ORANGE_LIGHT)
    # 底部Home键
    draw.ellipse([cx - 10, bottom - 14, cx + 10, bottom - 4],
                 fill=ORANGE_SECONDARY, outline=ORANGE_PRIMARY, width=1)

def draw_recorderpen(draw, cx, cy, scale=1.0):
    """录音笔"""
    s = scale * 120
    pen_top = cy - s - 20
    pen_bot = cy + s - 20
    pen_w = 28
    # 笔身
    draw.rounded_rectangle(
        [cx - pen_w, pen_top, cx + pen_w, pen_bot],
        radius=10, outline=ORANGE_PRIMARY, width=5
    )
    # 笔尖
    draw.polygon([
        (cx - 8, pen_bot),
        (cx + 8, pen_bot),
        (cx, pen_bot + 30),
    ], outline=ORANGE_ACCENT, fill=ORANGE_LIGHT)
    # 录音指示灯
    draw.ellipse([cx - 8, pen_top + 25, cx + 8, pen_top + 41],
                 fill=(220, 60, 60), outline=ORANGE_ACCENT, width=1)  # Red recording light
    # 录音波纹
    for i, r in enumerate([15, 25, 35]):
        draw.arc([cx - r, pen_top + 25, cx + r, pen_top + 55],
                 180, 360, fill=(*ORANGE_SECONDARY, 200 - i*50), width=2)
    # 按钮区
    draw.rectangle([cx - 12, cy - 8, cx + 12, cy + 8],
                   fill=ORANGE_ACCENT, outline=ORANGE_PRIMARY, width=1)
    # 笔夹
    draw.rectangle([cx + pen_w - 2, pen_top + 50, cx + pen_w + 10, pen_top + 90],
                   fill=ORANGE_SECONDARY)

DRAW_FUNCS = [draw_glasses, draw_earbuds, draw_scanpen, draw_notepad, draw_recorderpen]

# ─── 主生成函数 ───
def generate_product_image(idx, product, draw_func, seed_offset=0):
    """生成单张产品图"""
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)

    # 1. 纸张纹理
    tex = make_paper_texture((W, H), 100 + idx + seed_offset)
    tex_img = Image.merge("RGB", [tex, tex, tex])
    img = Image.blend(img, tex_img, 0.15)
    draw = ImageDraw.Draw(img)

    # 2. 背景装饰 - 大圆形色块（retro catalog feel）
    circle_r = 360
    draw.ellipse([W//2 - circle_r, H//2 - circle_r - 30,
                  W//2 + circle_r, H//2 + circle_r - 30],
                 outline=(*ORANGE_LIGHT, 180), width=3)
    draw.ellipse([W//2 - circle_r - 30, H//2 - circle_r - 60,
                  W//2 + circle_r + 30, H//2 + circle_r - 60],
                 outline=(*PAPER_DARK, 120), width=1)

    # 3. 产品插图 (居中偏上)
    draw_func(draw, W // 2, H // 2 - 40)

    # 4. 底部信息区 - 暖橙分割线
    line_y = H // 2 + 240
    draw.line([W//2 - 200, line_y, W//2 + 200, line_y],
              fill=ORANGE_PRIMARY, width=3)

    # 5. 品牌名 - 右上角小标签
    draw.text((W - 80, 40), "AIGenie", fill=ORANGE_PRIMARY, font=FONT_SMALL)

    # 6. 产品名
    name_bbox = draw.textbbox((0, 0), product["name"], font=FONT_NAME)
    name_w = name_bbox[2] - name_bbox[0]
    draw.text(((W - name_w) // 2, line_y + 20), product["name"],
              fill=TEXT_DARK, font=FONT_NAME)

    # 7. 副标题
    tag_bbox = draw.textbbox((0, 0), product["tagline"], font=FONT_TAGLINE)
    tag_w = tag_bbox[2] - tag_bbox[0]
    draw.text(((W - tag_w) // 2, line_y + 80), product["tagline"],
              fill=TEXT_MUTED, font=FONT_TAGLINE)

    # 8. 产品描述 - 小字
    desc_bbox = draw.textbbox((0, 0), product["desc"], font=FONT_TAGLINE)
    desc_w = desc_bbox[2] - desc_bbox[0]
    draw.text(((W - desc_w) // 2, line_y + 115), product["desc"],
              fill=TEXT_MUTED, font=FONT_SMALL)

    # 9. 轻仿旧边框
    draw.rectangle([8, 8, W - 8, H - 8], outline=(*ORANGE_LIGHT, 200), width=2)
    draw.rectangle([14, 14, W - 14, H - 14], outline=(*PAPER_DARK, 120), width=1)

    # 10. 档案编号小标签（复古风格）
    sku = f"SKU: AG-{idx+1:03d}"
    draw.text((35, H - 45), sku, fill=TEXT_MUTED, font=FONT_SMALL)

    return img


# ─── 批量生成 ───
if __name__ == "__main__":
    for i, (prod, draw_fn) in enumerate(zip(PRODUCTS, DRAW_FUNCS)):
        fname = f"aigenie_{i+1:02d}_{prod['name'].replace(' ', '_').lower()}.png"
        out_path = os.path.join(OUT_DIR, fname)
        img = generate_product_image(i, prod, draw_fn, seed_offset=i*17)
        img.save(out_path, "PNG")
        print(f"[OK] {fname}  ({out_path})")

    print(f"\n全部完成! 5张图已保存至: {OUT_DIR}")
