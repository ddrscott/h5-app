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
  // Use larger spacing on small devices for easier touch
  const [columnWidth, setColumnWidth] = React.useState('1.5em');
  
  React.useEffect(() => {
    const updateColumnWidth = () => {
      // On screens smaller than 768px (md breakpoint), use larger spacing
      if (window.innerWidth < 768) {
        setColumnWidth('2em');
      } else {
        setColumnWidth('1.5em');
      }
    };
    
    updateColumnWidth();
    window.addEventListener('resize', updateColumnWidth);
    return () => window.removeEventListener('resize', updateColumnWidth);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 overflow-x-auto overflow-y-hidden">
      <div 
        className="player-hand"
        style={{
          gridTemplateColumns: `repeat(${hand.length}, ${columnWidth})`,
          width: 'max-content',
          margin: '0 auto'
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