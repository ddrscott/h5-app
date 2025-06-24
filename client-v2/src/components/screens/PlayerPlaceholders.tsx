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
  // Define specific positions for different player counts
  const getPlayerPositions = (playerCount: number) => {
    // All positions (0=bottom, 1=top, 2=right, 3=left, 4=bottom-right, 5=bottom-left)
    switch (playerCount) {
      case 2:
        return [0, 1]; // Bottom and top
      case 3:
        return [0, 1, 2]; // Bottom, top, right
      case 4:
        return [0, 1, 2, 3]; // Bottom, top, right, left
      case 5:
        return [0, 1, 2, 3, 4]; // Bottom, top, right, left, bottom-right
      case 6:
        return [0, 1, 2, 3, 4, 5]; // All positions
      default:
        return [0]; // Single player at bottom
    }
  };

  // Position angles for each spot (in degrees)
  const positionAngles: Record<number, number> = {
    0: 90,   // Bottom
    1: 270,  // Top
    2: 0,    // Right
    3: 180,  // Left
    4: 45,   // Bottom-right
    5: 135   // Bottom-left
  };

  const activePositions = getPlayerPositions(players.length);

  return (
    <>
      {activePositions.map((position, index) => {
        const player = players[index];
        const angle = positionAngles[position];
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