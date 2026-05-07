@echo off
REM Launches Coding Drives. Prefers the built native .exe; falls back to dev mode.
cd /d "%~dp0"

if exist "dist\win-unpacked\Coding Drives.exe" (
  start "" "dist\win-unpacked\Coding Drives.exe"
  exit /b
)

if not exist node_modules (
  echo [coding-drives] installing dependencies...
  call npm install
)

echo [coding-drives] no build found; running dev mode...
call npm run dev
