@echo off
title EduPlayHQ Server
echo =======================================================
echo          Starting EduPlayHQ Test Environment (FAST)
echo =======================================================
echo.
echo [1/1] Starting development server...
echo (Skipping dependency installation for faster boot)
echo.

:: Open the browser asynchronously
start "" http://localhost:5173

:: Start the Vite server
npm run dev

pause
