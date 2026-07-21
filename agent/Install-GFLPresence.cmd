@echo off
setlocal EnableExtensions
title GFL Presence Agent Installer

:: Elevate to Administrator if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting Administrator privileges...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath '%~f0' -Verb RunAs -WorkingDirectory '%~dp0'"
  exit /b
)

cd /d "%~dp0"

echo.
echo ========================================
echo   GFL Presence Agent Installer v1.1.0
echo ========================================
echo.

if not exist "%~dp0setup.ps1" (
  echo ERROR: setup.ps1 not found next to this installer.
  echo Make sure Install-GFLPresence.cmd and setup.ps1 are in the same folder.
  pause
  exit /b 1
)

if not exist "%~dp0GFLPresence.exe" (
  echo ERROR: GFLPresence.exe not found next to this installer.
  echo Build it with: npm run agent:build
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
set EXITCODE=%ERRORLEVEL%

echo.
if %EXITCODE% neq 0 (
  echo Installer finished with errors. Exit code: %EXITCODE%
) else (
  echo Installer finished successfully.
)
pause
exit /b %EXITCODE%
