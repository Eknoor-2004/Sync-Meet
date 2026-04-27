"""
WebRTC Signaling Server — Python + WebSockets
Handles room management, SDP offer/answer exchange,
ICE candidate relay, chat, and presence events.
"""

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

import websockets
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# rooms[room_id] = { peer_id: {"ws": ws, "name": str, "peer_id": str} }
rooms: dict[str, dict] = defaultdict(dict)


async def broadcast(room_id: str, message: dict, exclude: str = None):
    """Send a message to all peers in a room, optionally excluding one."""
    payload = json.dumps(message)
    # Snapshot items so concurrent leave/join events can't mutate the dict
    # while we await sends — which is what caused the RuntimeError.
    peers_snapshot = list(rooms[room_id].items())
    dead = []
    for pid, peer in peers_snapshot:
        if pid == exclude:
            continue
        try:
            await peer["ws"].send(payload)
        except Exception:
            dead.append(pid)
    for pid in dead:
        rooms[room_id].pop(pid, None)


async def send_to(room_id: str, peer_id: str, message: dict):
    """Send a message to a specific peer."""
    peer = rooms[room_id].get(peer_id)
    if peer:
        try:
            await peer["ws"].send(json.dumps(message))
        except Exception:
            rooms[room_id].pop(peer_id, None)


def room_members(room_id: str, exclude: str = None):
    return [
        {"peer_id": p["peer_id"], "name": p["name"]}
        for pid, p in rooms[room_id].items()
        if pid != exclude
    ]


async def handle(ws):
    peer_id = str(uuid.uuid4())[:8]
    room_id = None
    peer_name = "Anonymous"

    log.info(f"New connection: {peer_id}")

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            kind = msg.get("type")

            # ── JOIN ────────────────────────────────────────────────────────
            if kind == "join":
                room_id = msg.get("room_id", "default")
                peer_name = msg.get("name", f"User-{peer_id}")

                rooms[room_id][peer_id] = {
                    "ws": ws,
                    "peer_id": peer_id,
                    "name": peer_name,
                }

                # Tell the joiner their ID and existing members
                await ws.send(json.dumps({
                    "type": "joined",
                    "peer_id": peer_id,
                    "room_id": room_id,
                    "members": room_members(room_id, exclude=peer_id),
                }))

                # Tell everyone else a new peer arrived
                await broadcast(room_id, {
                    "type": "peer_joined",
                    "peer_id": peer_id,
                    "name": peer_name,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }, exclude=peer_id)

                log.info(f"Peer {peer_name} ({peer_id}) joined room {room_id} — {len(rooms[room_id])} total")

            # ── OFFER ───────────────────────────────────────────────────────
            elif kind == "offer":
                target = msg.get("target")
                await send_to(room_id, target, {
                    "type": "offer",
                    "sdp": msg["sdp"],
                    "from": peer_id,
                    "name": peer_name,
                })

            # ── ANSWER ──────────────────────────────────────────────────────
            elif kind == "answer":
                target = msg.get("target")
                await send_to(room_id, target, {
                    "type": "answer",
                    "sdp": msg["sdp"],
                    "from": peer_id,
                })

            # ── ICE CANDIDATE ───────────────────────────────────────────────
            elif kind == "ice-candidate":
                target = msg.get("target")
                await send_to(room_id, target, {
                    "type": "ice-candidate",
                    "candidate": msg["candidate"],
                    "from": peer_id,
                })

            # ── CHAT ────────────────────────────────────────────────────────
            elif kind == "chat":
                await broadcast(room_id, {
                    "type": "chat",
                    "from": peer_id,
                    "name": peer_name,
                    "message": msg.get("message", ""),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })

            # ── REACTION ────────────────────────────────────────────────────
            elif kind == "reaction":
                await broadcast(room_id, {
                    "type": "reaction",
                    "from": peer_id,
                    "name": peer_name,
                    "emoji": msg.get("emoji", "👍"),
                })

            # ── MEDIA STATE (mute/cam toggle) ────────────────────────────────
            elif kind == "media-state":
                await broadcast(room_id, {
                    "type": "media-state",
                    "from": peer_id,
                    "audio": msg.get("audio"),
                    "video": msg.get("video"),
                    "screen": msg.get("screen"),
                }, exclude=peer_id)

            # ── RAISE HAND ──────────────────────────────────────────────────
            elif kind == "raise-hand":
                await broadcast(room_id, {
                    "type": "raise-hand",
                    "from": peer_id,
                    "name": peer_name,
                    "raised": msg.get("raised", True),
                })

    except (ConnectionClosedOK, ConnectionClosedError):
        pass
    except Exception as e:
        log.error(f"Error for {peer_id}: {e}")
    finally:
        if room_id and peer_id in rooms.get(room_id, {}):
            rooms[room_id].pop(peer_id, None)
            await broadcast(room_id, {
                "type": "peer_left",
                "peer_id": peer_id,
                "name": peer_name,
            })
            log.info(f"Peer {peer_name} ({peer_id}) left room {room_id}")
            if not rooms[room_id]:
                del rooms[room_id]


import os

async def main():
    PORT = int(os.environ.get("PORT", 8765))
    log.info(f"🚀 Signaling server starting on port {PORT}")

    async with websockets.serve(handle, "0.0.0.0", PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
