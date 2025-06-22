import React from 'react';
import { Player } from '../types/game';

interface PlayersListProps {
  players: Map<string, Player> | undefined;
  currentTurnPlayerId: string | null;
  leadPlayerId: string | null;
  myPlayerId: string;
}

export const PlayersList: React.FC<PlayersListProps> = ({ 
  players, 
  currentTurnPlayerId,
  leadPlayerId, 
  myPlayerId 
}) => {
  // Handle case where players might not be loaded yet
  if (!players || players.size === 0) {
    return (
      <div className="p-2 h-full overflow-y-auto">
        <h3 className="text-sm font-bold mb-2 sticky top-0 bg-base-200">Players</h3>
        <div className="text-xs text-center p-2">
          <span>Waiting for players...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 h-full overflow-y-auto">
      <h3 className="text-sm font-bold mb-2 sticky top-0 bg-base-200 z-10">Players</h3>
      <div className="space-y-2">
        {Array.from(players.entries()).map(([playerId, player]) => (
          <div 
            key={playerId} 
            className={`px-2 py-1 rounded ${
              playerId === currentTurnPlayerId ? 'outline outline-2 outline-warning' : ''
            } ${
              playerId === myPlayerId ? 'bg-primary/20' : 'bg-base-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 min-w-0">
                <span className="truncate font-medium">
                  {player.name}
                </span>
                {playerId === myPlayerId && <span className="badge badge-xs badge-primary">You</span>}
                {playerId === leadPlayerId && <span className="text-warning">👑</span>}
                {playerId === currentTurnPlayerId && <span className="text-warning animate-pulse">⏰</span>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[0.625rem]">🃏{player.handCount}</span>
                <span className="text-[0.625rem]">W{player.wins}/L{player.losses}</span>
              </div>
            </div>
            {(player.hasPassed || player.isOut) && (
              <div className="flex gap-1 mt-0.5">
                {player.hasPassed && <span className="badge badge-warning badge-xs">PASS</span>}
                {player.isOut && <span className="badge badge-error badge-xs">OUT</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
