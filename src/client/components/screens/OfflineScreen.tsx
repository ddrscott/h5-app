import React from 'react';

export const OfflineScreen: React.FC = () => {
  return (
    <div className="min-h-screen felt-texture flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md text-center">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-red-400 mb-4">No Internet Connection</h1>
        <p className="text-gray-300 mb-6">
          Heart of Five is a real-time multiplayer game that requires an active internet connection to play.
        </p>
        <p className="text-gray-400 text-sm mb-6">
          Please check your connection and try again. The game needs to connect to our servers to:
        </p>
        <ul className="text-left text-gray-400 text-sm mb-6 space-y-1">
          <li>• Match you with other players</li>
          <li>• Synchronize game state in real-time</li>
          <li>• Ensure fair play for all participants</li>
        </ul>
        <button 
          onClick={() => window.location.reload()} 
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};