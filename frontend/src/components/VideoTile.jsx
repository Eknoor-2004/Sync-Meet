import React, { useEffect, useRef } from 'react';
import styles from './VideoTile.module.css';

export default function VideoTile({ stream, name, muted = false, audioOn = true, videoOn = true, isLocal = false, handRaised = false, small = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`${styles.tile} ${small ? styles.small : ''}`}>
      {stream && videoOn ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} />
      ) : (
        <div className={styles.avatar}>
          <span className={styles.initials}>{initials}</span>
        </div>
      )}

      <div className={styles.overlay}>
        <div className={styles.name}>
          {!audioOn && <span className={styles.mutedIcon}>🔇</span>}
          {handRaised && <span className={styles.handIcon}>✋</span>}
          <span>{name}{isLocal ? ' (you)' : ''}</span>
        </div>
      </div>

      {!audioOn && <div className={styles.mutedBadge} />}
    </div>
  );
}
