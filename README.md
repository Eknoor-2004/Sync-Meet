# NexMeet — WebRTC Video Calling App

A full-stack real-time video calling app built with:
- **Frontend**: React + CSS Modules
- **Backend**: Python + WebSockets (signaling server)
- **Protocol**: WebRTC (peer-to-peer video/audio)
- **Transport**: WebSockets (signaling & chat)

---

## Features

- 🎥 HD video calls (peer-to-peer via WebRTC)
- 🔗 Share a link to invite anyone
- 💬 In-call live chat
- 🖥️ Screen sharing
- 🔇 Mic / camera toggle
- ✋ Raise hand
- 😊 Floating emoji reactions
- 👥 Multi-participant grid layout (auto-adapts)
- 🔔 Toast notifications for join/leave events

---

## Project Structure

```
webrtc-meet/
├── backend/
│   ├── server.py          # Python WebSocket signaling server
│   └── requirements.txt
└── frontend/
    ├── public/index.html
    ├── package.json
    └── src/
        ├── index.js
        ├── index.css
        ├── hooks/
        │   └── useWebRTC.js     # Core WebRTC + WS logic
        ├── components/
        │   ├── VideoTile.jsx    # Individual video tile
        │   ├── Controls.jsx     # Bottom control bar
        │   ├── ChatPanel.jsx    # Sidebar chat
        │   └── ReactionsOverlay.jsx
        └── pages/
            ├── Home.jsx         # Landing / lobby
            └── Room.jsx         # Active call room
```

---

## Quick Start

### 1. Start the signaling server (Python)

```bash
cd backend
pip install -r requirements.txt
python server.py
```

Server runs on `ws://localhost:8765`

### 2. Start the React frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`

### 3. Make a call

1. Open `http://localhost:3000`
2. Enter your name → click **Start meeting**
3. Copy the invite link from the call screen
4. Open the link in another browser tab/window or send it to someone

---

## How It Works

```
Browser A                  Python Server              Browser B
   |                            |                         |
   |── WebSocket connect ──────>|                         |
   |── { type: "join" } ───────>|                         |
   |<── { type: "joined" } ─────|                         |
   |                            |<── WebSocket connect ───|
   |                            |<── { type: "join" } ────|
   |<── { type: "peer_joined" } |── { type: "joined" } ──>|
   |                            |                         |
   |── WebRTC Offer ───────────>|── WebRTC Offer ────────>|
   |<── WebRTC Answer ──────────|<── WebRTC Answer ───────|
   |── ICE candidates ─────────>|── ICE candidates ──────>|
   |<── ICE candidates ─────────|<── ICE candidates ───────|
   |                            |                         |
   |<════════ Direct P2P Video/Audio (no server) ════════>|
```

The Python server is only a **signaling server** — it never touches your media. Once the WebRTC handshake is done, audio and video flow directly between browsers.

---

## Environment Variables

Create `frontend/.env` to override defaults:

```env
# Point to your signaling server (default: ws://localhost:8765)
REACT_APP_WS_URL=ws://your-server.com:8765
```

---

## Deploying

### Backend (signaling server)
Deploy `server.py` on any VPS (e.g. DigitalOcean, AWS EC2):
```bash
pip install websockets
python server.py
```
Use `nginx` + `certbot` to put it behind `wss://` (required for HTTPS sites).

### Frontend
```bash
cd frontend
npm run build
# Deploy the /build folder to Netlify, Vercel, or any static host
```

Set `REACT_APP_WS_URL=wss://your-server.com:8765` before building.

---

## STUN / TURN Servers

By default, STUN servers from Google are used (free, handles most NAT traversal).
For corporate networks or strict firewalls, add a TURN server in `useWebRTC.js`:

```js
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass',
    },
  ],
};
```

Free TURN: [Metered.ca](https://www.metered.ca/tools/openrelay/) or self-host with `coturn`.
