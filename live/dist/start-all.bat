@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\" (
  echo 首次运行请先执行: npm install
  npm install
)
start "Live API" cmd /k "cd /d %~dp0 && npm run start:api"
timeout /t 2 /nobreak >nul
start "Live Web" cmd /k "cd /d %~dp0 && npm run start:web"
echo.
echo API: http://127.0.0.1:8765
echo Web: http://127.0.0.1:8080
