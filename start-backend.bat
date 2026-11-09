@echo off
title MySQL Admin Console - FastAPI Backend
cd /d "%~dp0"

echo ========================================================
echo   MySQL Admin Console - Starting FastAPI Backend Server
echo ========================================================
echo.

:: Detect Python environment
if exist "%~dp0backend_env\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0backend_env\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

echo Python Interpreter: %PYTHON_EXE%
echo API Docs URL:      http://localhost:8000/docs
echo API Endpoint:      http://localhost:8000/api
echo.

"%PYTHON_EXE%" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
pause

