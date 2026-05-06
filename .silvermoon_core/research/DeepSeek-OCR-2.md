# DeepSeek-OCR-2 研究笔记

> 来源：https://github.com/deepseek-ai/DeepSeek-OCR-2
> 存档日期：2026-04-29
> 状态：待评估（显存不足，暂不部署）

## 概述
DeepSeek 出品的 OCR 模型，将图片中的文档/文字转为 Markdown。
7B 参数，需要 GPU 8GB+ 显存。

## 技术栈
- Python 3.12 + CUDA 11.8 + PyTorch 2.6.0
- vLLM 0.8.5 或 Transformers 推理
- Flash Attention 2.7.3

## 对银月钱庄的价值
- 替代 llava 做图片文字识别（llava 4.7GB，OCR 能力一般）
- 精准提取发票、合同、产品说明书中的文字/表格/公式
- 配合银月的"看图"能力，处理 Telegram 收到的图片

## 部署条件
- GPU 至少 8GB 显存（当前 RTX 2050 4GB 不够）
- 需要 Conda 环境隔离
- 需要适配 OpenClaw 的 Node.js → Python 调用桥接

## 后续行动
- [ ] 等显卡升级后重新评估
- [ ] 研究能否通过云端 API 方式调用
