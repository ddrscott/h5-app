import React from 'react';
import type { Card as CardType } from '../../types/game';

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
  const getSuitSymbol = () => {
    const symbols: Record<string, string> = {
      'H': '♥',
      'D': '♦',
      'C': '♣',
      'S': '♠',
      'J': '🃏'
    };
    return symbols[suit] || '';
  };

  const getRankDisplay = () => {
    if (suit === 'J') {
      return rank === 16 ? 'JK' : 'JK';
    }
    if (rank === 14) return 'A';
    if (rank === 13) return 'K';
    if (rank === 12) return 'Q';
    if (rank === 11) return 'J';
    return rank.toString();
  };

  const getSuitColor = () => {
    return suit === 'H' || suit === 'D' ? 'text-card-red' : 'text-card-black';
  };

  if (isBack) {
    return (
      <div className={`card-base card-back ${className}`} onClick={onClick} style={style}>
        {/* Card back pattern is handled by CSS */}
      </div>
    );
  }

  return (
    <div 
      className={`card-base ${getSuitColor()} ${selected ? 'ring-4 ring-gold shadow-glow' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      <div className="absolute top-0 left-1 text-center leading-none">
        <div className="text-sm font-bold">{getRankDisplay()}</div>
        <div className="text-md">{getSuitSymbol()}</div>
      </div>
      <div className="absolute bottom-0 right-1 text-center leading-none rotate-180">
        <div className="text-sm font-bold">{getRankDisplay()}</div>
        <div className="text-md">{getSuitSymbol()}</div>
      </div>
    </div>
  );
};
