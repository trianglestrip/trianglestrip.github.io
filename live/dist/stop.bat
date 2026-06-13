@echo off
set "ROOT=%~dp0"
call "%ROOT%_lib.bat" killport 8765
call "%ROOT%_lib.bat" killport 8080
echo 已停止
