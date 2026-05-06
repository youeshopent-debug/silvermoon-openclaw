#!/bin/bash
# 银月钱庄 · Zero Token Chrome 调试启动脚本
# 使用 Windows 本机 Chrome，通过 WSL2 /mnt/c/ 路径访问

CHROME_PATH="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
USER_DATA_DIR="/home/alan/openclaw-zero-token/.chrome-data"
DEBUG_PORT=9222

mkdir -p "$USER_DATA_DIR"

echo "=== 银月钱庄 · Zero Token Chrome 调试模式 ==="
echo "启动 Chrome (端口 $DEBUG_PORT)..."
echo "请在打开的浏览器中登录以下网站："
echo "  - https://chat.deepseek.com"
echo "  - https://chat.qwen.ai"
echo "  - https://kimi.moonshot.cn"
echo "  - https://claude.ai"
echo "  - https://chatgpt.com"
echo "  - https://gemini.google.com"
echo ""

"$CHROME_PATH" \
  --remote-debugging-port=$DEBUG_PORT \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-sync \
  --disable-extensions \
  --disable-background-networking \
  --disable-default-apps \
  --window-size=1280,800

echo "Chrome 已关闭"
