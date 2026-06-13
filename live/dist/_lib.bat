@echo off
if /i not "%~1"=="killport" exit /b 1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%~2.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
exit /b 0
