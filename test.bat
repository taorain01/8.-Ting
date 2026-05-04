@echo off
setlocal
cd /d "%~dp0"
title Ting! - Test Mode
set "ELECTRON_RUN_AS_NODE="

if not exist "%~dp0node_modules\electron\dist\electron.exe" if not exist "%~dp0node_modules\.bin\electron.cmd" (
  echo Khong tim thay Electron.
  echo Hay chay npm install truoc, roi chay lai test.bat.
  pause
  exit /b 1
)

echo Dang mo Ting! o che do TEST...
echo File nay chi dung de test, khong dong goi installer.
if exist "%~dp0ting-test.log" del "%~dp0ting-test.log"
echo [%date% %time%] test.bat start>"%~dp0ting-test.log"
call node "%~dp0scripts\run-electron-test.cjs"
set "TING_EXIT=%ERRORLEVEL%"

echo.
echo Ting! test da ket thuc voi ma loi: %TING_EXIT%
echo Log: "%~dp0ting-test.log"
echo.

if exist "%~dp0ting-test.log" (
  echo ===== ting-test.log =====
  type "%~dp0ting-test.log"
  echo ===== het log =====
)

echo.
pause
exit /b %TING_EXIT%
