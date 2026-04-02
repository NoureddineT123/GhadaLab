@echo off
title EduPlayHQ Server
echo =======================================================
echo          Starting EduPlayHQ Test Environment
echo =======================================================
echo.
echo [1/2] Verifying and installing missing dependencies...
echo (This may take a moment if the network is slow)

call npm install firebase react-router-dom @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react clsx tailwind-merge zustand --fetch-retries=5

echo.
echo [2/2] Starting development server...
echo.

:: Open the browser asynchronously
start "" http://localhost:5173

:: Start the Vite server
npm run dev

pause
