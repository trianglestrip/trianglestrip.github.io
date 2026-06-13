$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeStart = Join-Path (Split-Path -Parent $Root) "node-server\start.ps1"

Write-Host "提示: API 已切换到 Node，正在转发到 live\node-server\start.ps1"
Write-Host "      （Python serve.py 已弃用，见 live\server\README.md）"
& $NodeStart
