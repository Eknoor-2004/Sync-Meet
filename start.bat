@echo off
echo.
echo   NexMeet -- WebRTC Video Calling
echo   ------------------------------------
echo.

echo [1/2] Starting Python signaling server...
cd backend
pip install -r requirements.txt
start "NexMeet Backend" python server.py
cd ..

echo [2/2] Starting React frontend...
cd frontend
call npm install
echo.
echo   Opening http://localhost:3000
echo   Close this window to stop the frontend.
echo.
npm start
