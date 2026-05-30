#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

cd ~/openclaw-zero-token

# 检查 Windows Chrome debug 端口是否可达
echo "Checking Windows Chrome debug port (9222)..."
if curl -s http://host.docker.internal:9222/json/version > /dev/null 2>&1; then
    echo "Connected via host.docker.internal:9222"
    export CDP_URL="http://host.docker.internal:9222"
elif curl -s http://172.17.0.1:9222/json/version > /dev/null 2>&1; then
    echo "Connected via 172.17.0.1:9222"
    export CDP_URL="http://172.17.0.1:9222"
elif curl -s http://192.168.0.1:9222/json/version > /dev/null 2>&1; then
    echo "Connected via 192.168.0.1:9222"
    export CDP_URL="http://192.168.0.1:9222"
else
    echo "WARNING: Cannot reach Windows Chrome debug port 9222"
    echo "Make sure Chrome is running with --remote-debugging-port=9222 on Windows"
    echo "Trying localhost..."
    export CDP_URL="http://127.0.0.1:9222"
fi

echo "CDP_URL: $CDP_URL"

# 直接运行 onboard.sh webauth
echo ""
echo "Running onboard.sh webauth..."
echo "NOTE: When prompted, select 'deepseek-web' and follow the login steps."
echo ""

bash onboard.sh webauth
