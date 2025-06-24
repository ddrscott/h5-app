import React from 'react';
import type { Player } from '../../types/game';
import { User } from 'lucide-react';

interface PlayerPlaceholdersProps {
  players: Player[];
  maxPlayers?: number;
}

export const PlayerPlaceholders: React.FC<PlayerPlaceholdersProps> = ({
  players,
  maxPlayers = 6
}) => {
  return (
    <>
      {Array.from({ length: maxPlayers }).map((_, index) => {
        const player = players[index];
        // Position first spot at bottom, others distributed around
        const angle = index === 0 ? 90 : ((index - 1) * 360) / maxPlayers + 150;
        const radius = 140;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;

        return (
          <div
            key={index}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
            }}
          >
            {player ? (
              <div className="bg-gray-800/90 rounded-lg px-3 py-2 shadow-lg">
                <div className="flex items-center space-x-1">
                  <User size={14} className="text-gray-300" />
                  <span className="text-sm font-medium">{player.name}</span>
                </div>
                {index === 0 && (
                  <span className="text-xs text-gold">HOST</span>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-600 rounded-lg px-3 py-2">
                <div className="flex items-center space-x-1">
                  <User size={14} className="text-gray-500" />
                  <span className="text-sm text-gray-500">Empty</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};