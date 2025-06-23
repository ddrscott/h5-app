import React, { useState, useEffect } from 'react';
import { Card, Meld } from '../types/game';
import { PlayerHandTable } from './PlayerHandTable';
import { PlayerHandOverlapping } from './PlayerHandOverlapping';
import { CardIcon } from './CardIcon';
import { LayoutGrid, Layers } from 'lucide-react';

interface PlayerHandProps {
  cards: Card[];
  selectedCards: Set<string>;
  onCardClick: (cardCode: string) => void;
  isMyTurn: boolean;
  onPlayCards: () => void;
  onPass: () => void;
  currentMeld: Meld | null;
  isLeader: boolean;
  lastError: string | null;
  consecutivePasses: number;
}

export const PlayerHand: React.FC<PlayerHandProps> = (props) => {
  // Initialize from localStorage, defaulting to table mode (false for overlapping)
  const [useOverlapping, setUseOverlapping] = useState(() => {
    const saved = localStorage.getItem('handDisplayMode');
    return saved === 'overlapping';
  });

  // Save preference to localStorage whenever it changes
  const toggleDisplayMode = () => {
    const newMode = !useOverlapping;
    setUseOverlapping(newMode);
    localStorage.setItem('handDisplayMode', newMode ? 'overlapping' : 'table');
  };

  return (
    <div className="w-full relative">
      {/* Layout toggle button - positioned absolutely */}
      <button
        onClick={toggleDisplayMode}
        className="absolute top-0 right-0 z-50 btn btn-xs btn-ghost opacity-30 hover:opacity-70 p-1"
        title={useOverlapping ? 'Switch to Table View' : 'Switch to Overlapping View'}
      >
        {useOverlapping ? (
          <LayoutGrid size={16} />
        ) : (
          <Layers size={16} />
        )}
      </button>
      
      {useOverlapping ? (
        <>
          <PlayerHandOverlapping
            cards={props.cards}
            selectedCards={props.selectedCards}
            onCardClick={props.onCardClick}
            isMyTurn={props.isMyTurn}
          />
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={props.onPass}
                disabled={!props.isMyTurn}
                className="btn btn-error btn-sm"
              >
                Pass
              </button>
              <h3 className="text-sm font-semibold">My Hand ({props.cards.length})</h3>
              <button
                onClick={props.onPlayCards}
                disabled={!props.isMyTurn || props.selectedCards.size === 0}
                className="btn btn-success btn-sm"
              >
                Play ({props.selectedCards.size})
              </button>
            </div>
            {props.isMyTurn && (
              <div className="text-xs text-center px-4">
                {props.lastError ? (
                  <span className="text-error font-semibold animate-pulse">{props.lastError}</span>
                ) : (
                  <span className="text-base-content/70">
                    {(props.isLeader && props.consecutivePasses === 0) ? (
                      <span className="text-success">👑 You're the leader - play any valid meld!</span>
                    ) : props.currentMeld ? (
                      <span className="flex items-center justify-center gap-1 flex-wrap">
                        Beat: <span className="font-semibold">{props.currentMeld.type}</span>
                        <span className="flex items-center gap-1">
                          {props.currentMeld.cards.slice(0, 3).map((card, idx) => (
                            <CardIcon key={idx} card={card} size="xs" />
                          ))}
                          {props.currentMeld.cards.length > 3 && <span>...</span>}
                        </span>
                      </span>
                    ) : (
                      <span>No cards played yet</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <PlayerHandTable {...props} />
      )}
    </div>
  );
};
