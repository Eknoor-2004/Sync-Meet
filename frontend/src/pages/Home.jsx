import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import styles from './Home.module.css';

export default function Home() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [tab, setTab] = useState('new'); // 'new' | 'join'

  const startNew = () => {
    const n = name.trim() || 'Guest';
    const room = uuidv4().slice(0, 8);
    sessionStorage.setItem('nexmeet_name', n);
    nav(`/room/${room}`);
  };

  const joinLink = () => {
    const n = name.trim() || 'Guest';
    let room = link.trim();
    // Accept full URL or just the code
    if (room.includes('/room/')) room = room.split('/room/')[1].split('/')[0].split('?')[0];
    if (!room) return;
    sessionStorage.setItem('nexmeet_name', n);
    nav(`/room/${room}`);
  };

  return (
    <div className={styles.page}>
      {/* Background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>⬡</span>
          <span>NexMeet</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Video calls,<br />
            <span className={styles.accent}>redefined.</span>
          </h1>
          <p className={styles.sub}>
            Crystal-clear WebRTC video calling. Share a link, jump in — no downloads, no accounts.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.nameRow}>
            <label className={styles.label}>Your display name</label>
            <input
              className={styles.input}
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'new' ? startNew() : joinLink())}
            />
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'new' ? styles.tabActive : ''}`}
              onClick={() => setTab('new')}
            >New meeting</button>
            <button
              className={`${styles.tab} ${tab === 'join' ? styles.tabActive : ''}`}
              onClick={() => setTab('join')}
            >Join with link</button>
          </div>

          {tab === 'new' ? (
            <div className={styles.section}>
              <p className={styles.hint}>A unique room link will be created for you to share.</p>
              <button className={styles.btnPrimary} onClick={startNew}>
                Start meeting
                <span className={styles.arrow}>→</span>
              </button>
            </div>
          ) : (
            <div className={styles.section}>
              <input
                className={styles.input}
                placeholder="Paste meeting link or room code"
                value={link}
                onChange={e => setLink(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinLink()}
              />
              <button className={styles.btnPrimary} onClick={joinLink}>
                Join meeting
                <span className={styles.arrow}>→</span>
              </button>
            </div>
          )}
        </div>

        <div className={styles.features}>
          {[
            ['🎥', 'HD Video', 'Up to 1080p adaptive quality'],
            ['🔒', 'Peer-to-peer', 'Direct encrypted WebRTC streams'],
            ['💬', 'Live chat', 'In-call messaging & reactions'],
            ['🖥️', 'Screen share', 'Share your screen instantly'],
          ].map(([icon, title, desc]) => (
            <div key={title} className={styles.feat}>
              <span className={styles.featIcon}>{icon}</span>
              <strong>{title}</strong>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
