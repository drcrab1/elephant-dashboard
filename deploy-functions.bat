@echo off
cd /d "%~dp0"
echo ============================================
echo   elephant-dashboard: deploy notification functions
echo ============================================
call npx firebase deploy --only functions
if errorlevel 1 goto deployfail
echo.
echo [DONE] Functions deployed!
pause
exit /b 0

:deployfail
echo.
echo [FAILED] firebase deploy --only functions failed.
echo (Blaze 요금제로 전환되어 있는지 확인해주세요: https://console.firebase.google.com/project/elephant-logistics/usage/details)
pause
exit /b 1
