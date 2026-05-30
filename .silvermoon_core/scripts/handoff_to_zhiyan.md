# BWXKOEN Pro — 紫妍接力档

## 已完成资产清单

### 音频
| 文件 | 大小 | 路径 |
|------|------|------|
| 解说词 MP3 | 305 KB | `.silvermoon_core/assets/bwxkoen_pro_voiceover.mp3` |
| SRT 字幕 | 2 KB | `.silvermoon_core/assets/bwxkoen_pro_voiceover.srt` |
| 引擎 | edge-tts | `en-US-AndrewMultilingualNeural` +15% speed |

### POV 素材（6段全齐）
| ID | 源 | 文件 | 时长 | 时间线位置 |
|----|-----|------|------|-----------|
| pov_shibuya | Mixkit 4401 | `pov_shibuya_crossing.mp4` (7.5MB) | 3s | 0-3s 涩谷十字路口俯拍 |
| pov_paris_cafe | Mixkit 4350 | `pov_paris_cafe.mp4` (7.6MB) | 2.5s | 3-5.5s 露天咖啡座 |
| pov_shanghai | Mixkit 4547 | `pov_business_meeting.mp4` (8.8MB) | 2.5s | 5.5-8s 商务会议 |
| pov_tokyo_metro | Mixkit 4453 | `pov_tokyo_metro.mp4` (5.2MB) | 2.5s | 8-10.5s 东京地铁线路屏 |
| pov_tourist_anxiety | Mixkit 8757 | `pov_tourist_anxiety.mp4` (3.3MB) | 3.5s | 15-18.5s 分屏左 |
| pov_natural_chat | Mixkit 50117 | `pov_natural_chat.mp4` (4.5MB) | 3.5s | 18.5-22s 分屏右 |

### 品牌视觉
| 文件 | 用途 |
|------|------|
| `bwxkoen_end_card.svg` | End Card 背景 |
| `bwxkoen_trust_bar.svg` | 信任条 ★4.8/5 |

---

## 数字人时间线（6段）

| 时间段 | 可见 | 位置 | 比例 | 画幅 | 情绪 |
|--------|------|------|------|------|------|
| 0-3s | ❌ | — | — | — | serious→curious |
| 3-8s | ✅ | right_30 | 25% | waist_up | confident_reveal |
| 8-15s | ✅ | bottom_right | 15% | bubble_round | amazed_excited |
| 15-22s | ❌ | — | — | — | calm_data |
| 22-28s | ✅ | center | 70% | closeup | warm_sincere |
| 28-30s | ❌ | — | — | — | — |

---

## 效果叠加

- **色调**: `cold_blue_shift` 冷色调 + 高对比度
- **暗角**: 强度 0.3
- **过渡**: `swish_slide` 0.3s
- **3-8s**: OLED镜片边缘发光
- **8-15s**: OLED字幕逐字浮现
- **15-22s**: 分屏（左焦虑/右交流）+ 参数动画（32g / 48h / 6h bounce_in）
- **22-28s**: 风险逆转徽章脉冲（30-Day Risk-Free #00FF88）
- **28-30s**: End Card（产品图 + 价格 $129.99）

---

## 待生成项（product_images）

以下6张产品图目前 `pending_generate`，需要你这边设计或生成：
1. `prod_front` — 产品正面暗色背景+光效
2. `prod_temple` — 镜腿触控手势特写
3. `prod_titanium` — 钛合金镜架质感 32g
4. `prod_battery_ui` — 电池动画 48h→6h
5. `prod_trust_bar` — 已有 SVG，可直接复用
6. `prod_end_card` — End Card定妆照

---

## 配置文件

完整渲染参数在 `bwxkoen_pro_render_config.json`，导入闪剪前先读这个。
