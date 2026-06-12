@echo off
setlocal EnableDelayedExpansion
set "ROOT=%~dp0"
set "SERVER=%ROOT%server"
set "WEB=%ROOT%web"
set "DIST=%ROOT%dist\"
set "BUILD=%ROOT%build\"
set "NODE_VER=20.18.1"

if not exist "%SERVER%\.venv\Scripts\python.exe" (
  echo 缺少 %SERVER%\.venv\Scripts\python.exe
  echo 请先在 live\server 创建 venv 并 pip install -r requirements.txt
  exit /b 1
)

echo ==^> 构建前端 (GitHub Pages /live/)
pushd "%WEB%"
call npm run build:pages
if errorlevel 1 exit /b 1
popd

echo ==^> 清理 dist/server、dist/web
call :cleanDir "%DIST%server" start.bat config.json
call :cleanDir "%DIST%web" start.bat server.mjs config.json node.exe

echo ==^> PyInstaller 打包 API -^> dist/server/live-api.exe
"%SERVER%\.venv\Scripts\python.exe" -m pip install pyinstaller -q
pushd "%SERVER%"
"%SERVER%\.venv\Scripts\python.exe" -m PyInstaller live-api.spec --distpath "%DIST%server" --workpath "%BUILD%pyinstaller" --noconfirm --clean
popd
if not exist "%DIST%server\live-api.exe" (
  echo live-api.exe 构建失败
  exit /b 1
)

echo ==^> 复制 server/config.json -^> dist/server
copy /Y "%SERVER%config.json" "%DIST%server\config.json" >nul

echo ==^> 前端构建产物 -^> dist/web
if exist "%DIST%web\assets" rmdir /s /q "%DIST%web\assets"
xcopy /E /Y /I "%WEB%dist\*" "%DIST%web\" >nul

echo ==^> 写入 dist/web/config.json
set "WEB_CFG=%DIST%web\config.json"
powershell -NoProfile -Command "$j=@{appTitle='Lemon live';api=@{baseUrl='http://127.0.0.1:8765';devBaseUrl=''}}|ConvertTo-Json -Depth 4;[IO.File]::WriteAllText('%WEB_CFG%', $j, [Text.UTF8Encoding]::new($false))"

echo ==^> 确保 dist/web/node.exe
if exist "%DIST%web\node.exe" goto node_done
powershell -NoProfile -Command "$BuildRoot='%BUILD%'; $NodeVer='%NODE_VER%'; $DestDir='%DIST%web'; $cacheDir=Join-Path $BuildRoot 'node-cache'; $zipName=\"node-v$NodeVer-win-x64.zip\"; $zipPath=Join-Path $cacheDir $zipName; New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null; if (-not (Test-Path $zipPath)) { Write-Host '==> 下载 Node.js' $NodeVer; Invoke-WebRequest -Uri \"https://nodejs.org/dist/v$NodeVer/$zipName\" -OutFile $zipPath }; $extractDir=Join-Path $cacheDir \"extract-$NodeVer\"; if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }; Expand-Archive -Path $zipPath -DestinationPath $extractDir; $nodeExe=Get-ChildItem -Path $extractDir -Recurse -Filter 'node.exe' | Select-Object -First 1; if (-not $nodeExe) { throw 'node.exe not found' }; Copy-Item $nodeExe.FullName (Join-Path $DestDir 'node.exe') -Force"
:node_done

echo.
echo Done:
echo   dist\server\live-api.exe + config.json
echo   dist\web\  (vite build + node.exe + server.mjs)
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
