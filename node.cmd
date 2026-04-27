@echo off
setlocal

if /I "%OPENCLAW_PROFILE%"=="dev" set OPENCLAW_PROFILE=

set ROOT=%USERPROFILE%\.openclaw
cd /d "%ROOT%"

if exist "%ROOT%\start-hidden.ps1" (
  powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\start-hidden.ps1"
)

endlocal
