@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "DIST=%ROOT%dist\"

if not exist "%DIST%server\live-api.exe" (
  echo 缺少 dist\server\live-api.exe，请先运行 build-dist.bat
  exit /b 1
)
if not exist "%DIST%web\node.exe" (
  echo 缺少 dist\web\node.exe，请先运行 build-dist.bat
  exit /b 1
)

echo 清理端口 8765、8080...
call :killport 8765
call :killport 8080
timeout /t 1 /nobreak >nul

start "Live API" cmd /k "%DIST%server\start.bat"
timeout /t 2 /nobreak >nul
start "Live Web" cmd /k "%DIST%web\start.bat"
echo.
echo 已启动（请用带 /live/ 的地址打开前端）：
echo   API:  http://127.0.0.1:8765
echo   Web:  http://127.0.0.1:8080/live/
exit /b 0

:killport
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%1.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
exit /b 0
