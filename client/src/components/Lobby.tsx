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
    <div className="hero min-h-screen">
      <div className="hero-content flex-col">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2">❤️ Heart of Five</h1>
          <p className="text-xl text-base-content/70">(红心五) 🃏</p>
          <h2 className="text-2xl mt-4">Multiplayer Card Game</h2>
        </div>
        
        <div className="card w-full max-w-md bg-base-200 shadow-xl">
          <div className="card-body">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Your Name</span>
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="input input-bordered w-full"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 mt-6">
              <button 
                onClick={handleCreateRoom} 
                disabled={isLoading}
                className="btn btn-primary btn-lg"
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Creating...
                  </>
                ) : (
                  'Create New Room'
                )}
              </button>
              <button 
                onClick={handleJoinRoom} 
                disabled={isLoading}
                className="btn btn-secondary btn-lg"
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Joining...
                  </>
                ) : (
                  'Join Random Room'
                )}
              </button>
            </div>

            <div className="divider">OR</div>

            <div className="collapse collapse-arrow bg-base-300">
              <input 
                type="checkbox" 
                checked={showRoomCode}
                onChange={(e) => setShowRoomCode(e.target.checked)}
              />
              <div className="collapse-title text-sm font-medium">
                Have a room code?
              </div>
              <div className="collapse-content">
                <div className="join w-full">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="Enter room code"
                    disabled={isLoading}
                    className="input input-bordered join-item flex-1"
                  />
                  <button 
                    onClick={handleJoinSpecificRoom} 
                    disabled={isLoading || !roomCode.trim()}
                    className="btn join-item"
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Joining...
                      </>
                    ) : (
                      'Join Room'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-error mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};