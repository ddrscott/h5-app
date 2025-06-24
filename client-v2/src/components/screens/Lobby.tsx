import React from 'react';
import type { Player } from '../../types/game';
import { Card } from '../ui/Card';
import { PlayerPlaceholders } from './PlayerPlaceholders';
import { BOT_CONFIGS } from '../../bots/configs';
import BotManagerSingleton from '../../bots/BotManagerSingleton';

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
  const [selectedBot, setSelectedBot] = React.useState<string>(Object.keys(BOT_CONFIGS)[0]);
  const [isAddingBot, setIsAddingBot] = React.useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);
  
  // Get singleton instance of BotManager
  const botManager = BotManagerSingleton.getInstance();
  
  // Track previous room ID to detect actual room changes
  const previousRoomIdRef = React.useRef<string>(roomId);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleAddBot = async () => {
    setIsAddingBot(true);
    try {
      const config = BOT_CONFIGS[selectedBot as keyof typeof BOT_CONFIGS];
      await botManager.createBot(config, roomId);
    } catch (error) {
      console.error('Failed to add bot:', error);
    }
    setIsAddingBot(false);
  };

  const handleLeaveRoom = () => {
    // Clean up bots when explicitly leaving the room
    const botsInRoom = botManager.getBotsInRoom(roomId);
    if (botsInRoom.length > 0) {
      console.log(`Leaving room ${roomId}: removing ${botsInRoom.length} bots`);
      botsInRoom.forEach(bot => botManager.removeBot(bot.id));
    }
    onLeaveRoom();
  };

  // Only cleanup bots when we actually change rooms
  React.useEffect(() => {
    const previousRoomId = previousRoomIdRef.current;
    
    // If room changed, clean up bots from the previous room
    if (previousRoomId && previousRoomId !== roomId) {
      const botsInPreviousRoom = botManager.getBotsInRoom(previousRoomId);
      if (botsInPreviousRoom.length > 0) {
        console.log(`Leaving room ${previousRoomId}: removing ${botsInPreviousRoom.length} bots`);
        botsInPreviousRoom.forEach(bot => botManager.removeBot(bot.id));
      }
    }
    
    // Update ref for next render
    previousRoomIdRef.current = roomId;
    
    // Cleanup on actual unmount (when user navigates away)
    return () => {
      // This cleanup will be called by StrictMode, but we only want to clean up
      // when the component is truly unmounting (navigating away from the game)
      // The BotManagerSingleton persists across re-renders, so bots will stay connected
    };
  }, [roomId]); // Only depend on roomId

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
          <button 
            onClick={() => setShowLeaveConfirm(true)} 
            className="bg-gray-800/90 hover:bg-gray-700 rounded-full p-2 transition-colors"
            title="Leave Room"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Table Preview - Full screen */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center gap-4 portrait:flex-col">
            {/* Left side - Player placeholders */}
            <div className="flex-1 relative felt-texture rounded-lg min-h-[18.75em]">
              <PlayerPlaceholders players={players} />
              
              {/* Center content - Room Code */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="mb-3">
                  <p className="text-sm text-gray-400 mb-1">Room Code</p>
                  <div className="bg-gray-900/80 rounded-lg px-4 py-2 flex items-center gap-2">
                    <p className="text-xl font-mono font-bold text-gold">{roomId}</p>
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
              </div>
            </div>
            
            {/* Right side - Game controls and bot panel */}
            <div className="flex-1 max-w-md w-full">
              <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
                {isHost ? (
                  <>
                    {/* Bot Controls - Only for host */}
                    {players.length < 6 && (
                      <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">Need Player? Try adding a bot...</label>
                        <div className="flex gap-2">
                          <select
                            value={selectedBot}
                            onChange={(e) => setSelectedBot(e.target.value)}
                            className="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                          >
                            {Object.entries(BOT_CONFIGS).map(([key, config]) => (
                              <option key={key} value={key}>
                                {config.avatar} {config.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={handleAddBot}
                            disabled={isAddingBot || players.length >= 6}
                            className="btn-secondary py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAddingBot ? 'Adding...' : 'Add Bot'}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Start Game Button - Only for host */}
                    <div className="space-y-3">
                      <button
                        onClick={onStartGame}
                        disabled={!canStart}
                        className={`w-full ${
                          canStart ? 'btn-primary' : 'bg-gray-600 text-gray-400 py-2 px-6 rounded-lg cursor-not-allowed'
                        }`}
                      >
                        {!canStart
                          ? `Need ${2 - players.length} more Player or Bot`
                          : 'Start Game'}
                      </button>
                      {!canStart && (
                        <p className="text-xs text-gray-400 text-center">
                          Minimum 2 players required
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  /* Non-host players see this */
                  <div className="text-center">
                    <div className="text-4xl mb-4 animate-spin">⏳</div>
                    <p className="text-gray-300">Waiting for host to start game...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 text-center py-2">
            {players.length}/6 Players • {players.length === 6 ? 'Room is full!' : `${6 - players.length} spots available`}
          </p>
        </div>
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold mb-3">Leave Room?</h3>
            <p className="text-gray-300 mb-4">Are you sure you want to leave the room?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  handleLeaveRoom();
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Leave
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
