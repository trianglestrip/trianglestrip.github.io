@echo off
set "ROOT=%~dp0"
call "%ROOT%_lib.bat" killport 8765
cd /d "%ROOT%server"
echo 启动 API http://127.0.0.1:8765/
"%ROOT%node.exe" live-api.mjs
pause
