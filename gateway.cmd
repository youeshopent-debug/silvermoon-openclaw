@echo off
setlocal

if /I "%OPENCLAW_PROFILE%"=="dev" set OPENCLAW_PROFILE=

set ROOT=%USERPROFILE%\.openclaw
cd /d "%ROOT%"

if exist "%ROOT%\run-zero-token-hidden.vbs" (
  wscript //nologo "%ROOT%\run-zero-token-hidden.vbs"
  exit /b 0
)

if exist "%ROOT%\start-zero-token-hidden.ps1" (
  powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\start-zero-token-hidden.ps1"
  exit /b 0
)

exit /b 0
