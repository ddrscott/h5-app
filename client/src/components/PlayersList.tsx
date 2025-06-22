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
      <div className="players-list">
        <h3>Players</h3>
        <div className="player-info">
          <div className="player-name">Waiting for players...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="players-list">
      <h3>Players</h3>
      {Array.from(players.entries()).map(([playerId, player]) => (
        <div 
          key={playerId} 
          className={`player-info ${
            playerId === currentTurnPlayerId ? 'current-turn' : ''
          }`}
        >
          <div className="player-name">
            {player.name} 
            {playerId === myPlayerId && ' (You)'}
            {playerId === leadPlayerId && ' 👑'}
          </div>
          <div className="player-stats">
            <span>Cards: {player.handCount}</span>
            <span>W: {player.wins} L: {player.losses}</span>
          </div>
          {player.hasPassed && <div className="player-status passed">PASSED</div>}
          {player.isOut && <div className="player-status out">OUT</div>}
        </div>
      ))}
    </div>
  );
};
