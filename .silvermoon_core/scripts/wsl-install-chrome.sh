#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装 Chromium
echo "Installing Chromium..."
sudo apt-get update -qq
sudo apt-get install -y -qq chromium-browser 2>&1 | tail -5

# 验证
which chromium-browser && echo "---CHROME_OK---" || echo "---CHROME_FAIL---"
