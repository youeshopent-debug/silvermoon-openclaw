#!/bin/bash
# 修复 nvm 自动加载
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 确保 nvm 自动加载到 .bashrc
grep -q 'NVM_DIR' ~/.bashrc || {
    echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
}

# 设置默认 node 版本
nvm alias default 22
nvm use default

# 验证
echo "node: $(node --version)"
echo "npm: $(npm --version)"
echo "---NVM_FIXED---"
