# 下载 live-stream-forwarder 最新 Windows 二进制（MIT 开源）
# https://github.com/nv4d1k/live-stream-forwarder

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Version = "v0.4.1"
$ZipName = "lsf_${Version}_windows_amd64.zip"
$Url = "https://github.com/nv4d1k/live-stream-forwarder/releases/download/$Version/$ZipName"
$ZipPath = Join-Path $Root $ZipName
$ExePath = Join-Path $Root "lsf.exe"

if (Test-Path $ExePath) {
    Write-Host "lsf.exe already exists, skip download."
    & $ExePath --version 2>$null
    if ($LASTEXITCODE -ne 0) { & $ExePath -h 2>$null }
    exit 0
}

Write-Host "Downloading $Url"
Invoke-WebRequest -Uri $Url -OutFile $ZipPath -UseBasicParsing

$TempDir = Join-Path $Root "_lsf_unpack"
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }
Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force

$Found = Get-ChildItem -Path $TempDir -Recurse -Filter "lsf.exe" | Select-Object -First 1
if (-not $Found) {
    throw "lsf.exe not found in archive"
}

Copy-Item $Found.FullName $ExePath -Force
Remove-Item $ZipPath -Force
Remove-Item $TempDir -Recurse -Force

Write-Host "Installed: $ExePath"
try { & $ExePath --version } catch { Write-Host "Run: lsf.exe -h" }
