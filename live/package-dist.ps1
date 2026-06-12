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

Write-Host "==> 构建前端"
Push-Location $WebSrc
npm run build
Pop-Location

Write-Host "==> 清理 dist/server、dist/web（保留启动脚本）"
foreach ($dir in @($DistServer, $DistWeb)) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null; continue }
  Get-ChildItem $dir -Exclude "start.bat", "serve_spa.py" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> 后端最小包 -> dist/server"
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
  cors = @{ enabled = $true; allowOrigin = "*" }
  static = @{ enabled = $false; distPath = "" }
} | ConvertTo-Json -Depth 4
Write-Utf8NoBom (Join-Path $DistServer "config.json") $serverConfig

Write-Host "==> 前端构建产物 -> dist/web"
Copy-Item (Join-Path $WebSrc "dist\*") $DistWeb -Recurse -Force

$webConfig = @{
  appTitle = "Lemon live"
  api = @{
    baseUrl = "http://127.0.0.1:8765"
    devBaseUrl = ""
  }
} | ConvertTo-Json -Depth 4
Write-Utf8NoBom (Join-Path $DistWeb "config.json") $webConfig

Write-Host ""
Write-Host "Done:"
Write-Host "  dist\server\start.bat  -> :8765"
Write-Host "  dist\web\start.bat     -> :8080"
Write-Host "  dist\start-all.bat"
