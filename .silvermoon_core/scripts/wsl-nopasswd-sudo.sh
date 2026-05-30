#!/bin/bash
# 设置当前用户 sudo 免密码
echo "$USER ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/$USER
sudo chmod 440 /etc/sudoers.d/$USER
echo "---NOPASSWD_DONE---"
