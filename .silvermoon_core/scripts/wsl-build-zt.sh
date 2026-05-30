#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd ~/openclaw-zero-token
pnpm install 2>&1
echo "---INSTALL_DONE---"
pnpm build 2>&1
echo "---BUILD_DONE---"
pnpm ui:build 2>&1
echo "---UI_BUILD_DONE---"
