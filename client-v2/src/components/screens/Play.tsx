import React from 'react';
import { Welcome } from './Welcome';

interface PlayProps {
  onJoinGame: (playerName: string, roomId?: string) => void;
}

export const Play: React.FC<PlayProps> = ({ onJoinGame }) => {
  return <Welcome onJoinGame={onJoinGame} />;
};