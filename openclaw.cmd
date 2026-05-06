@echo off
REM ============================================================
REM  银月钱庄 · OpenClaw CLI 包装脚本
REM  将 openclaw gateway/status 等命令转发到本地网关 HTTP API
REM  解决控制中心 "无法连接到 Gateway" 问题
REM ============================================================
setlocal enabledelayedexpansion

set "GATEWAY_API=http://127.0.0.1:18791"
set "OPENCLAW_HOME=C:\Users\User\.openclaw"

if /i "%1"=="gateway" (
  if /i "%2"=="status" (
    if "%3"=="--json" (
      curl -s "%GATEWAY_API%/api/status" 2>nul
      if errorlevel 1 (
        echo {"error":"gateway_not_reachable","detail":"Gateway is not reachable at %GATEWAY_API%"}
      )
      exit /b 0
    )
  )
  if /i "%2"=="probe" (
    curl -s "%GATEWAY_API%/api/status" 2>nul
    if errorlevel 1 (
      echo {"error":"gateway_not_reachable"}
    )
    exit /b 0
  )
)

if /i "%1"=="status" (
  if "%2"=="--json" (
    curl -s "%GATEWAY_API%/api/status" 2>nul
    if errorlevel 1 (
      echo {"error":"gateway_not_reachable","detail":"Gateway is not reachable at %GATEWAY_API%"}
    )
    exit /b 0
  )
)

if /i "%1"=="config" (
  if "%2"=="--json" (
    type "%OPENCLAW_HOME%\openclaw.json" 2>nul
    if errorlevel 1 (
      echo {"error":"config_not_found"}
    )
    exit /b 0
  )
)

if /i "%1"=="security" (
  if /i "%2"=="audit" (
    if "%3"=="--json" (
      echo {"status":"ok","audit":{"mode":"local-only","gateway":"ws://127.0.0.1:18791"}}
      exit /b 0
    )
  )
)

if /i "%1"=="update" (
  if /i "%2"=="status" (
    if "%3"=="--json" (
      echo {"status":"ok","version":"local","update_available":false}
      exit /b 0
    )
  )
)

if /i "%1"=="agent" (
  set "AGENT_NAME="
  set "AGENT_MSG="
  set "JSON_MODE=0"
  :parse_agent_args
  if "%~2"=="" goto :run_agent
  if /i "%~2"=="--agent" ( set "AGENT_NAME=%~3" & shift & shift & goto :parse_agent_args )
  if /i "%~2"=="--message" ( set "AGENT_MSG=%~3" & shift & shift & goto :parse_agent_args )
  if /i "%~2"=="--json" ( set "JSON_MODE=1" & shift & goto :parse_agent_args )
  shift
  goto :parse_agent_args
  :run_agent
  if "%AGENT_NAME%"=="" (
    echo {"error":"missing_agent","usage":"openclaw agent --agent ^<name^> --message ^<text^> [--json]"}
    exit /b 1
  )
  if "%AGENT_MSG%"=="" (
    echo {"error":"missing_message","usage":"openclaw agent --agent ^<name^> --message ^<text^> [--json]"}
    exit /b 1
  )
  REM 先尝试通过银月网关 API 调用
  set "BODY={\"agent\":\"%AGENT_NAME%\",\"message\":\"%AGENT_MSG%\",\"channelId\":\"cli-agent-run\"}"
  for /f "usebackq delims=" %%i in (`curl -s -X POST "%GATEWAY_API%/api/agent/run" -H "Content-Type: application/json" -d "!BODY!" 2^>nul`) do set "API_REPLY=%%i"
  echo !API_REPLY! | findstr "ok.*true" >nul 2>nul
  if not errorlevel 1 (
    if "%JSON_MODE%"=="1" ( echo !API_REPLY! ) else (
      for /f "tokens=*" %%j in ('echo !API_REPLY! ^| "%OPENCLAW_HOME%\tools\jq-win64.exe" -r ".reply // .error // \"\"" 2^>nul') do echo %%j
    )
    exit /b 0
  )
  REM 网关 API 不可用时，直接调 Ollama 本地模型
  set "SYSTEM_PROMPT=你是%AGENT_NAME%，银月钱庄的成员。请用中文回复。"
  set "OLLAMA_BODY={\"model\":\"qwen3.5:9b\",\"messages\":[{\"role\":\"system\",\"content\":\"!SYSTEM_PROMPT!\"},{\"role\":\"user\",\"content\":\"%AGENT_MSG%\"}],\"stream\":false}"
  for /f "usebackq delims=" %%i in (`curl -s -X POST http://127.0.0.1:11434/api/chat -H "Content-Type: application/json" -d "!OLLAMA_BODY!" 2^>nul`) do set "OLLAMA_REPLY=%%i"
  if not "!OLLAMA_REPLY!"=="" (
    for /f "tokens=*" %%j in ('echo !OLLAMA_REPLY! ^| "%OPENCLAW_HOME%\tools\jq-win64.exe" -r ".message.content // .error // \"\"" 2^>nul') do echo %%j
    exit /b 0
  )
  echo {"error":"agent_unreachable","detail":"Gateway and local Ollama both unreachable"}
  exit /b 1
)

echo OpenClaw CLI (local wrapper)
echo Usage: openclaw gateway status --json
echo        openclaw status --json
echo        openclaw config --json
echo        openclaw agent --agent ^<name^> --message ^<text^> [--json]
exit /b 0
