import React, { useState } from 'react';
import { Card } from '../ui/Card';

interface WelcomeProps {
  onJoinGame: (playerName: string, roomId?: string) => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onJoinGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      onJoinGame(playerName);
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && roomCode.trim()) {
      onJoinGame(playerName, roomCode);
    }
  };

  return (
    <div className="min-h-screen felt-texture flex items-center justify-center p-4">
        {/* Simple landscape layout - just side by side */}
          <div className="flex items-center gap-4 portrait:flex-col">
          {/* Left side - Title and Cards */}
          <div className="flex-1">
            {/* Decorative cards */}
            <div className="flex justify-center mb-4 space-x-2">
              <Card suit="H" rank={5} className="transform -rotate-12 scale-75" />
              <Card suit="H" rank={5} className="transform rotate-6 scale-75" />
              <Card suit="H" rank={5} className="transform -rotate-6 scale-75" />
              <Card suit="H" rank={5} className="transform rotate-12 scale-75" />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-center mb-2 text-gold">
              Heart of Five
            </h1>
            <p className="text-center text-gray-300 mb-6 text-2xl">
              红心五
            </p>
          </div>

          {/* Right side - Form */}
          <div className="flex-1">
            <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
              {/* Name input */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
                  maxLength={20}
                />
              </div>

              {/* Action buttons - keep vertical */}
              <div className="space-y-3">
                  <button
                      onClick={handleCreateRoom}
                      disabled={!playerName.trim()}
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                  >
                      Create New Room
                  </button>
                  <div className="flex space-x-2">
                      <input
                          type="text"
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value)}
                          placeholder="Room code"
                          className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold text-center"
                          maxLength={10}
                      />
                      <button
                          onClick={handleJoinRoom}
                          disabled={!playerName.trim() || !roomCode.trim()}
                          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-4"
                      >
                          Join
                      </button>
                  </div>
                </div>
              </div>

            {/* Game info */}
            <div className="mt-6 text-center text-gray-400 text-sm landscape:hidden">
              <p>2-6 players • Strategic card game • Win by going out first!</p>
            </div>
          </div>
        </div>
    </div>
  );
};
