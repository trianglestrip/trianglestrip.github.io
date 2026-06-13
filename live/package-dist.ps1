$ErrorActionPreference = "Stop"
$LiveRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeServer = Join-Path $LiveRoot "node-server"
$WebSrc = Join-Path $LiveRoot "web"
$DistRoot = Join-Path $LiveRoot "dist"
$DistServer = Join-Path $DistRoot "server"
$DistWeb = Join-Path $DistRoot "web"
$BuildRoot = Join-Path $LiveRoot "build"
$NodeVer = "20.18.1"

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Ensure-NodeExe {
  param([string]$DestDir)
  $dest = Join-Path $DestDir "node.exe"
  if (Test-Path $dest) { return }

  $cacheDir = Join-Path $BuildRoot "node-cache"
  $zipName = "node-v$NodeVer-win-x64.zip"
  $zipPath = Join-Path $cacheDir $zipName
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

  if (-not (Test-Path $zipPath)) {
    $zipUrl = "https://nodejs.org/dist/v$NodeVer/$zipName"
    Write-Host "==> 下载 Node.js $NodeVer"
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
  }

  $extractDir = Join-Path $cacheDir "extract-$NodeVer"
  if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $extractDir
  $nodeExe = Get-ChildItem -Path $extractDir -Recurse -Filter "node.exe" | Select-Object -First 1
  if (-not $nodeExe) { throw "node.exe not found in $extractDir" }
  Copy-Item $nodeExe.FullName $dest -Force
}

Write-Host "==> 构建前端 (本地根路径 /)"
Push-Location $WebSrc
npm run build
Pop-Location

Write-Host "==> 清理 dist/server、dist/web"
foreach ($pair in @(
    @{ Dir = $DistServer; Keep = @("config.json") },
    @{ Dir = $DistWeb; Keep = @("server.mjs", "config.json") }
  )) {
  $dir = $pair.Dir
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null; continue }
  Get-ChildItem $dir | Where-Object { $pair.Keep -notcontains $_.Name } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> 构建 Node API -> dist/server"
Push-Location $NodeServer
npm ci
npm run build
Pop-Location
if (-not (Test-Path (Join-Path $NodeServer "live-api.mjs"))) {
  throw "live-api.mjs 构建失败"
}

Write-Host "==> 复制 live-api.mjs、config.json -> dist/server"
Copy-Item (Join-Path $NodeServer "live-api.mjs") (Join-Path $DistServer "live-api.mjs") -Force
Copy-Item (Join-Path $NodeServer "config.json") (Join-Path $DistServer "config.json") -Force

$libBat = @'
@echo off
if /i not "%~1"=="killport" exit /b 1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%~2.*LISTENING"') do taskkill /PID %%a /F >nul 2>&1
exit /b 0
'@
Write-Utf8NoBom (Join-Path $DistRoot "_lib.bat") $libBat

$startApi = @'
@echo off
set "ROOT=%~dp0"
call "%ROOT%_lib.bat" killport 8765
cd /d "%ROOT%server"
echo 启动 API http://127.0.0.1:8765/
"%ROOT%node.exe" live-api.mjs
pause
'@
Write-Utf8NoBom (Join-Path $DistRoot "start-api.bat") $startApi

Write-Host "==> 下载 node.exe -> dist（前后端共用）"
Ensure-NodeExe $DistRoot

Write-Host "==> 复制 server.mjs -> dist/web"
Copy-Item (Join-Path $WebSrc "server.mjs") (Join-Path $DistWeb "server.mjs") -Force

$startWeb = @'
@echo off
set "ROOT=%~dp0"
call "%ROOT%_lib.bat" killport 8080
cd /d "%ROOT%web"
echo 启动前端 http://127.0.0.1:8080/
"%ROOT%node.exe" server.mjs
pause
'@
Write-Utf8NoBom (Join-Path $DistRoot "start-web.bat") $startWeb

$distStart = @'
@echo off
set "ROOT=%~dp0"
start "Live API" cmd /k call "%ROOT%start-api.bat"
timeout /t 2 /nobreak >nul
start "Live Web" cmd /k call "%ROOT%start-web.bat"
'@
Write-Utf8NoBom (Join-Path $DistRoot "start.bat") $distStart

$stopBat = @'
@echo off
set "ROOT=%~dp0"
call "%ROOT%_lib.bat" killport 8765
call "%ROOT%_lib.bat" killport 8080
echo 已停止
'@
Write-Utf8NoBom (Join-Path $DistRoot "stop.bat") $stopBat

foreach ($extra in @($DistServer, $DistWeb)) {
  $stray = Join-Path $extra "node.exe"
  if (Test-Path $stray) { Remove-Item $stray -Force }
}

Write-Host ""
Write-Host "Done:"
Write-Host "  dist\start.bat / start-api.bat / start-web.bat / stop.bat"
Write-Host "  dist\node.exe（共用）"
Write-Host "  dist\server\live-api.mjs + config.json"
Write-Host "  dist\web\  (vite build + server.mjs)"
