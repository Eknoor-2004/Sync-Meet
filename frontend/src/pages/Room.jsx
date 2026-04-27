import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import Controls from '../components/Controls';
import ChatPanel from '../components/ChatPanel';
import ReactionsOverlay, { useReactions } from '../components/ReactionsOverlay';
import styles from './Room.module.css';

export default function Room() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const myName = sessionStorage.getItem('nexmeet_name') || 'Guest';

  // UI state
  const [chatOpen, setChatOpen] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [messages, setMessages] = useState([]);
  const [toast, setToast] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [peersState, setPeersState] = useState({}); // hand raised per peer
  const screenTrackRef = useRef(null);
  const { floaters, addReaction } = useReactions();

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const onChat = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const onReaction = useCallback((msg) => {
    addReaction(msg.emoji, msg.name);
  }, [addReaction]);

  const onRaiseHand = useCallback((msg) => {
    showToast(`${msg.name} ${msg.raised ? 'raised their hand ✋' : 'lowered their hand'}`);
    setPeersState(prev => ({ ...prev, [msg.from]: { ...prev[msg.from], handRaised: msg.raised } }));
  }, [showToast]);

  const {
    peers, myPeerId, wsState,
    localStreamRef, connect,
    setAudio, setVideo,
    startScreenShare, stopScreenShare,
    sendChat, sendReaction, sendRaiseHand,
  } = useWebRTC({ roomId, myName, onChat, onReaction, onRaiseHand });

  // Start camera then connect
  useEffect(() => {
  let mounted = true;
  let currentStream;

  const startMedia = async () => {
    try {
      // 🔴 Stop old stream if exists
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // 🟢 Start fresh stream
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (!mounted) {
        currentStream.getTracks().forEach(t => t.stop());
        return;
      }

      setLocalStream(currentStream);
      connect(currentStream);

    } catch (err) {
      console.warn('Media error, joining audio-only:', err);

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!mounted) return;

        setLocalStream(currentStream);
        connect(currentStream);

      } catch {
        connect(null);
      }
    }
  };

  startMedia();

  // 🧹 CLEANUP (VERY IMPORTANT)
  return () => {
    mounted = false;
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
  };

}, [connect]);

  // New peer toast
  useEffect(() => {
    const names = Object.values(peers).map(p => p.name);
    if (names.length > 0) {
      // only show for latest join (peers object grows)
    }
  }, [peers]);

  // ── handlers ─────────────────────────────────────────────────────────────

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    setAudio(next);
  };

  const toggleVideo = () => {
    const next = !videoOn;
    setVideoOn(next);
    setVideo(next);
  };

  const toggleScreen = async () => {
    if (screenSharing) {
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      await stopScreenShare();
      setScreenSharing(false);
    } else {
      const track = await startScreenShare();
      if (track) {
        screenTrackRef.current = track;
        setScreenSharing(true);
        track.onended = () => { setScreenSharing(false); screenTrackRef.current = null; };
      }
    }
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    sendRaiseHand(next);
  };

  const handleReaction = (emoji) => {
    addReaction(emoji, 'You');
    sendReaction(emoji);
  };

  const leave = () => {
    localStream?.getTracks().forEach(t => t.stop());
    nav('/');
  };

  // ── layout math ──────────────────────────────────────────────────────────

  const peerList = Object.entries(peers);
  const totalVideos = 1 + peerList.length; // me + others
  const gridCols = totalVideos === 1 ? 1 : totalVideos <= 4 ? 2 : totalVideos <= 9 ? 3 : 4;

  return (
    <div className={styles.layout}>
      {/* Main area */}
      <div className={styles.main}>
        {/* Header */}
        <div className={styles.topBar}>
          <div className={styles.logo}>⬡ NexMeet</div>
          <div className={styles.roomInfo}>
            <span className={`${styles.dot} ${wsState === 'open' ? styles.dotGreen : styles.dotAmber}`} />
            <span className={styles.roomCode}>{roomId}</span>
          </div>
          <div className={styles.peerCount}>
            {1 + peerList.length} participant{peerList.length !== 0 ? 's' : ''}
          </div>
        </div>

        {/* Video grid */}
        <div className={styles.videoArea} style={{ position: 'relative' }}>
          <div
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
          >
            {/* Local */}
            <VideoTile
              stream={localStream}
              name={myName}
              muted
              audioOn={audioOn}
              videoOn={videoOn}
              isLocal
              handRaised={handRaised}
            />
            {/* Remote peers */}
            {peerList.map(([pid, peer]) => (
              <VideoTile
                key={pid}
                stream={peer.stream}
                name={peer.name}
                audioOn={peer.audio !== false}
                videoOn={peer.video !== false}
                handRaised={peersState[pid]?.handRaised}
              />
            ))}
          </div>

          {/* Floating reactions */}
          <ReactionsOverlay floaters={floaters} />

          {/* Waiting message */}
          {peerList.length === 0 && (
            <div className={styles.waiting}>
              <div className={styles.waitingCard}>
                <div className={styles.waitingSpinner} />
                <p>Waiting for others to join...</p>
                <button className={styles.copyInline} onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  showToast('Link copied! Share it to invite people.');
                }}>
                  📋 Copy invite link
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <Controls
          audioOn={audioOn}
          videoOn={videoOn}
          screenSharing={screenSharing}
          handRaised={handRaised}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onToggleScreen={toggleScreen}
          onToggleHand={toggleHand}
          onReaction={handleReaction}
          onLeave={leave}
          onToggleChat={() => setChatOpen(v => !v)}
          chatOpen={chatOpen}
          roomId={roomId}
        />
      </div>

      {/* Chat sidebar */}
      {chatOpen && (
        <div className={styles.sidebar}>
          <ChatPanel
            messages={messages}
            onSend={sendChat}
            myPeerId={myPeerId}
          />
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}
    </div>
  );
}
