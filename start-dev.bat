@echo off
REM Starts Ripple on your computer at https://localhost:3000
REM (https, because Threads and Meta only accept https login addresses)
REM Double-click this file, or run "start-dev.bat" in a terminal. Press Ctrl+C to stop.

title Ripple dev server
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

REM The Inngest Dev Server runs scheduled posts on this computer.
REM It opens in its own window; its dashboard is at http://localhost:8288
start "Ripple scheduler (Inngest)" cmd /k "npx --yes inngest-cli@latest dev -u https://localhost:3000/api/inngest --no-discovery"

echo.
echo Starting Ripple... the browser will open at https://localhost:3000
echo The first page load can take a minute while it compiles.
echo Scheduled posts run in the second window ("Ripple scheduler").
echo Press Ctrl+C to stop the server, and close both windows when you're done.
echo.

REM Open the browser after a short delay, in the background
start "" /b cmd /c "ping -n 9 127.0.0.1 >nul & start https://localhost:3000"

REM Uses the mkcert certificate in certificates\ when it's there (no browser warning);
REM otherwise Next.js makes its own.
if exist "certificates\localhost.pem" (
  call npm run dev:https
) else (
  call npx next dev --experimental-https
)
pause
