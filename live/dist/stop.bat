@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "API_PORT=8765"
set "WEB_PORT=8080"

if exist "%ROOT%server\config.json" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content '%ROOT%server\config.json' -Raw | ConvertFrom-Json).port"') do set "API_PORT=%%i"
)

echo 停止 Live 服务（端口 %API_PORT%、%WEB_PORT%）...
call :killport %API_PORT%
call :killport %WEB_PORT%
echo.
echo 已停止。
exit /b 0

:killport
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%1.*LISTENING"') do (
  set "FOUND=1"
  echo   结束端口 %1 PID %%a
  taskkill /PID %%a /F >nul 2>&1
)
if "%FOUND%"=="0" echo   端口 %1 无监听进程
exit /b 0
