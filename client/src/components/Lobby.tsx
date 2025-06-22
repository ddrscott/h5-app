import React, { useState, useEffect } from 'react';
import { useColyseus } from '../contexts/ColyseusContext';
import { getRandomName } from '../types/game';

export const Lobby: React.FC = () => {
  const { createRoom, joinRoom, error } = useColyseus();
  const [playerName, setPlayerName] = useState(getRandomName());
  const [roomCode, setRoomCode] = useState('');
  const [showRoomCode, setShowRoomCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check URL parameters for room code
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
      setRoomCode(roomId);
      setShowRoomCode(true);
    }
  }, []);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    setIsLoading(true);
    await createRoom(playerName.trim());
    setIsLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    setIsLoading(true);
    await joinRoom(playerName.trim());
    setIsLoading(false);
  };

  const handleJoinSpecificRoom = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      alert('Please enter a room code');
      return;
    }
    setIsLoading(true);
    await joinRoom(playerName.trim(), roomCode.trim());
    setIsLoading(false);
  };

  return (
    <div className="lobby">
      <h1>❤️ Heart of Five (红心五) 🃏</h1>
      <div className="lobby-content">
        <h2>Heart of Five - Multiplayer Card Game</h2>
        
        <div className="form-group">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="player-name-input"
            disabled={isLoading}
          />
        </div>

        <div className="button-group">
          <button 
            onClick={handleCreateRoom} 
            disabled={isLoading}
            className="primary-button"
          >
            {isLoading ? 'Creating...' : 'Create New Room'}
          </button>
          <button 
            onClick={handleJoinRoom} 
            disabled={isLoading}
            className="primary-button"
          >
            {isLoading ? 'Joining...' : 'Join Random Room'}
          </button>
        </div>

        <div className="room-code-section">
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              setShowRoomCode(!showRoomCode);
            }}
          >
            {showRoomCode ? 'Hide room code' : 'Have a room code?'}
          </a>
          
          {showRoomCode && (
            <div className="room-code-input">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter room code"
                disabled={isLoading}
              />
              <button 
                onClick={handleJoinSpecificRoom} 
                disabled={isLoading}
                className="secondary-button"
              >
                {isLoading ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};