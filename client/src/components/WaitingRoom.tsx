import React, { useState } from 'react';

interface WaitingRoomProps {
  roomId: string;
  onStartGame: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomId, onStartGame }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyRoomLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="card bg-base-200">
      <div className="card-body items-center text-center">
        <h2 className="card-title text-2xl mb-4">Waiting for Players...</h2>
        
        <div className="w-full max-w-md space-y-4">
          <div>
            <p className="text-sm opacity-70 mb-2">Share this room code:</p>
            <div className="join w-full">
              <input 
                type="text" 
                value={roomId} 
                readOnly 
                className="input input-bordered join-item flex-1 font-mono"
              />
              <button onClick={copyRoomCode} className="btn join-item">
                {copiedCode ? '✓ Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
          
          <div className="divider">OR</div>
          
          <div>
            <p className="text-sm opacity-70 mb-2">Share this link:</p>
            <div className="join w-full">
              <input 
                type="text" 
                value={`${window.location.origin}?room=${roomId}`} 
                readOnly 
                className="input input-bordered join-item flex-1 text-xs"
              />
              <button onClick={copyRoomLink} className="btn join-item">
                {copiedLink ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>

        <div className="card-actions mt-6">
          <button onClick={onStartGame} className="btn btn-primary btn-lg">
            Start Game (2-4 players)
          </button>
        </div>
      </div>
    </div>
  );
};