import React, { useState, useEffect } from 'react';

let idCounter = 0;

export function useReactions() {
  const [floaters, setFloaters] = useState([]);

  const addReaction = (emoji, name) => {
    const id = ++idCounter;
    const x = 20 + Math.random() * 60; // % from left
    setFloaters(f => [...f, { id, emoji, name, x }]);
    setTimeout(() => {
      setFloaters(f => f.filter(r => r.id !== id));
    }, 2200);
  };

  return { floaters, addReaction };
}

export default function ReactionsOverlay({ floaters }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      {floaters.map(r => (
        <div key={r.id} style={{
          position: 'absolute',
          bottom: '80px',
          left: `${r.x}%`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          animation: 'floatUp 2.2s ease forwards',
        }}>
          <span style={{ fontSize: '2.5rem' }}>{r.emoji}</span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{r.name}</span>
        </div>
      ))}
    </div>
  );
}
