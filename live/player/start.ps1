$ErrorActionPreference = "Stop"
$Port = 8765
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

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
Write-Host "启动 serve.py ..."
& "$Root\.venv\Scripts\python.exe" "$Root\serve.py" --port $Port
