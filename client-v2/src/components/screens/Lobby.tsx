import React from 'react';
import type { Player } from '../../types/game';
import { Card } from '../ui/Card';
import { User } from 'lucide-react';

interface LobbyProps {
  roomId: string;
  players: Player[];
  isHost: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  roomId,
  players,
  isHost,
  onStartGame,
  onLeaveRoom,
}) => {
  const canStart = players.length >= 2 && players.length <= 6;
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="min-h-screen felt-texture p-4 landscape:p-2 flex flex-col relative">
      {/* Copy Success Toast */}
      {copiedText && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl">
            <p className="text-sm text-green-400">✓ {copiedText} copied!</p>
          </div>
        </div>
      )}
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 landscape:mb-2">
          <h1 className="text-2xl landscape:text-xl font-bold text-gold">Game Lobby</h1>
          <button onClick={onLeaveRoom} className="btn-secondary text-sm landscape:text-xs py-1 px-3">
            Leave Room
          </button>
        </div>

        {/* Table Preview - Full screen */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative felt-texture rounded-lg">
              {/* Center content - Start Game and Room Code */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                {/* Room Code with Copy */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Room Code</p>
                  <div className="bg-gray-900/80 rounded-lg px-4 py-2 flex items-center gap-2">
                    <p className="text-3xl font-mono font-bold text-gold">{roomId}</p>
                    <button
                      onClick={() => copyToClipboard(roomId, "Room code")}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                      title="Copy room code"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Share Link */}
                  <div className="mt-2 text-xs">
                    <button
                      onClick={() => {
                        const webUrl = import.meta.env.VITE_WEB_URL || window.location.origin;
                        const shareUrl = `${webUrl}/?room=${roomId}`;
                        copyToClipboard(shareUrl, "Share link");
                      }}
                      className="text-gray-400 hover:text-gray-300 underline"
                    >
                      Copy share link
                    </button>
                  </div>
                </div>
                
                {/* Game Controls */}
                {isHost ? (
                  <button
                    onClick={onStartGame}
                    disabled={!canStart}
                    className={`${
                      canStart ? 'btn-primary' : 'bg-gray-600 text-gray-400 py-2 px-6 rounded-lg cursor-not-allowed'
                    }`}
                  >
                    {!canStart
                      ? `Need ${2 - players.length} more`
                      : 'Start Game'}
                  </button>
                ) : (
                  <p className="text-gray-300 text-sm bg-gray-900/80 rounded px-3 py-2">
                    Waiting for host...
                  </p>
                )}
              </div>

              {/* Player positions and placeholders */}
              {Array.from({ length: 6 }).map((_, index) => {
                const player = players[index];
                // Position first spot at bottom, others distributed around
                const angle = index === 0 ? 90 : ((index - 1) * 360) / 5 - 90;
                const radius = 140;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;

                return (
                  <div
                    key={index}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `calc(50% + ${x}px)`,
                      top: `calc(50% + ${y}px)`,
                    }}
                  >
                    {player ? (
                      <div className="bg-gray-800/90 rounded-lg px-3 py-2 shadow-lg">
                        <div className="flex items-center space-x-1">
                          <User size={14} className="text-gray-300" />
                          <span className="text-sm font-medium">{player.name}</span>
                        </div>
                        {index === 0 && (
                          <span className="text-xs text-gold">HOST</span>
                        )}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-600 rounded-lg px-3 py-2">
                        <div className="flex items-center space-x-1">
                          <User size={14} className="text-gray-500" />
                          <span className="text-sm text-gray-500">Empty</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          
          <p className="text-xs text-gray-400 text-center py-2">
            {players.length}/6 Players • {players.length === 6 ? 'Room is full!' : `${6 - players.length} spots available`}
          </p>
        </div>
      </div>
    </div>
  );
};