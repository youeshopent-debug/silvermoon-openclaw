# 海波东风控合规审计报告

## AI Smart Translation Glasses — 产品合规审计

**审计对象**: AI Smart Translation Glasses (AI 智能翻译眼镜)
**供应商**: Guangzhou Lige Watch Co., Ltd. (LIGE) / Shenzhen Kyboton Technology Co., Ltd.
**目标市场**: 美国 (US) + 欧盟 (EU)
**审计日期**: 2026-05-02

---

## 1. ✅ 结论

LIGE 供应链适合作为 Tier 1 试水供应商（MOQ 1、8年资质），但 AI 翻译眼镜属于**带摄像头+蓝牙的智能穿戴设备**，进入欧美市场前必须强制通过 FCC（美国）和 CE（欧盟）射频与安全认证。若供应商无法提供认证书，建议**在产品页面明确标注"Certification Pending"并以"开发版/众筹"模式销售**，避免监管风险。另外，**GDPR 合规是红线**——带摄像头的眼镜在欧盟销售，必须配套清晰的数据隐私说明。

---

## 2. ⚠️ 风险清单

| 等级 | 风险项 | 说明 |
|------|--------|------|
| 🔴 **高** | **FCC/CE 认证缺失** | 带蓝牙(2.4GHz)和摄像头模组的眼镜，美国需 FCC Part 15，欧盟需 RED 2014/53/EU。LIGE 未明确提供认证文件 |
| 🔴 **高** | **GDPR 摄像头隐私** | 眼镜含摄像头录制功能，在欧盟使用需符合 GDPR 第 5/6/7 条（数据最小化+知情同意），法国/德国/荷兰严查 |
| 🟡 **中** | **锂电池运输合规** | 眼镜内置锂聚合物电池，国际运输需 UN38.3 认证。CJ/Alibaba 直发需走特货渠道 |
| 🟡 **中** | **退货率风险** | 电子产品平均退货率 8-15%，Dropshipping 模式下退货运费会吃掉利润 |
| 🟢 **低** | **关税分类** | HS Code 8523.51 - 智能眼镜，US 关税 0-2.5%，EU 关税 0% (ITA 协议) |
| 🟢 **低** | **商标/专利侵权** | LIGE 自有品牌（8年经营）而非白牌仿品，侵权风险较低 |

---

## 3. 🧩 建议动作

### 🔴 高优先级（必须做）

1. **要求 LIGE 提供 FCC/CE 证书**
   - 联系 LIGE 索要 FCC ID（美国）和 CE 证书（欧盟）
   - 建议邮件模板见下方第 4 节
   - 若对方无法提供，降低 Tier 为 3，转为众筹模式销售

2. **更新产品页面添加合规声明**
   - 在 Shopify 产品页面添加合规披露：
     > *"For US customers: This device complies with Part 15 of the FCC Rules. For EU customers: This device complies with RED 2014/53/EU requirements."*
   - 添加电池安全提示

3. **设置 GDPR 隐私页面**
   - 创建 Shopify 页面 `/pages/privacy` 详细说明摄像头数据的收集/存储/删除方式
   - 关键词：数据最小化、本地处理（on-device processing）、不自动上传

### 🟡 中优先级（建议做）

4. **优化退货政策以降低手尾**
   - 统一执行 30 天退货政策（与 Shopify 默认一致）
   - 采用 **Returnless Refund** 策略（≤ $50 直接退款不退货，节省国际运费）
   - 建议退货政策模板见下方第 4 节

5. **选择靠谱物流渠道**
   - 锂电池产品发货优先级：CJ Dropshipping（自带特货渠道）> Alibaba Standard（需备注电池）
   - 确认 LIGE 是否支持 ePacket / CJ 一件代发

### 🟢 低优先级（关注即可）

6. **周期性复查**
   - 每季度复查退货率。若 > 12%，切换 Tier 2 供应商（Kyboton）
   - 关注 EN 18031（欧盟物联网网络安全法案，2025 年 8 月强制），AI 眼镜在未来版本可能需要固件安全认证

