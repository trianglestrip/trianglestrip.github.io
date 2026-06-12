@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"

if not exist "%ROOT%server\live-api.exe" (
  echo 缺少 server\live-api.exe，请先运行 ..\build-dist.bat
  exit /b 1
)
if not exist "%ROOT%web\node.exe" (
  echo 缺少 web\node.exe，请先运行 ..\build-dist.bat
  exit /b 1
)

echo 清理端口 8765、8080...
call :killport 8765
call :killport 8080
timeout /t 1 /nobreak >nul

start "Live API" cmd /k "%ROOT%server\start.bat"
timeout /t 2 /nobreak >nul
start "Live Web" cmd /k "%ROOT%start-web.bat"
echo.
echo 已启动：
echo   API:  http://127.0.0.1:8765
echo   Web:  http://127.0.0.1:8080/
exit /b 0

:killport
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%1.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
exit /b 0
