@echo off
setlocal

if /I "%OPENCLAW_PROFILE%"=="dev" set OPENCLAW_PROFILE=

set ROOT=%USERPROFILE%\.openclaw
cd /d "%ROOT%"

echo [银月钱庄] 启动防崩溃守护 + 网关...
echo [银月钱庄] 端口: 18791

:: 启动 keeper-launcher（防崩溃守护 + 网关）
start /b "" node "%ROOT%\keeper-launcher.js"

echo [银月钱庄] 守护已启动，网关将在几秒内上线。
echo [银月钱庄] 使用 Ctrl+C 停止，或运行 stop.cmd

exit /b 0
