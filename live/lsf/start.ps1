# Start lsf proxy + player page (run install.ps1 first)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Exe = Join-Path $Root "lsf.exe"
$LsfPort = if ($env:LSF_PORT) { $env:LSF_PORT } else { 8770 }
$WebPort = if ($env:LSF_WEB_PORT) { $env:LSF_WEB_PORT } else { 8771 }

if (-not (Test-Path $Exe)) {
    Write-Host "lsf.exe missing. Run: .\install.ps1"
    exit 1
}

$lsfProc = Get-Process -Name "lsf" -ErrorAction SilentlyContinue
if ($lsfProc) {
    Write-Host "Reusing lsf process PID $($lsfProc.Id)"
} else {
    Write-Host "Starting lsf on 127.0.0.1:$LsfPort"
    Start-Process -FilePath $Exe -ArgumentList @("-l", "127.0.0.1", "-p", "$LsfPort") -WorkingDirectory $Root -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

$py = Join-Path (Split-Path $Root -Parent) "player\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    $py = "python"
}

Write-Host "Player: http://127.0.0.1:$WebPort/"
Write-Host "Stream: http://127.0.0.1:$LsfPort/douyu/9999?format=flv"
& $py (Join-Path $Root "serve.py") --port $WebPort --lsf-port $LsfPort
