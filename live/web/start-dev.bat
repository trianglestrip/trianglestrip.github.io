@echo off
cd /d "%~dp0"
call "%~dp0..\dist\_lib.bat" killport 8080
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
echo.
echo 前端源码 Vite http://127.0.0.1:8080/
echo API 请另开终端运行: live\node-server\start-dev.bat  (源码) 或 start.bat (dist 编译包)
echo.
call npm run dev
