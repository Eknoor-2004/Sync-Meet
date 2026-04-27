#!/usr/bin/env bash
# start.sh — launch both backend and frontend

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ⬡  NexMeet — WebRTC Video Calling"
echo "  ────────────────────────────────────"
echo ""

# Backend
echo "  [1/2] Starting Python signaling server..."
cd "$ROOT/backend"
pip install -r requirements.txt -q
python server.py &
BACKEND_PID=$!
echo "  ✓ Signaling server running (PID $BACKEND_PID) on ws://localhost:8765"

# Frontend
echo ""
echo "  [2/2] Starting React frontend..."
cd "$ROOT/frontend"
npm install --silent
echo "  ✓ Opening http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

trap "kill $BACKEND_PID 2>/dev/null; exit" INT TERM
npm start
