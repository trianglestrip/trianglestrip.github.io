@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set PORT=8765
if exist "config.json" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content 'config.json' -Raw | ConvertFrom-Json).port"') do set PORT=%%i
)

echo 清理端口 %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo 启动 API http://127.0.0.1:%PORT%/
live-api.exe
pause
