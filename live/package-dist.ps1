$ErrorActionPreference = "Stop"
$LiveRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerSrc = Join-Path $LiveRoot "server"
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

Write-Host "==> 构建前端 (GitHub Pages /live/)"
Push-Location $WebSrc
npm run build:pages
Pop-Location

Write-Host "==> 清理 dist/server、dist/web"
foreach ($pair in @(
    @{ Dir = $DistServer; Keep = @("start.bat", "config.json") },
    @{ Dir = $DistWeb; Keep = @("start.bat", "server.mjs", "config.json") }
  )) {
  $dir = $pair.Dir
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null; continue }
  Get-ChildItem $dir | Where-Object { $pair.Keep -notcontains $_.Name } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> PyInstaller 打包 API -> dist/server/live-api.exe"
$py = Join-Path $ServerSrc ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "缺少 $py，请先在 live/server 创建 venv 并 pip install -r requirements.txt" }
& $py -m pip install pyinstaller -q
Push-Location $ServerSrc
& $py -m PyInstaller live-api.spec --distpath $DistServer --workpath (Join-Path $BuildRoot "pyinstaller") --noconfirm --clean
Pop-Location
if (-not (Test-Path (Join-Path $DistServer "live-api.exe"))) {
  throw "live-api.exe 构建失败"
}

Write-Host "==> 复制 server/config.json -> dist/server"
Copy-Item (Join-Path $ServerSrc "config.json") (Join-Path $DistServer "config.json") -Force

Write-Host "==> 前端构建产物 -> dist/web"
$assetsDir = Join-Path $DistWeb "assets"
if (Test-Path $assetsDir) { Remove-Item $assetsDir -Recurse -Force }
Copy-Item (Join-Path $WebSrc "dist\*") $DistWeb -Recurse -Force

$webConfig = @{
  appTitle = "Lemon live"
  api = @{
    baseUrl = "http://127.0.0.1:8765"
    devBaseUrl = ""
  }
} | ConvertTo-Json -Depth 4
Write-Utf8NoBom (Join-Path $DistWeb "config.json") $webConfig

Write-Host "==> 下载 node.exe -> dist/web"
Ensure-NodeExe $DistWeb

Write-Host ""
Write-Host "Done:"
Write-Host "  dist\server\live-api.exe + config.json"
Write-Host "  dist\web\  (vite build + node.exe + server.mjs)"
