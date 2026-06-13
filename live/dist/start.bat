@echo off
set "ROOT=%~dp0"
start "Live API" cmd /k call "%ROOT%start-api.bat"
timeout /t 2 /nobreak >nul
start "Live Web" cmd /k call "%ROOT%start-web.bat"
