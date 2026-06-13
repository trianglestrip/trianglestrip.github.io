@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "DIST_SERVER=%ROOT%..\dist\server"

set PORT=8765
if exist "%DIST_SERVER%\config.json" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content '%DIST_SERVER%\config.json' -Raw | ConvertFrom-Json).port"') do set PORT=%%i
)

echo 清理端口 %PORT%...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1

if not exist "%ROOT%node_modules" (
  echo npm install...
  call npm install
)
if not exist "%DIST_SERVER%\live-api.mjs" (
  echo npm run build...
  call npm run build
  if errorlevel 1 exit /b 1
)

cd /d "%DIST_SERVER%"
echo 启动 API http://127.0.0.1:%PORT%/
node live-api.mjs --port %PORT%
pause
