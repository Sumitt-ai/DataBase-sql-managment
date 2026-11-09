# MySQL Admin Console - Frontend PowerShell Launcher
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  MySQL Admin Console - Frontend Launcher" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check if node is available
$nodeExists = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $nodeExists) {
    if (Test-Path "$scriptDir\.tools\node\node.exe") {
        Write-Host "[INFO] Using portable Node.js from .tools\node" -ForegroundColor Yellow
        $env:PATH = "$scriptDir\.tools\node;" + $env:PATH
    } else {
        Write-Host "[ERROR] Node.js is not found. Please install Node.js from https://nodejs.org" -ForegroundColor Red
        exit 1
    }
}

# 2. Check if node_modules exists
if (-not (Test-Path "$scriptDir\frontend\node_modules")) {
    Write-Host "[INFO] Installing npm dependencies for frontend..." -ForegroundColor Yellow
    Set-Location "$scriptDir\frontend"
    npm.cmd install
    Set-Location $scriptDir
}

Write-Host ""
Write-Host "  Local URL:   " -NoNewline
Write-Host "http://localhost:5173" -ForegroundColor Green
Write-Host "  Network:     " -NoNewline
Write-Host "Accessible on LAN using this laptop's IP:5173" -ForegroundColor Green
Write-Host ""
Write-Host "  Admin sign-in uses the configured MySQL administrator account." -ForegroundColor Yellow
Write-Host "  Client accounts are created by an administrator in Client Management." -ForegroundColor Yellow
Write-Host ""

Set-Location "$scriptDir\frontend"
npm.cmd run dev -- --host 0.0.0.0 --port 5173
