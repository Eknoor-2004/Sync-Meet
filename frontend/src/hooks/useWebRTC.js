import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC({ roomId, myName, onChat, onReaction, onRaiseHand }) {
  const [peers, setPeers] = useState({}); // peer_id → { name, stream, audio, video, screen, handRaised }
  const [myPeerId, setMyPeerId] = useState(null);
  const [wsState, setWsState] = useState('connecting'); // connecting | open | closed

  const wsRef = useRef(null);
  const pcsRef = useRef({}); // peer_id → RTCPeerConnection
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef({}); // peer_id → [candidates before remote desc]

  // ── helpers ─────────────────────────────────────────────────────────────

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const updatePeer = useCallback((peerId, patch) => {
    setPeers(prev => ({
      ...prev,
      [peerId]: { ...prev[peerId], ...patch },
    }));
  }, []);

  const removePeer = useCallback((peerId) => {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    setPeers(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  // ── create peer connection ───────────────────────────────────────────────

  const createPC = useCallback((peerId, polite) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[peerId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    // Remote stream
    const remoteStream = new MediaStream();
    pc.ontrack = e => {
      e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
      updatePeer(peerId, { stream: remoteStream });
    };

    // ICE
    pc.onicecandidate = e => {
      if (e.candidate) {
        send({ type: 'ice-candidate', target: peerId, candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') removePeer(peerId);
    };

    // Drain pending candidates
    pc.onsignalingstatechange = async () => {
      if (pc.signalingState === 'stable' && pendingCandidates.current[peerId]) {
        for (const c of pendingCandidates.current[peerId]) {
          try { await pc.addIceCandidate(c); } catch {}
        }
        delete pendingCandidates.current[peerId];
      }
    };

    // Negotiate (for polite peer)
    if (polite) {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: 'offer', target: peerId, sdp: pc.localDescription });
      };
    }

    return pc;
  }, [send, updatePeer, removePeer]);

  // ── signaling message handler ────────────────────────────────────────────

  const handleMessage = useCallback(async (msg) => {
    switch (msg.type) {

      case 'joined': {
        setMyPeerId(msg.peer_id);
        // Initiate connections to all existing members
        for (const member of msg.members) {
          updatePeer(member.peer_id, { name: member.name, stream: null });
          const pc = createPC(member.peer_id, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send({ type: 'offer', target: member.peer_id, sdp: pc.localDescription });
        }
        break;
      }

      case 'peer_joined': {
        updatePeer(msg.peer_id, { name: msg.name, stream: null });
        createPC(msg.peer_id, false);
        break;
      }

      case 'peer_left': {
        removePeer(msg.peer_id);
        break;
      }

      case 'offer': {
        const pc = createPC(msg.from, false);
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'answer', target: msg.from, sdp: pc.localDescription });
        break;
      }

      case 'answer': {
        const pc = pcsRef.current[msg.from];
        if (pc) await pc.setRemoteDescription(msg.sdp);
        break;
      }

      case 'ice-candidate': {
        const pc = pcsRef.current[msg.from];
        if (!pc) return;
        if (pc.remoteDescription) {
          try { await pc.addIceCandidate(msg.candidate); } catch {}
        } else {
          if (!pendingCandidates.current[msg.from]) pendingCandidates.current[msg.from] = [];
          pendingCandidates.current[msg.from].push(msg.candidate);
        }
        break;
      }

      case 'chat': onChat?.(msg); break;
      case 'reaction': onReaction?.(msg); break;
      case 'raise-hand': onRaiseHand?.(msg); break;

      case 'media-state': {
        updatePeer(msg.from, {
          audio: msg.audio,
          video: msg.video,
          screen: msg.screen,
        });
        break;
      }

      default: break;
    }
  }, [createPC, send, updatePeer, removePeer, onChat, onReaction, onRaiseHand]);

  // ── connect WebSocket ────────────────────────────────────────────────────

  // Keep handleMessage in a ref so `connect` never needs to be recreated
  // when callbacks like onChat/onReaction change. Without this, connect gets
  // a new identity every render → Room's useEffect([connect]) fires again →
  // a new WebSocket + join message is sent each time (the 20-40 connections
  // seen in the server logs).
  const handleMessageRef = useRef(handleMessage);
  useEffect(() => { handleMessageRef.current = handleMessage; }, [handleMessage]);

  const connect = useCallback((stream) => {
    // Prevent double-connecting (React StrictMode mounts twice in dev)
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) return;

    localStreamRef.current = stream;
    const WS_URL = process.env.REACT_APP_WS_URL || `ws://${window.location.hostname}:8765`;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsState('open');
      ws.send(JSON.stringify({ type: 'join', room_id: roomId, name: myName }));
    };

    ws.onmessage = e => {
      try { handleMessageRef.current(JSON.parse(e.data)); } catch {}
    };

    ws.onclose = () => setWsState('closed');
    ws.onerror = () => setWsState('closed');
  // Intentionally omit handleMessage — we use the ref above so this callback
  // is stable for the lifetime of the component.
  }, [roomId, myName]); // eslint-disable-line

  // ── media controls ───────────────────────────────────────────────────────

  const setAudio = useCallback((enabled) => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = enabled; });
    send({ type: 'media-state', audio: enabled });
  }, [send]);

  const setVideo = useCallback((enabled) => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = enabled; });
    send({ type: 'media-state', video: enabled });
  }, [send]);

  const startScreenShare = useCallback(async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const screenTrack = screen.getVideoTracks()[0];

      // Replace video track in all peer connections
      Object.values(pcsRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Also update local stream reference
      screenTrack.onended = () => stopScreenShare();
      send({ type: 'media-state', screen: true });
      return screenTrack;
    } catch (err) {
      console.error('Screen share error:', err);
      return null;
    }
  }, [send]);

  const stopScreenShare = useCallback(async () => {
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!camTrack) return;
    Object.values(pcsRef.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(camTrack);
    });
    send({ type: 'media-state', screen: false });
  }, [send]);

  const sendChat = useCallback((message) => {
    send({ type: 'chat', message });
  }, [send]);

  const sendReaction = useCallback((emoji) => {
    send({ type: 'reaction', emoji });
  }, [send]);

  const sendRaiseHand = useCallback((raised) => {
    send({ type: 'raise-hand', raised });
  }, [send]);

  // ── cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      Object.values(pcsRef.current).forEach(pc => pc.close());
    };
  }, []);

  return {
    peers,
    myPeerId,
    wsState,
    localStreamRef,
    connect,
    setAudio,
    setVideo,
    startScreenShare,
    stopScreenShare,
    sendChat,
    sendReaction,
    sendRaiseHand,
  };
}
