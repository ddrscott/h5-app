import React, { useState, useEffect } from 'react';
import { Banner } from '../ui/Banner';

interface WelcomeProps {
  onJoinGame: (playerName: string, roomId?: string) => void;
  getAvailableRooms?: () => Promise<any[]>;
}

export const Welcome: React.FC<WelcomeProps> = ({ onJoinGame }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  // Check URL for room parameter and load saved name on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomCode(roomFromUrl);
    }
    
    // Load saved name from localStorage
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  // Save name to localStorage whenever it changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setPlayerName(newName);
    if (newName.trim()) {
      localStorage.setItem('playerName', newName.trim());
    }
  };

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      onJoinGame(playerName); // Always pass only playerName, no roomCode
    }
  };

  const handleJoinSpecificRoom = () => {
    if (playerName.trim() && roomCode.trim()) {
      onJoinGame(playerName, roomCode);
    }
  };

  const handleJoinRandomRoom = () => {
    if (playerName.trim()) {
      onJoinGame(playerName, ''); // Empty roomCode will trigger joinOrCreate
    }
  };

  return (
    <div className="min-h-screen felt-texture flex items-center justify-center p-4">
        {/* Simple landscape layout - just side by side */}
          <div className="flex items-center gap-4 portrait:flex-col">
          {/* Left side - Title and Cards */}
          <Banner className="flex-1" />

          {/* Right side - Form */}
          <div className="flex-1">
            <div className="bg-gray-800 rounded-lg p-6 shadow-2xl">
              {/* Name input */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={handleNameChange}
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
                      className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Create New Room
                  </button>
                  
                  <button
                      onClick={handleJoinRandomRoom}
                      disabled={!playerName.trim()}
                      className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Join Random Room
                  </button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-800 text-gray-400">or</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                      <input
                          type="text"
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value)}
                          placeholder="Enter room code"
                          className="flex-1 px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold text-center"
                          maxLength={10}
                      />
                      <button
                          onClick={handleJoinSpecificRoom}
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
