# BWXKOEN Pro — 数字人视频执行方案 (第二弹)
# 基于: flashshow_script_02.md (小医仙分镜)
# 制作: 紫妍 (数字人运营专家)
# 目标: TikTok / Instagram Reels / YouTube Shorts — 30s
# 日期: 2026-05-03

---

## 1. 配音生成指令

### 1.1 台词全文 (共5段, 28s有声)

```text
[SEG-1 / 0s-3s / Hook]
Stop scrolling if you have ever felt completely lost in a foreign country.

[SEG-2 / 3s-8s / Reveal]
This is not a $3,500 Apple Vision Pro. It's not a bulky AR headset. This is BWXKOEN Pro — real-time AI translation glasses that work the moment you put them on.

[SEG-3 / 8s-15s / Demo]
Here is what happens: Someone speaks. The AI translates in under 200 milliseconds. The words appear right here — floating in your vision. No phone. No awkward pauses. Just conversation.

[SEG-4 / 15s-22s / Trust]
32 grams. Titanium frame. Bone conduction audio that keeps you aware of your surroundings. 48 hours standby, 6 hours of continuous translation. And yes — it works with your prescription lenses.

[SEG-5 / 22s-28s / CTA]
Try it for 30 days. If it doesn't change the way you travel — send it back. No questions. No restocking fees. We even cover return shipping. Link in bio.
```

### 1.2 配音参数

| 参数 | 值 |
|------|-----|
| 引擎 | edge-tts (Microsoft Neural) |
| 音色 | `en-US-AndrewMultilingualNeural` (男声, 温暖自信) |
| 语速 | `--rate=+15%` (比正常快15%, 保持节奏) |
| 输出路径 | `.silvermoon_core/assets/bwxkoen_pro_voiceover.mp3` |
| 字幕路径 | `.silvermoon_core/assets/bwxkoen_pro_voiceover.srt` |

### 1.3 执行命令

```powershell
uvx edge-tts --voice en-US-AndrewMultilingualNeural --rate=+15% --text "Stop scrolling if you have ever felt completely lost in a foreign country. This is not a $3,500 Apple Vision Pro. It's not a bulky AR headset. This is BWXKOEN Pro — real-time AI translation glasses that work the moment you put them on. Here is what happens: Someone speaks. The AI translates in under 200 milliseconds. The words appear right here — floating in your vision. No phone. No awkward pauses. Just conversation. 32 grams. Titanium frame. Bone conduction audio that keeps you aware of your surroundings. 48 hours standby, 6 hours of continuous translation. And yes — it works with your prescription lenses. Try it for 30 days. If it doesn't change the way you travel — send it back. No questions. No restocking fees. We even cover return shipping. Link in bio." --write-media .silvermoon_core/assets/bwxkoen_pro_voiceover.mp3 --write-subtitles .silvermoon_core/assets/bwxkoen_pro_voiceover.srt
```

---

## 2. 数字人情绪与动作指令

### 2.1 时间轴情绪映射

| 时间段 | 情绪基调 | 面部指令 | 肢体动作 |
|--------|---------|---------|---------|
| **0s-3s** | 严肃→好奇 | 眉头微皱, 眼神专注, 嘴唇微张(似在观察) | 数字人不在画面, POV 镜头为主 |
| **3s-8s** | 自信→揭谜 | 眉毛上挑, 嘴角带一丝自信微笑, 眼神从镜头移开再切回 | 入镜时右手自然指向镜腿位置; 说到"Not $3,500"时微微摇头 |
| **8s-15s** | 惊叹→兴奋 | 眼睛略睁大, 表情丰富, 说到"floating in your vision"时眼神向上 | 右下角小窗可配合点头; 手做"浮现"手势(掌心向上抬起) |
| **15s-22s** | 沉稳→数据感 | 表情收敛, 眼神坚定, 嘴唇微闭说数字 | 可用手指轻点太阳穴(示意佩戴); 说到"prescription"时点头 |
| **22s-28s** | 温暖→真诚 | 眉眼下弯, 真诚微笑, 直视镜头 | 身体微微前倾; 说到"Link in bio"时手指向画面下方 |

