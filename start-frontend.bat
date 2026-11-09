
@echo off
title MySQL Admin Console - Frontend Server
cd /d "%~dp0"

echo ===================================================
echo   MySQL Admin Console - Frontend Launcher
echo ===================================================
echo.

:: Check Node.js
where node >nul 2>nul

if errorlevel 1 (
    if exist "%~dp0.tools\node\node.exe" (
        echo [INFO] Using portable Node.js
        set "PATH=%~dp0.tools\node;%PATH%"
    ) else (
        echo [ERROR] Node.js is not installed.
        echo Download Node.js version 18 or newer from:
        echo https://nodejs.org
        pause
        exit /b 1
    )
)

echo [OK] Node.js version:
node -v

:: Install dependencies if needed
if not exist "%~dp0frontend\node_modules" (
    echo Installing frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

cd /d "%~dp0frontend"

echo.
echo ===================================================
echo   React Frontend Starting
echo ===================================================
echo   Local: http://localhost:5173
echo   Network: Open this laptop's IP address on port 5173
echo ===================================================
echo.

call npm run dev -- --host 0.0.0.0 --port 5173

pause
