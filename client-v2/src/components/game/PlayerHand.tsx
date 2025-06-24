import React from 'react';
import type { Card as CardType } from '../../types/game';
import { Card } from '../ui/Card';

interface PlayerHandProps {
  hand: CardType[];
  selectedCards: Set<string>;
  onCardSelect: (cardKey: string) => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  hand,
  selectedCards,
  onCardSelect
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 overflow-x-auto overflow-y-hidden">
      <div 
        className="player-hand justify-center"
        style={{
          gridTemplateColumns: `repeat(${hand.length}, 1.5em)`,
          minWidth: 'fit-content'
        }}
      >
        {hand.map((card, index) => {
          const cardKey = card.code || `${card.suit}${card.rank}`;
          const isSelected = selectedCards.has(cardKey);

          return (
            <Card
              key={cardKey}
              {...card}
              onClick={() => onCardSelect(cardKey)}
              selected={isSelected}
              className={`player-card ${isSelected ? 'selected' : ''}`}
              style={{
                zIndex: index,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};