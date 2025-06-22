import React, { useState } from 'react';

interface WaitingRoomProps {
  roomId: string;
  onStartGame: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomId, onStartGame }) => {
  const [copied, setCopied] = useState(false);

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="waiting-room">
      <h2>Waiting for Players...</h2>
      
      <div className="room-share">
        <p>Share this room:</p>
        <div className="room-code-display">
          <code>{roomId}</code>
          <button onClick={copyRoomCode} className="copy-button">
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>
        
        <p>Or share this link:</p>
        <div className="room-link-display">
          <code>{window.location.origin}?room={roomId}</code>
          <button onClick={copyRoomLink} className="copy-button">
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      <button onClick={onStartGame} className="start-button">
        Start Game (2-4 players)
      </button>
    </div>
  );
};