import React, { useState, useEffect } from 'react';
import { Welcome } from './Welcome';
import { OfflineScreen } from './OfflineScreen';

interface PlayProps {
  onJoinGame: (playerName: string, roomId?: string) => void;
}

export const Play: React.FC<PlayProps> = ({ onJoinGame }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return <OfflineScreen />;
  }

  return <Welcome onJoinGame={onJoinGame} />;
};