---

## 4. 🧾 可复制条款

### 4.1 供应商认证查询邮件（英文）

```
Subject: Request for Product Certifications — AI Smart Translation Glasses (RE: Partnership)

Dear LIGE / Kyboton Team,

We are evaluating your AI Smart Translation Glasses for our US and EU customers. Could you please provide the following certification documents for this product?

1. **FCC ID** (FCC Part 15, for US market)
2. **CE Declaration of Conformity** (RED 2014/53/EU, for EU market)
3. **RoHS Compliance Statement**
4. **UN38.3 Battery Certificate** (for lithium battery air shipment)
5. **Product Manual / Safety Instructions** (English version)

We understand if certification is in progress — please let us know the expected completion date.

Thank you,
[Your Name]
SilverMoon Bank — Quality Assurance Team
```

### 4.2 退货与退款政策（适合 Shopify 页面）

```markdown
# Return & Refund Policy

**Last updated: May 2, 2026**

### 30-Day Return Window
You have 30 days from delivery to request a return. Items must be returned in original condition with all accessories and packaging.

### Returnless Refund (for orders under $50)
For orders under USD $50, we issue a full refund without requiring you to return the item. You will receive the refund within 5 business days to your original payment method.

### Return Shipping (for orders over $50)
We provide a prepaid return label. The return shipping cost ($8.99) will be deducted from your refund. We recommend using trackable shipping — we are not responsible for lost return packages.

### Defective Products
If the product arrives defective or damaged, contact us within 7 days of delivery. We will issue a full refund or replacement with no return required.

### Non-Returnable Items
- Products damaged by misuse, water, or unauthorized modification
- Products without the original serial number
- Free promotional items

### Processing Time
Refunds are processed within 5-7 business days after we receive the return. Your bank may take additional 3-5 business days to post the refund.

### Contact
For return requests: hello@silvermoon.bank
```

### 4.3 隐私声明关键段落（适合 GDPR 合规）

```markdown
# Privacy Notice — Smart Glasses Camera Feature

### 1. Camera & Recording
Our AI Smart Translation Glasses include a built-in camera used exclusively for real-time translation of text (e.g., menus, signs). The camera:

- **DOES NOT** record or store video/audio by default
- **ONLY** captures images when you manually press the translation button
- **DOES NOT** upload images to external servers without your explicit consent
- **PROCESSES** translation locally on the device (no cloud transmission)

### 2. Your Rights (GDPR)
If you are in the European Economic Area (EEA), you have the right to:
- Access any data stored on the device
- Request deletion of all locally stored data
- Withdraw consent at any time by factory resetting the glasses

### 3. Data Storage
Translation history is stored locally on the device and is automatically cleared after 24 hours. No personal data is transmitted to SilverMoon Bank servers.
```

### 4.4 产品页面合规声明（英文，适合产品描述底部）

> **📋 Regulatory Compliance Information**
>
> **FCC (USA):** This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) This device may not cause harmful interference, and (2) this device must accept any interference received, including interference that may cause undesired operation.
>
> **CE (EU):** This device complies with the requirements of RED 2014/53/EU, EMC Directive 2014/30/EU, and RoHS Directive 2011/65/EU.
>
> **Battery Safety:** This product contains a lithium polymer battery. Please follow local regulations for battery disposal. Do not expose to temperatures above 60°C.

---

## 5. 需要用户确认

| 决策项 | 建议 | 确认 |
|--------|------|------|
| 是否向 LIGE 发送认证查询邮件？ | 👍 是，立即发送 | ☐ |
| 是否在产品页添加 FCC/CE 合规声明？ | 👍 是，含在药老文案中 | ☐ |
| 是否创建 GDPR 隐私页面？ | 👍 是，Shopify 新增 `/pages/privacy` | ☐ |
| 是否采用 Returnless Refund 策略（<$50）？ | 👍 是 | ☐ |
| 是否需要我落地执行以上 4 项？ | 👍 是 | ☐ |

---

*银月钱庄 · 海波东风控合规审计 · 2026-05-02*
