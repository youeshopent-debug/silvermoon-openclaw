@echo off
echo 银月钱庄 · 启动 Chrome 调试模式（端口 9222）
echo.
echo 启动新 Chrome 实例（调试模式，不影响现有 Chrome）...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\ChromeDev" --no-first-run
echo.
echo Chrome 调试模式已启动，端口 9222
echo 你现在可以登录 Shopify 了。
pause
