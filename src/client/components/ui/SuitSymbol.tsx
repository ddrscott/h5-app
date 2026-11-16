import React from 'react';

interface SuitSymbolProps {
  suit: 'H' | 'D' | 'C' | 'S';
  size?: number;
  className?: string;
}

const SUIT_SYMBOLS = {
  H: '♥',
  D: '♦',
  C: '♣',
  S: '♠'
};

export const SuitSymbol: React.FC<SuitSymbolProps> = ({ suit, size = 24, className = '' }) => {
  const suitSymbol = SUIT_SYMBOLS[suit];
  const suitColor = suit === 'H' || suit === 'D' ? 'var(--card-red)' : '#000000';
  
  return (
    <span 
      className={className}
      style={{ 
        display: 'inline-block',
        fontSize: `${size}px`,
        lineHeight: 1,
        color: suitColor
      }}
    >
      {suitSymbol}
    </span>
  );
};

// Export suit colors for consistency
export const SUIT_COLORS = {
  H: 'var(--card-red)',
  D: 'var(--card-red)',
  C: '#000000',
  S: '#000000'
};