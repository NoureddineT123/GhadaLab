@echo off
color 0a
echo ========================================================
echo        STARTING MUSIC ACTIVITIES V2 (LAN MODE)
echo ========================================================
echo.
echo Launching the server on your local network...
echo Look for the "Network: http://your-ip:5173/" line below!
echo Give that IP address to your students so they can join.
echo.
npm run dev -- --host
pause
