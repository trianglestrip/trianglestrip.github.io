$ErrorActionPreference = "Stop"
$LiveRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistRoot = Join-Path $LiveRoot "dist"
$StartAll = Join-Path $DistRoot "start-all.bat"

if (-not (Test-Path (Join-Path $DistRoot "server\live-api.exe"))) {
  throw "缺少 dist\server\live-api.exe，请先运行 .\build-dist.ps1"
}
if (-not (Test-Path (Join-Path $DistRoot "web\node.exe"))) {
  throw "缺少 dist\web\node.exe，请先运行 .\build-dist.ps1"
}

foreach ($port in @(8765, 8080)) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 1

& $StartAll

Write-Host ""
Write-Host "已启动（请用带 /live/ 的地址打开前端）："
Write-Host "  API:  http://127.0.0.1:8765"
Write-Host "  Web:  http://127.0.0.1:8080/live/"
