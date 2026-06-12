@echo off
setlocal
set ROOT=%~dp0

echo 启动 Live 后端与前端...
start "Live API" cmd /k "%ROOT%server\start.bat"
timeout /t 2 /nobreak >nul
start "Live Web" cmd /k "%ROOT%web\start.bat"

echo.
echo API: http://127.0.0.1:8765
echo Web: http://127.0.0.1:8080
