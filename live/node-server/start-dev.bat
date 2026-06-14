@echo off
cd /d "%~dp0"
call "%~dp0..\dist\_lib.bat" killport 8765
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
echo API 源码模式 http://127.0.0.1:8765/  (tsx, 改 src 后需手动重启本窗口)
call npm run dev
