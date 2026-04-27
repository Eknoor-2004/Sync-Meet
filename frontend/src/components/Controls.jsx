import React from 'react';
import styles from './Controls.module.css';

const REACTIONS = ['👍','❤️','😂','🎉','🙌','🔥'];

export default function Controls({
  audioOn, videoOn, screenSharing, handRaised,
  onToggleAudio, onToggleVideo, onToggleScreen, onToggleHand,
  onReaction, onLeave, onToggleChat, chatOpen,
  roomId,
}) {
  const [showReactions, setShowReactions] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.copyBtn} onClick={copyLink}>
          {copied ? '✓ Copied!' : '🔗 Copy invite link'}
        </button>
      </div>

      <div className={styles.center}>
        <CtrlBtn
          label={audioOn ? '🎙️' : '🔇'}
          active={audioOn}
          danger={!audioOn}
          title={audioOn ? 'Mute mic' : 'Unmute mic'}
          onClick={onToggleAudio}
        />
        <CtrlBtn
          label={videoOn ? '📷' : '🚫'}
          active={videoOn}
          danger={!videoOn}
          title={videoOn ? 'Stop video' : 'Start video'}
          onClick={onToggleVideo}
        />
        <CtrlBtn
          label="🖥️"
          active={screenSharing}
          title={screenSharing ? 'Stop sharing' : 'Share screen'}
          onClick={onToggleScreen}
        />
        <CtrlBtn
          label="✋"
          active={handRaised}
          title={handRaised ? 'Lower hand' : 'Raise hand'}
          onClick={onToggleHand}
        />

        <div className={styles.reactionWrap}>
          {showReactions && (
            <div className={styles.reactionPicker}>
              {REACTIONS.map(e => (
                <button key={e} className={styles.reactionBtn}
                  onClick={() => { onReaction(e); setShowReactions(false); }}>
                  {e}
                </button>
              ))}
            </div>
          )}
          <CtrlBtn
            label="😊"
            title="Send reaction"
            onClick={() => setShowReactions(v => !v)}
          />
        </div>

        <CtrlBtn
          label={chatOpen ? '✕' : '💬'}
          title={chatOpen ? 'Close chat' : 'Open chat'}
          onClick={onToggleChat}
          accent={chatOpen}
        />
      </div>

      <div className={styles.right}>
        <button className={styles.leaveBtn} onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

function CtrlBtn({ label, title, onClick, active, danger, accent }) {
  return (
    <button
      className={`${styles.ctrl} ${danger ? styles.danger : ''} ${accent ? styles.accent : ''} ${active === false ? styles.inactive : ''}`}
      title={title}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
