@echo off
setlocal
cd /d "%~dp0\.."
if not exist "node_modules\" (
  echo 首次运行请先执行: npm install
  npm install
)
npm run start:api
pause
