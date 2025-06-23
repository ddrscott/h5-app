import React from 'react';
import { Card, Suit } from '../types/game';

interface CardDisplayProps {
  card: Card;
}

export const CardDisplay: React.FC<CardDisplayProps> = ({ card }) => {
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

  const getRankDisplay = (rank: number): string => {
    switch (rank) {
      case 11: return 'J';
      case 12: return 'Q';
      case 13: return 'K';
      case 14: return 'A';
      case 15: return '2';
      case 16: return '🃏';
      case 17: return '🃏';
      default: return rank.toString();
    }
  };

  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  const isJoker = card.rank === 16 || card.rank === 17;

  return (
    <div className={`playing-card-lg bg-white border-2 ${
      card.isSpecial ? 'border-warning outline outline-2 outline-warning' : 'border-base-content'
    } rounded-lg relative font-bold shadow-lg`}>
      {isJoker ? (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-lg font-bold">{card.rank === 17 ? 'BIG' : 'SMALL'}</span>
          <span className="text-4xl">{getSuitSymbol(card.suit)}</span>
        </div>
      ) : (
        <>
          {/* Top left corner */}
          <div className={`absolute top-1 left-2 flex flex-col items-center leading-none ${isRed ? 'text-red-suit' : 'text-black-suit'}`}>
            <span className="text-xl font-bold">
              {getRankDisplay(card.rank)}
            </span>
            <span className="text-lg -mt-0.5">
              {getSuitSymbol(card.suit)}
            </span>
          </div>
          
          {/* Bottom right corner (upside down) */}
          <div className={`absolute bottom-1 right-2 flex flex-col items-center leading-none rotate-180 ${isRed ? 'text-red-suit' : 'text-black-suit'}`}>
            <span className="text-xl font-bold">
              {getRankDisplay(card.rank)}
            </span>
            <span className="text-lg -mt-0.5">
              {getSuitSymbol(card.suit)}
            </span>
          </div>
          
          {/* Special card indicator */}
          {card.isSpecial && (
            <div className="absolute top-1 right-1 text-warning text-sm">⭐</div>
          )}
        </>
      )}
    </div>
  );
};