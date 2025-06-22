import React from 'react';
import { Card, Suit } from '../types/game';

interface CardIconProps {
  card: Card;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const CardIcon: React.FC<CardIconProps> = ({ card, size = 'sm' }) => {
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
      case 16: return '🃏'; // Small joker
      case 17: return '🃏'; // Big joker
      default: return rank.toString();
    }
  };

  const isRed = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  const isJoker = card.rank === 16 || card.rank === 17;

  const sizeClasses = {
    xs: 'w-6 h-8 text-xs',
    sm: 'w-8 h-10 text-xs',
    md: 'w-10 h-12 text-sm',
    lg: 'w-12 h-16 text-base'
  };

  // For jokers, show emoji with size indicator
  if (isJoker) {
    return (
      <span className={`inline-flex flex-col items-center justify-center ${sizeClasses[size]} bg-white border border-base-content rounded font-bold shadow-sm`}>
        <span className={size === 'xs' ? 'text-[0.5rem]' : 'text-[0.625rem]'}>{card.rank === 17 ? 'Big' : 'Small'}</span>
        <span className={size === 'xs' ? 'text-[0.625rem]' : ''}>{getRankDisplay(card.rank)}</span>
      </span>
    );
  }

  // For regular cards, show rank and suit
  return (
    <span className={`inline-flex flex-col items-center justify-center ${sizeClasses[size]} bg-white border border-base-content rounded font-bold shadow-sm`}>
      <span className={isRed ? 'text-red-suit' : 'text-black-suit'}>
        {getRankDisplay(card.rank)}
      </span>
      <span className={`${isRed ? 'text-red-suit' : 'text-black-suit'} ${size === 'sm' ? 'text-xs' : ''}`}>
        {getSuitSymbol(card.suit)}
      </span>
    </span>
  );
};

// Helper function to create a card icon from card code (used in chat)
export const createCardFromCode = (code: string): Card | null => {
  if (code === 'jj') {
    return { rank: 16, suit: Suit.JOKER, code: 'jj', isSpecial: false };
  }
  if (code === 'JJ') {
    return { rank: 17, suit: Suit.JOKER, code: 'JJ', isSpecial: false };
  }

  // Parse regular card codes
  const rankMap: { [key: string]: number } = {
    'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10, '2': 15
  };

  let rankStr: string;
  let suitStr: string;

  if (code.length === 3 && code.startsWith('10')) {
    rankStr = '10';
    suitStr = code[2];
  } else if (code.length === 2) {
    rankStr = code[0];
    suitStr = code[1];
  } else {
    return null;
  }

  const rank = rankMap[rankStr] || parseInt(rankStr);
  const suitMap: { [key: string]: Suit } = {
    'S': Suit.SPADES,
    'H': Suit.HEARTS,
    'D': Suit.DIAMONDS,
    'C': Suit.CLUBS
  };

  const suit = suitMap[suitStr];
  if (!suit || isNaN(rank)) return null;

  return {
    rank,
    suit,
    code,
    isSpecial: rank === 5 && suit === Suit.HEARTS
  };
};