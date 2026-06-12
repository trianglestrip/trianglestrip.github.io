@echo off
setlocal
cd /d "%~dp0"

set PORT=8080
set PY=
if exist "..\..\server\.venv\Scripts\python.exe" set PY=..\..\server\.venv\Scripts\python.exe
if not defined PY set PY=python

echo 启动前端静态服务 http://127.0.0.1:%PORT%/
"%PY%" serve_spa.py %PORT%
pause
