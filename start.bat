@echo off
echo Starting Meetily Web Service...
echo.

echo 1. Starting Backend (FastAPI)...
cd /d "%~dp0backend"
start "Meetily Backend" cmd /c "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo 2. Starting Frontend (Next.js)...
cd /d "%~dp0frontend"
start "Meetily Frontend" cmd /c "npx next dev -p 3000"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to stop all servers...
pause
taskkill /f /fi "WINDOWTITLE eq Meetily Backend"
taskkill /f /fi "WINDOWTITLE eq Meetily Frontend"
