$ErrorActionPreference = "Stop"
$LiveRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerSrc = Join-Path $LiveRoot "server"
$WebSrc = Join-Path $LiveRoot "web"
$DistRoot = Join-Path $LiveRoot "dist"
$DistServer = Join-Path $DistRoot "server"
$DistWeb = Join-Path $DistRoot "web"

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

Write-Host "==> 构建前端 (npm run build)"
Push-Location $WebSrc
npm run build
Pop-Location

Write-Host "==> 清理 dist 目录"
if (Test-Path $DistServer) {
  Get-ChildItem $DistServer -Exclude "start.bat", "config.json" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path $DistWeb) {
  Get-ChildItem $DistWeb -Exclude "start.bat", "config.json" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $DistServer | Out-Null
New-Item -ItemType Directory -Force -Path $DistWeb | Out-Null

Write-Host "==> 复制后端文件 -> dist/server"
$serverFiles = @(
  "serve.py",
  "app_config.py",
  "text_sanitize.py",
  "compare_streams.py",
  "muxia_api.py",
  "resolve_cache.py",
  "resolve_douyu.py",
  "resolve_huya.py",
  "resolve_service.py",
  "resolve_timing.py",
  "room_schema.py",
  "requirements.txt"
)
foreach ($name in $serverFiles) {
  Copy-Item (Join-Path $ServerSrc $name) (Join-Path $DistServer $name) -Force
}

$serverConfig = @{
  host = "127.0.0.1"
  port = 8765
  cors = @{
    enabled = $true
    allowOrigin = "*"
  }
  static = @{
    enabled = $false
    distPath = ""
  }
} | ConvertTo-Json -Depth 4
Write-Utf8NoBom (Join-Path $DistServer "config.json") $serverConfig

Write-Host "==> 复制前端构建产物 -> dist/web"
Copy-Item (Join-Path $WebSrc "dist\*") $DistWeb -Recurse -Force

$webConfig = @{
  appTitle = "Lemon live"
  api = @{
    baseUrl = "http://127.0.0.1:8765"
    devBaseUrl = ""
  }
} | ConvertTo-Json -Depth 4
Write-Utf8NoBom (Join-Path $DistWeb "config.json") $webConfig

Write-Host "==> 安装 dist Node 依赖"
Push-Location $DistRoot
if (-not (Test-Path "package.json")) {
  Write-Host "警告: 缺少 dist/package.json"
} else {
  npm install --omit=dev
}
Pop-Location

Write-Host ""
Write-Host "打包完成:"
Write-Host "  cd dist && npm run start:api  -> http://127.0.0.1:8765"
Write-Host "  cd dist && npm run start:web  -> http://127.0.0.1:8080"
Write-Host "  dist\start-all.bat            -> 双窗口"
