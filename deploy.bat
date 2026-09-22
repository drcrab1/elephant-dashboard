@echo off
cd /d "%~dp0"
echo ============================================
echo   elephant-dashboard: build + deploy
echo ============================================
call npm run build
if errorlevel 1 goto buildfail
call npx firebase deploy --only hosting
if errorlevel 1 goto deployfail
echo.
echo [DONE] Deploy complete! https://elephant-logistics.web.app
pause
exit /b 0

:buildfail
echo.
echo [FAILED] npm run build failed. Deploy aborted.
pause
exit /b 1

:deployfail
echo.
echo [FAILED] firebase deploy failed.
pause
exit /b 1
