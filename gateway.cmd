@echo off
rem OpenClaw Gateway (v2026.5.12)
set "OPENCLAW_SERVICE_MANAGED_ENV_KEYS=DEEPSEEK_API_KEY,GROQ_API_KEY,LEMON_SQUEEZY_API_KEY,OPENAI_API_KEY,OPENROUTER_API_KEY,TAVILY_API_KEY"
set "TMPDIR=C:\Users\User\AppData\Local\Temp"
set "OPENCLAW_GATEWAY_PORT=18791"
set "OPENCLAW_SYSTEMD_UNIT=openclaw-gateway.service"
set "OPENCLAW_WINDOWS_TASK_NAME=OpenClaw Gateway"
set "OPENCLAW_SERVICE_MARKER=openclaw"
set "OPENCLAW_SERVICE_KIND=gateway"
set "OPENCLAW_SERVICE_VERSION=2026.5.12"
C:\nvm4w\nodejs\node.exe C:\Users\User\AppData\Roaming\npm\node_modules\openclaw\dist\index.js gateway --port 18791
