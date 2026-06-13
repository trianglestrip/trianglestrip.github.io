@echo off
set "ROOT=%~dp0"
call "%ROOT%_lib.bat" killport 8080
cd /d "%ROOT%web"
echo 启动前端 http://127.0.0.1:8080/
"%ROOT%node.exe" server.mjs
pause