### 2.2 语调控制

| 段落 | 语调要求 |
|------|---------|
| SEG-1 (0-3s) | 压低声音, 语速略慢, 制造悬念 |
| SEG-2 (3-8s) | 逐词加重, "Not $3,500" 升调强调 |
| SEG-3 (8-15s) | 快速节奏, 每句末尾略升调, 保持兴奋感 |
| SEG-4 (15-22s) | 平稳匀速, 数字词(32/48/6)略微加重 |
| SEG-5 (22-28s) | 语速放慢5%, 温暖感, "send it back"语气轻松 |

---

## 3. 闪剪 (FlashShow) 渲染参数

### 3.1 基础设置

| 参数 | 值 |
|------|-----|
| 分辨率 | 1080×1920 (9:16 竖屏) |
| 帧率 | 30fps |
| 时长 | 30 秒 |
| 数字人位置 | 动态(详见 3.2) |
| 数字人大小 | 变焦(详见 3.2) |
| 背景 | 纯色/绿幕后期替换 |

### 3.2 数字人景别时间轴

| 时间 | 景别 | 位置 | 画面占比 | 说明 |
|------|------|------|---------|------|
| 0s-3s | ❌ 无数字人 | — | 0% | 纯 POV 第一人称画面 (东京涩谷街景) |
| 3s-8s | 中近景 (Waist-up) | 画面右侧 30% | ~25% | 数字人从右侧入镜, 左侧留白给产品大字 |
| 8s-15s | 小窗 (Bubble) | 右下角 | ~15% | 圆形/圆角矩形小窗, 主画面为3段POV演示 |
| 15s-22s | ❌ 无数字人 | — | 0% | 纯分屏对比 + 参数动画 |
| 22s-28s | 特写 (Close-up) | 居中 | ~70% | 数字人面部特写, 肩膀以上 |
| 28s-30s | ❌ 无数字人 | — | 0% | 产品定妆照 End Card |

### 3.3 字幕动画参数

| 参数 | 值 |
|------|-----|
| 样式 | Alex Hormozi 弹跳式动态字幕 |
| 高亮色 | `#00D4FF` (品牌青蓝) |
| 次要色 | `#FFFFFF` (白色) |
| 每行上限 | 6 个单词 |
| 动画 | 单词逐个弹入 → 保持 → 整行淡出 |
| 位置 | 画面中下部 (避开数字人面部) |

### 3.4 BGM 与音效

| 时段 | BGM 类型 | 音量 | 音效 |
|------|---------|------|------|
| 0s-8s | 环境音(都市低频) → 科技鼓点淡入 | -24dB → -18dB | 眼镜 OLED 亮起的柔光 SFX (0.5s) |
| 8s-22s | Tech/Phonk 节奏鼓点 | -18dB (人声优先) | 每段切换带轻微 "swish" 过渡音 |
| 22s-28s | 鼓点收束 + 和弦终结 | -20dB | 风险逆转徽章 "ding" 音效 |
| 28s-30s | 品牌尾音 (fade out) | -24dB→silence | — |

### 3.5 视觉特效

| 特效 | 使用位置 | 参数 |
|------|---------|------|
| 色彩滤镜 | 全片 | 轻微冷色调(青蓝倾向), 高对比度, 暗角晕影 |
| OLED 字幕动画 | 3s-8s, 8s-15s | 镜片边缘光效 + 字幕逐字浮现 |
| 分屏对比 | 15s-22s | 左屏掏手机焦虑 / 右屏自然交流, 中间分界线 |
| 参数数字动画 | 15s-22s | 32g / 48h / 6h 弹跳出现 + 底部进度条 |
| 风险逆转徽章 | 22s-28s | "30-Day Risk-Free" 绿色徽章脉冲动画 |
| End Card | 28s-30s | 产品图暗色背景 + 光效轮廓, 底部品牌名+价格 |

---

## 4. 画面素材需求清单

