@echo off
title MySQL Admin Console - Full Stack Launcher
cd /d "%~dp0"

echo ========================================================
echo   MySQL Admin Console - Full Stack Launcher
echo ========================================================
echo.
echo Starting FastAPI Backend (Port 8000)...
start "MySQL Admin Backend" cmd /k "%~dp0start-backend.bat"

echo.
echo Starting React Frontend (Port 5173)...
start "MySQL Admin Frontend" cmd /k "%~dp0start-frontend.bat"

echo.
echo ========================================================
echo   Both Servers Started!
echo.
echo   Open in Browser:
echo     Local:    http://localhost:5173
echo     LAN:      Use this laptop's IP address on port 5173
echo ========================================================
echo.
timeout /t 5

