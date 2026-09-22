@echo off
chcp 65001 > nul
title 코끼리물류 대시보드 시스템
echo ==========================================
echo       코끼리물류 대시보드 시스템
echo ==========================================
echo.
echo 서버를 시작하는 중입니다... 잠시만 기다려주세요.
echo (브라우저가 자동으로 열립니다.)
echo.
echo ※ 주의: 이 검은 창을 닫으면 대시보드 접속이 끊어집니다.
echo          사용 중에는 창을 최소화해 두세요.
echo.
cd /d "c:\Users\s0102\.gemini\antigravity\scratch\elephant-dashboard"
call npm run dev -- --open