蓝灵儿需要准备以下素材:

### 4.1 POV 实拍/素材 (0-3s, 8-15s)

| # | 场景 | 时长 | 需求 |
|---|------|------|------|
| 1 | 东京涩谷十字路口 (POV 第一人称) | 3s | 日文招牌快速闪过, 轻微晃动感 |
| 2 | 巴黎咖啡馆 (POV 看服务员) | 2.5s | 服务员说法语, 镜片显示英文翻译 (OLED 字幕飘动) |
| 3 | 上海商务会议 (POV 看对方) | 2.5s | 对方说中文, 骨传导音频传出英文 (表情微笑点头) |
| 4 | 东京地铁 (POV 看路牌) | 2.5s | 日文路牌, 镜片叠加英文方向箭头 (导航模式) |
| 5 | 游客掏手机焦虑 (分屏左) | 3.5s | 普通游客不停掏手机→翻译→放回→再掏的焦虑循环 |
| 6 | 佩戴眼镜自然交流 (分屏右) | 3.5s | 佩戴 BWXKOEN Pro 的人自然微笑交流, 不动声色 |

### 4.2 产品素材 (3-8s, 15-22s, 28-30s)

| # | 内容 | 需求 |
|---|------|------|
| 1 | BWXKOEN Pro 产品图 (正面) | 暗色背景, 光效轮廓, 高分辨率 PNG |
| 2 | 镜腿特写 (点击触控) | 手指轻点镜腿的静帧/动图 |
| 3 | 钛合金镜架特写 | 展示 32g 轻盈感, 金属质感 |
| 4 | 电池图标动画 UI | 48h → 6h 进度条动画 (可 AE/Canva 生成) |
| 5 | 底部信任条 | ★ 4.8/5 (2,400+ reviews) 静态条 |
| 6 | End Card 定妆照 | 产品居中 + 底部 BWXKOEN Pro $129.99 silvermoon.bank |

---

## 5. 字幕文件 (SRT)

生成配音后, 同步生成 SRT 字幕文件。手动时间戳参考:

```
1
00:00:00,500 --> 00:00:03,000
Stop scrolling if you have ever
felt completely lost in a foreign country.

2
00:00:03,500 --> 00:00:08,000
This is not a $3,500 Apple Vision Pro.
Not a bulky AR headset.
This is BWXKOEN Pro.

3
00:00:08,500 --> 00:00:15,000
Real-time AI translation glasses
that work the moment you put them on.
100+ languages. 200ms latency.

4
00:00:15,500 --> 00:00:22,000
32 grams. Titanium frame.
Bone conduction audio.
48h standby. Prescription ready.

5
00:00:22,500 --> 00:00:28,000
Try it for 30 days — risk-free.
Free shipping worldwide.
Link in bio.
```

---

## 6. 执行检查清单

- [ ] 蓝灵儿运行 edge-tts 命令生成配音 (`.silvermoon_core/assets/bwxkoen_pro_voiceover.mp3`)
- [ ] 蓝灵儿生成 SRT 字幕 (`.silvermoon_core/assets/bwxkoen_pro_voiceover.srt`)
- [ ] 蓝灵儿准备 POV 素材 (6段视频素材, 见 4.1)
- [ ] 蓝灵儿准备产品素材 (6组图片/动画, 见 4.2)
- [ ] 蓝灵儿导入闪剪: 数字人配置 + 配音 + 素材
- [ ] 蓝灵儿按 3.2 景别时间轴编排数字人
- [ ] 蓝灵儿配置字幕动画 (Alex Hormozi 弹跳式, #00D4FF)
- [ ] 蓝灵儿配置 BGM (Tech/Phonk, 按 3.4 音量曲线)
- [ ] 蓝灵儿添加视觉特效 (色彩滤镜/暗角/过渡)
- [ ] 紫妍验收最终成片

---

## 7. Revision History

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| v1.0 | 2026-05-03 | 初始执行方案 — 基于 flashshow_script_02.md 完整转换 | 紫妍 |
