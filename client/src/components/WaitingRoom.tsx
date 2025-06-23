import React, { useState } from 'react';
import { BotControls } from './BotControls';
import { Copy, Link, Users } from 'lucide-react';

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
    <div className="flex flex-col gap-4 h-full">
      <div className="card bg-base-200 flex-1">
        <div className="card-body">
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Waiting for Players</h2>
            <div className="flex items-center justify-center gap-1 text-base-content/70">
              <Users size={16} />
              <span className="text-sm">Room needs 2-4 players</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 max-w-lg mx-auto w-full">
            {/* Room Code Section */}
            <div className="bg-base-300 rounded-lg p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="text-base-content/70">Room Code</span>
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={roomId} 
                  readOnly 
                  className="input input-bordered flex-1 font-mono text-lg text-center"
                />
                <button 
                  onClick={copyRoomCode} 
                  className={`btn ${copiedCode ? 'btn-success' : 'btn-ghost'}`}
                  title="Copy room code"
                >
                  {copiedCode ? (
                    <>✓<span className="hidden sm:inline ml-1">Copied!</span></>
                  ) : (
                    <><Copy size={16} /><span className="hidden sm:inline ml-1">Copy</span></>
                  )}
                </button>
              </div>
            </div>
            
            {/* Direct Link Section */}
            <div className="bg-base-300 rounded-lg p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="text-base-content/70">Direct Link</span>
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={`${window.location.origin}?room=${roomId}`} 
                  readOnly 
                  className="input input-bordered flex-1 text-xs md:text-sm"
                />
                <button 
                  onClick={copyRoomLink} 
                  className={`btn ${copiedLink ? 'btn-success' : 'btn-ghost'}`}
                  title="Copy direct link"
                >
                  {copiedLink ? (
                    <>✓<span className="hidden sm:inline ml-1">Copied!</span></>
                  ) : (
                    <><Link size={16} /><span className="hidden sm:inline ml-1">Copy</span></>
                  )}
                </button>
              </div>
            </div>

            {/* Start Game Button */}
            <div className="text-center mt-4">
              <button 
                onClick={onStartGame} 
                className="btn btn-primary btn-wide"
              >
                <Users className="mr-2" size={20} />
                Start Game
              </button>
              <p className="text-xs text-base-content/50 mt-2">
                Game starts automatically when room is full
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <BotControls roomId={roomId} isWaitingRoom={true} />
    </div>
  );
};