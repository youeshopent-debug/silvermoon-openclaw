#!/bin/bash
# 银月钱庄 · CLI-Anything 安装脚本
# 为 OpenClaw 和 Trae 配置 CLI-Anything 技能

set -e

echo "=== 银月钱庄 · CLI-Anything 安装 ==="

# 1. 克隆 CLI-Anything
if [ ! -d "$HOME/CLI-Anything" ]; then
    echo "克隆 CLI-Anything..."
    git clone https://github.com/HKUDS/CLI-Anything.git "$HOME/CLI-Anything"
else
    echo "CLI-Anything 已存在，更新..."
    cd "$HOME/CLI-Anything" && git pull
fi

# 2. 安装 OpenClaw SKILL
echo "安装 OpenClaw SKILL..."
mkdir -p "$HOME/.openclaw/skills/cli-anything"
cp "$HOME/CLI-Anything/openclaw-skill/SKILL.md" "$HOME/.openclaw/skills/cli-anything/SKILL.md"
echo "✅ OpenClaw SKILL 已安装"

# 3. 安装 CLI-Hub 元技能（让银月能自主发现和安装 CLI）
echo "安装 CLI-Hub 元技能..."
mkdir -p "$HOME/.openclaw/skills/cli-hub"
cp "$HOME/CLI-Anything/skills/cli-hub-meta-skill/SKILL.md" "$HOME/.openclaw/skills/cli-hub/SKILL.md"
echo "✅ CLI-Hub 元技能已安装"

# 4. 安装常用 CLI 工具
echo "安装常用 CLI 工具..."
pip install cli-anything-hub 2>/dev/null || echo "⚠️ cli-anything-hub 安装跳过（需要 Python）"

echo ""
echo "=== 安装完成 ==="
echo "银月现在可以使用以下技能："
echo "  @cli-anything build a CLI for <software>"
echo "  @cli-hub find appropriate CLI software"
echo ""
echo "支持的软件：Blender, GIMP, LibreOffice, OBS Studio, Shotcut, Kdenlive, Inkscape, Audacity, Ollama, ComfyUI, Draw.io, Zoom, Godot, Zotero, n8n 等 30+"
