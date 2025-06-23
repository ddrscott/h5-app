import React from 'react';
import { Card, Suit } from '../types/game';
import { CardIcon } from './CardIcon';

interface PlayerHandOverlappingProps {
  cards: Card[];
  selectedCards: Set<string>;
  onCardClick: (cardCode: string) => void;
  isMyTurn: boolean;
}

export const PlayerHandOverlapping: React.FC<PlayerHandOverlappingProps> = ({
  cards,
  selectedCards,
  onCardClick,
  isMyTurn,
}) => {
  // Sort cards by suit then rank
  const sortedCards = [...cards].sort((a, b) => {
    if (a.suit !== b.suit) {
      const suitOrder = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES, Suit.JOKER];
      return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    }
    return a.rank - b.rank;
  });

  const getRankDisplay = (card: Card): string => {
    if (card.rank === 16) return 'jk'; // Small joker
    if (card.rank === 17) return 'JK'; // Big joker
    
    switch (card.rank) {
      case 11: return 'J';
      case 12: return 'Q';
      case 13: return 'K';
      case 14: return 'A';
      case 15: return '2';
      default: return card.rank.toString();
    }
  };

  const getSuitSymbol = (suit: Suit): string => {
    switch (suit) {
      case Suit.SPADES: return '♠';
      case Suit.HEARTS: return '♥';
      case Suit.DIAMONDS: return '♦';
      case Suit.CLUBS: return '♣';
      case Suit.JOKER: return '🃏';
      default: return '';
    }
  };

  const getSuitClass = (suit: Suit): string => {
    if (suit === Suit.HEARTS || suit === Suit.DIAMONDS) return 'text-red-suit';
    return 'text-black-suit';
  };

  return (
    <div className="relative flex justify-center items-center py-4 px-1 md:py-4 md:px-2">
      <div className="relative inline-flex max-w-full">
        {sortedCards.map((card, index) => {
          const isSelected = selectedCards.has(card.code);
          const cardWidth = cards.length > 10 ? 'playing-card-responsive-sm' : 'playing-card-responsive';
          const overlap = cards.length > 12 ? 'overlap-tight' : 'overlap-normal';
          
          return (
            <div
              key={card.code}
              className={`${overlap} ${index === 0 ? '' : '-ml-overlap'} transition-all duration-200`}
              style={{
                zIndex: index, // Keep original z-index order
              }}
            >
              <div
                className={`${cardWidth} bg-white border-2 border-gray-300 rounded-lg cursor-pointer relative shadow-md ${
                  isSelected ? 'card-selected-overlap' : ''
                } ${!isMyTurn ? 'opacity-60 cursor-not-allowed' : ''} ${
                  card.isSpecial ? 'ring-2 ring-yellow-400' : ''
                }`}
                onClick={() => isMyTurn && onCardClick(card.code)}
                title={card.code}
              >
                {card.suit === Suit.JOKER ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-base md:text-lg lg:text-xl font-bold">{getRankDisplay(card)}</span>
                    <span className="text-2xl md:text-3xl lg:text-4xl">{getSuitSymbol(card.suit)}</span>
                  </div>
                ) : (
                  <>
                    {/* Top left corner */}
                    <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${getSuitClass(card.suit)}`}>
                      <span className="text-sm md:text-base lg:text-lg font-bold">
                        {getRankDisplay(card)}
                      </span>
                      <span className="text-xs md:text-sm lg:text-base -mt-0.5">
                        {getSuitSymbol(card.suit)}
                      </span>
                    </div>
                    
                    {/* Bottom right corner (upside down) */}
                    <div className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 ${getSuitClass(card.suit)}`}>
                      <span className="text-sm md:text-base lg:text-lg font-bold">
                        {getRankDisplay(card)}
                      </span>
                      <span className="text-xs md:text-sm lg:text-base -mt-0.5">
                        {getSuitSymbol(card.suit)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
