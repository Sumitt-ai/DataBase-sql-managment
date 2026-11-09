@echo off
title MySQL Admin Console - Setup
cd /d "%~dp0"

echo ========================================================
echo   MySQL Admin Console - Full Project Setup & Install
echo ========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js detected:
    node -v
) else (
    if exist "%~dp0.tools\node\node.exe" (
        echo [INFO] Using bundled portable Node.js...
        set "PATH=%~dp0.tools\node;%PATH%"
    ) else (
        echo [WARNING] Node.js is not found in PATH.
        echo Please install Node.js from https://nodejs.org if npm fails.
    )
)

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Python detected:
    python --version
) else (
    echo [WARNING] Python is not found in PATH.
    echo Please install Python 3.10+ from https://python.org
)

echo.
echo [1/2] Installing Frontend Dependencies (npm install)...
cd "%~dp0frontend"
call npm install
cd "%~dp0"

echo.
echo [2/2] Installing Backend Python Requirements (pip install)...
where pip >nul 2>nul
if %ERRORLEVEL% equ 0 (
    pip install -r "%~dp0requirements.txt"
) else (
    python -m pip install -r "%~dp0requirements.txt" 2>nul
)

echo.
echo ========================================================
echo   Setup Complete!
echo   To start the frontend on any laptop, run:
echo     start-frontend.bat
echo ========================================================
echo.
pause

