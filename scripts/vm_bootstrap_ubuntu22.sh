#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update >/dev/null
sudo apt-get install -y ca-certificates curl gnupg git ufw >/dev/null

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update >/dev/null
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
sudo usermod -aG docker "$USER" || true

curl -fsSL https://tailscale.com/install.sh | sh >/dev/null

sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https >/dev/null
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt-get update >/dev/null
sudo apt-get install -y caddy >/dev/null

sudo snap install google-cloud-cli --classic >/dev/null 2>&1 || true

sudo ufw allow 80/tcp >/dev/null
sudo ufw allow 443/tcp >/dev/null
sudo ufw --force enable >/dev/null

sudo mkdir -p /opt/silvermoon
sudo chown -R "$USER":"$USER" /opt/silvermoon

echo "完成"
echo "下一步：sudo tailscale up --ssh --hostname=silvermoon-control"
