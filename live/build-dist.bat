@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "NODE_SERVER=%ROOT%node-server"
set "WEB=%ROOT%web"
set "DIST=%ROOT%dist\"
set "BUILD=%ROOT%build\"
set "NODE_VER=20.18.1"

if not exist "%NODE_SERVER%\package.json" (
  echo 缺少 %NODE_SERVER%\package.json
  exit /b 1
)

echo ==^> 清理 dist/server、dist/web
call :cleanDir "%DIST%server" config.json
call :cleanDir "%DIST%web" server.mjs config.json

echo ==^> 构建前端 (本地根路径 /)
pushd "%WEB%"
call npm run build
if errorlevel 1 exit /b 1
popd

echo ==^> 构建 Node API -^> dist/server
pushd "%NODE_SERVER%"
call npm ci
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
popd
if not exist "%NODE_SERVER%\live-api.mjs" (
  echo live-api.mjs 构建失败
  exit /b 1
)

echo ==^> 复制 live-api.mjs、config.json -^> dist/server
copy /Y "%NODE_SERVER%\live-api.mjs" "%DIST%server\live-api.mjs" >nul
copy /Y "%NODE_SERVER%\config.json" "%DIST%server\config.json" >nul

echo ==^> 确保 dist/node.exe（前后端共用）
call :ensureNode "%DIST%"

echo ==^> 复制 server.mjs -^> dist/web
copy /Y "%WEB%server.mjs" "%DIST%web\server.mjs" >nul

echo ==^> 生成 dist 启动脚本
call :writeLib "%DIST%"
call :writeStartApi "%DIST%"
call :writeStartWeb "%DIST%"
call :writeStartAll "%DIST%"
call :writeStop "%DIST%"

echo ==^> 清理子目录中多余的 node.exe
if exist "%DIST%server\node.exe" del /f /q "%DIST%server\node.exe" >nul 2>&1
if exist "%DIST%web\node.exe" del /f /q "%DIST%web\node.exe" >nul 2>&1

echo.
echo Done:
echo   dist\start.bat / start-api.bat / start-web.bat / stop.bat
echo   dist\node.exe（共用）
echo   dist\server\live-api.mjs + config.json
echo   dist\web\  (vite build + server.mjs)
exit /b 0

:writeLib
> "%~1_lib.bat" (
  echo @echo off
  echo if /i not "%%~1"=="killport" exit /b 1
  echo for /f "tokens=5" %%%%a in ^('netstat -ano ^^| findstr ":%%~2.*LISTENING"'^) do taskkill /PID %%%%a /F ^>nul 2^>^&1
  echo exit /b 0
)
exit /b 0

:writeStartApi
> "%~1start-api.bat" (
  echo @echo off
  echo set "ROOT=%%~dp0"
  echo call "%%ROOT%%_lib.bat" killport 8765
  echo cd /d "%%ROOT%%server"
  echo echo 启动 API http://127.0.0.1:8765/
  echo "%%ROOT%%node.exe" live-api.mjs
  echo pause
)
exit /b 0

:writeStartWeb
> "%~1start-web.bat" (
  echo @echo off
  echo set "ROOT=%%~dp0"
  echo call "%%ROOT%%_lib.bat" killport 8080
  echo cd /d "%%ROOT%%web"
  echo echo 启动前端 http://127.0.0.1:8080/
  echo "%%ROOT%%node.exe" server.mjs
  echo pause
)
exit /b 0

:writeStartAll
> "%~1start.bat" (
  echo @echo off
  echo set "ROOT=%%~dp0"
  echo start "Live API" cmd /k call "%%ROOT%%start-api.bat"
  echo timeout /t 2 /nobreak ^>nul
  echo start "Live Web" cmd /k call "%%ROOT%%start-web.bat"
)
exit /b 0

:writeStop
> "%~1stop.bat" (
  echo @echo off
  echo set "ROOT=%%~dp0"
  echo call "%%ROOT%%_lib.bat" killport 8765
  echo call "%%ROOT%%_lib.bat" killport 8080
  echo echo 已停止
)
exit /b 0

:ensureNode
if exist "%~1\node.exe" exit /b 0
powershell -NoProfile -Command "$BuildRoot='%BUILD%'; $NodeVer='%NODE_VER%'; $DestDir='%~1'; $cacheDir=Join-Path $BuildRoot 'node-cache'; $zipName=\"node-v$NodeVer-win-x64.zip\"; $zipPath=Join-Path $cacheDir $zipName; New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null; if (-not (Test-Path $zipPath)) { Write-Host '==> 下载 Node.js' $NodeVer; Invoke-WebRequest -Uri \"https://nodejs.org/dist/v$NodeVer/$zipName\" -OutFile $zipPath }; $extractDir=Join-Path $cacheDir \"extract-$NodeVer\"; if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }; Expand-Archive -Path $zipPath -DestinationPath $extractDir; $nodeExe=Get-ChildItem -Path $extractDir -Recurse -Filter 'node.exe' | Select-Object -First 1; if (-not $nodeExe) { throw 'node.exe not found' }; Copy-Item $nodeExe.FullName (Join-Path $DestDir 'node.exe') -Force"
exit /b 0

:cleanDir
set "TARGET=%~1"
set "KEEP1=%~2"
set "KEEP2=%~3"
set "KEEP3=%~4"
set "KEEP4=%~5"
if not exist "%TARGET%" mkdir "%TARGET%" & exit /b 0
for %%F in ("%TARGET%\*") do (
  set "DEL=1"
  if /I "%%~nxF"=="%KEEP1%" set "DEL=0"
  if /I "%%~nxF"=="%KEEP2%" set "DEL=0"
  if /I "%%~nxF"=="%KEEP3%" set "DEL=0"
  if /I "%%~nxF"=="%KEEP4%" set "DEL=0"
  if "!DEL!"=="1" (
    if exist "%%F\" (rmdir /s /q "%%F") else (del /f /q "%%F")
  )
)
exit /b 0
