@echo off
setlocal
cd /d "%~dp0web"

set PORT=8080
set LIVE_BASE=
echo 启动前端 http://127.0.0.1:%PORT%/
node.exe server.mjs %PORT%
pause
