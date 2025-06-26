import React from 'react';
import type { Card as CardType } from '../../types/game';
import { CardFace } from './CardFace';

interface CardProps extends Partial<CardType> {
  className?: string;
  isBack?: boolean;
  onClick?: () => void;
  selected?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ 
  suit = '', 
  rank = 0, 
  className = '', 
  isBack = false,
  onClick,
  selected = false,
  style
}) => {
  // Handle joker cards
  if (suit === 'J') {
    return (
      <div
        className={`relative ${className}`}
        onClick={onClick}
        style={style}
      >
        <CardFace suit="J" rank={rank} selected={selected} />
      </div>
    );
  }

  if (isBack) {
    return (
      <div
        className={`relative ${className}`}
        onClick={onClick}
        style={style}
      >
        <div className={`card-base card-back ${selected ? 'card-selected' : ''}`}>
          {/* Card back pattern is handled by CSS */}
        </div>
      </div>
    );
  }

  // Convert rank values - assuming the game uses different rank values
  const convertRank = () => {
    if (rank === 15) return 2;  // 2 is highest in this game
    if (rank === 14) return 1;  // Ace
    if (rank >= 3 && rank <= 13) return rank;
    return rank;
  };

  // Validate suit
  const validSuit = ['H', 'D', 'C', 'S'].includes(suit) ? suit as 'H' | 'D' | 'C' | 'S' : 'H';
  const displayRank = convertRank();

  return (
    <div
      className={`relative ${className}`}
      onClick={onClick}
      style={style}
    >
      <CardFace suit={validSuit} rank={displayRank} selected={selected} />
    </div>
  );
};
