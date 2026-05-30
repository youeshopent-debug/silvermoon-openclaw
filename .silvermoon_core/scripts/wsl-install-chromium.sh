#!/bin/bash
# 在 WSL2 Ubuntu 中安装 Chromium
# 使用 sudo -S 通过管道传密码（交互式）

echo "Installing Chromium in WSL2..."
echo "You may be prompted for sudo password."

sudo apt-get update -qq
sudo apt-get install -y -qq chromium-browser

echo ""
echo "Verifying..."
which chromium-browser && echo "---CHROME_OK---" || echo "---CHROME_FAIL---"
