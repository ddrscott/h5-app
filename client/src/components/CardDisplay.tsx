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
    } rounded-lg flex flex-col items-center justify-center relative font-bold shadow-lg`}>
      <div className={`text-2xl ${isRed ? 'text-red-suit' : 'text-black-suit'}`}>
        {getRankDisplay(card.rank)}
      </div>
      <div className={`text-xl ${isRed ? 'text-red-suit' : 'text-black-suit'}`}>
        {getSuitSymbol(card.suit)}
      </div>
      {card.isSpecial && (
        <div className="absolute top-1 right-1 text-warning text-sm">⭐</div>
      )}
      {isJoker && (
        <div className="absolute bottom-1 text-xs text-base-content/60">
          {card.rank === 17 ? 'BIG' : 'SMALL'}
        </div>
      )}
    </div>
  );
};