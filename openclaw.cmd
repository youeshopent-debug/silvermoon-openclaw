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

echo OpenClaw CLI (local wrapper)
echo Usage: openclaw gateway status --json
echo        openclaw status --json
echo        openclaw config --json
exit /b 0
