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
    <div className="playing-area">
      <div className="current-play">
        <h3>Current Play</h3>
        {currentMeld ? (
          <div className="current-meld">
            <div className="meld-info">
              <span>{currentPlayer?.name || 'Unknown'} played:</span>
              <span className="meld-type">{currentMeld.type}</span>
            </div>
            <div className="meld-cards">
              {currentMeld.cards.map((card, index) => (
                <CardDisplay key={index} card={card} />
              ))}
            </div>
          </div>
        ) : (
          <div className="no-cards-played">
            No cards played yet
            {isMyTurn && <div className="free-play-notice">👑 You can play any valid meld!</div>}
          </div>
        )}
      </div>

      <div className="game-status">
        {!isMyTurn && currentTurnPlayer && (
          <div className="waiting-indicator">
            ⏳ Waiting for {currentTurnPlayer.name} to play...
          </div>
        )}
      </div>
    </div>
  );
};
