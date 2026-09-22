@echo off
cd /d "%~dp0"
echo ============================================
echo   elephant-dashboard: deploy Firestore security rules
echo ============================================
call npx firebase deploy --only firestore:rules
if errorlevel 1 goto deployfail
echo.
echo [DONE] Firestore rules deployed!
pause
exit /b 0

:deployfail
echo.
echo [FAILED] firebase deploy --only firestore:rules failed.
pause
exit /b 1
