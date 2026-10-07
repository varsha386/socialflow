@echo off
REM Starts SocialFlow on your computer at http://localhost:3000
REM Double-click this file, or run "start-dev.bat" in a terminal. Press Ctrl+C to stop.

title SocialFlow dev server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install it with: winget install OpenJS.NodeJS.LTS
  echo Then close and reopen this window.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing packages for the first time. This can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check the messages above.
    pause
    exit /b 1
  )
)

echo.
echo Starting SocialFlow... the browser will open at http://localhost:3000
echo The first page load can take a minute while it compiles.
echo Press Ctrl+C to stop the server.
echo.

REM Open the browser after a short delay, in the background
start "" /b cmd /c "ping -n 9 127.0.0.1 >nul & start http://localhost:3000"

call npm run dev
pause
