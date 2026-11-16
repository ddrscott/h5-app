import React, { useState, useEffect } from 'react';

export const OfflineNotification: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Hide notification after a brief moment when coming back online
      setTimeout(() => setShowNotification(false), 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowNotification(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showNotification) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isOnline ? 'bg-green-600' : 'bg-red-600'
    }`}>
      <div className="text-center py-3 px-4">
        <p className="text-white font-medium">
          {isOnline ? (
            <>
              ✓ Back online! Reconnecting to game server...
            </>
          ) : (
            <>
              ⚠️ No internet connection - Heart of Five requires an active connection to play
            </>
          )}
        </p>
      </div>
    </div>
  );
};