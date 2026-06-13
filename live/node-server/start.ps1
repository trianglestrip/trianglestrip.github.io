$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Port = 8765

$configPath = Join-Path $Root "config.json"
if (Test-Path $configPath) {
  try {
    $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
    if ($cfg.port) { $Port = [int]$cfg.port }
  } catch {
    Write-Host "警告: 无法解析 config.json，使用默认端口 $Port"
  }
}

Write-Host "清理端口 $Port 上的旧进程..."
$connections = netstat -ano | Select-String ":$Port\s+.*LISTENING"
foreach ($line in $connections) {
  $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
  $procId = $parts[-1]
  if ($procId -match '^\d+$' -and $procId -ne '0') {
    Write-Host "  结束 PID $procId"
    taskkill /PID $procId /F 2>$null | Out-Null
  }
}

Set-Location $Root
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "首次运行: npm install ..."
  npm install
}
if (-not (Test-Path (Join-Path $Root "live-api.mjs"))) {
  Write-Host "构建 live-api.mjs ..."
  npm run build
}
Write-Host "启动 Node API (port=$Port) ..."
node live-api.mjs --port $Port
