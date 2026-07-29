@echo off
title WISE Backend Server
echo ========================================
echo   WISE SYSTEM - Backend Server Launcher
echo ========================================
echo.
echo [1/3] Checking port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process PID: %%a
    taskkill /F /PID %%a >/dev/null 2>&1
)
timeout /t 1 /nobreak >/dev/null
echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat
echo [3/3] Starting server on http://127.0.0.1:8000
echo.
echo Press Ctrl+C to stop the server
echo.
uvicorn apps.main:app --host 127.0.0.1 --port 8000 --reload
pause
