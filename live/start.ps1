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

& $StartAll
