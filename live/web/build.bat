@echo off
cd /d "%~dp0"

if not exist node_modules (
  echo npm install
  call npm install
  if errorlevel 1 exit /b 1
)

echo build frontend -^> ..\dist\web
call npm run build
if errorlevel 1 exit /b 1

echo.
echo Done: ..\dist\web
exit /b 0
