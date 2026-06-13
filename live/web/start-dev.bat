@echo off
cd /d "%~dp0"
call "%~dp0..\dist\_lib.bat" killport 5173
if not exist node_modules (
call "%~dp0..\dist\_lib.bat" killport 8080
  call npm install
  if errorlevel 1 exit /b 1
)
echo Vite dev http://127.0.0.1:8080/  API -> 8765 (devBaseUrl 或 /api 代理)
call npm run dev
