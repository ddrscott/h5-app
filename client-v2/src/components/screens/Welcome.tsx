import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Banner } from '../ui/Banner';
import { Tutor } from './Tutor';

interface WelcomeProps {
  onJoinGame: (playerName: string, roomId?: string) => void;
  getAvailableRooms?: () => Promise<any[]>;
  onViewCards?: () => void;
}

export const Welcome: React.FC<WelcomeProps> = ({ onJoinGame, onViewCards }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showTutor, setShowTutor] = useState(false);

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
          <div className="flex items-center gap-4 portrait:flex-col max-w-7xl mx-auto w-full">
          {/* Left side - Title and Cards */}
          <Banner className="flex-1" />

          {/* Right side - Form */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-2xl">
              {/* Name input */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium mb-2">Your Name</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={handleNameChange}
                  placeholder="Enter your name"
                  className="w-full px-3 sm:px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold text-sm sm:text-base"
                  maxLength={20}
                />
              </div>

              {/* Action buttons - keep vertical */}
              <div className="flex flex-col space-y-2">
                  <button
                      onClick={handleCreateRoom}
                      disabled={!playerName.trim()}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                      Create New Room
                  </button>
                  
                  <button
                      onClick={handleJoinRandomRoom}
                      disabled={!playerName.trim()}
                      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
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
                  
                  <div className="flex gap-2">
                      <input
                          type="text"
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value)}
                          placeholder="Enter room code"
                          className="flex-1 min-w-0 px-2 sm:px-3 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold text-center text-sm sm:text-base"
                          maxLength={10}
                      />
                      <button
                          onClick={handleJoinSpecificRoom}
                          disabled={!playerName.trim() || !roomCode.trim()}
                          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-3 sm:px-4 text-sm sm:text-base flex-shrink-0"
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

            {/* How to Play and View Cards buttons */}
            <div className="mt-4 text-center space-x-4">
              <button
                onClick={() => setShowTutor(true)}
                className="text-sm text-gray-400 hover:text-gold underline transition-colors"
              >
                How to Play
              </button>
              <Link
                to="/cards"
                className="text-sm text-gray-400 hover:text-gold underline transition-colors"
              >
                View Cards
              </Link>
              <Link
                to="/"
                className="text-sm text-gray-400 hover:text-gold underline transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>

      {/* Tutor Modal */}
      {showTutor && <Tutor onClose={() => setShowTutor(false)} />}
    </div>
  );
};
