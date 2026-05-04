@echo off
setlocal
cd /d "%~dp0"
title Ting! - Web Test

echo Dang mo Ting! bang trinh duyet, khong qua Electron...
echo File nay chi dung de test web, khong dong goi installer.
echo.

call npm run web:test -- --open
set "TING_EXIT=%ERRORLEVEL%"

echo.
echo Ting! web test da ket thuc voi ma loi: %TING_EXIT%
pause
exit /b %TING_EXIT%
