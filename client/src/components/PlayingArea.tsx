import React from 'react';
import { Meld, Player } from '../types/game';
import { CardDisplay } from './CardDisplay';

interface PlayingAreaProps {
  currentMeld: Meld | null;
  isMyTurn: boolean;
  currentTurnPlayerId: string | null;
  players: Map<string, Player>;
}

export const PlayingArea: React.FC<PlayingAreaProps> = ({ 
  currentMeld, 
  isMyTurn, 
  currentTurnPlayerId,
  players 
}) => {
  const currentPlayer = Array.from(players.values()).find(p => 
    currentMeld && p.id === currentMeld.playerId
  );
  const currentTurnPlayer = currentTurnPlayerId ? players.get(currentTurnPlayerId) : null;

  return (
    <div className="card bg-base-200 flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-4">Current Play</h3>
        {currentMeld ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">{currentPlayer?.name || 'Unknown'} played:</span>
              <span className="badge badge-lg badge-primary">{currentMeld.type}</span>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {currentMeld.cards.map((card, index) => (
                <CardDisplay key={index} card={card} />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base-content/60 italic">No cards played yet</p>
            {isMyTurn && (
              <div className="alert alert-success">
                <span className="text-lg">👑 You can play any valid meld!</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isMyTurn && currentTurnPlayer && (
        <div className="mt-8">
          <div className="alert alert-info">
            <span className="loading loading-spinner loading-sm"></span>
            <span>Waiting for {currentTurnPlayer.name} to play...</span>
          </div>
        </div>
      )}
    </div>
  );
};