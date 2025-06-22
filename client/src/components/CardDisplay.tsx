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
    <div className={`card ${isRed ? 'red' : 'black'} ${card.isSpecial ? 'special' : ''}`}>
      <div className="card-rank">{getRankDisplay(card.rank)}</div>
      <div className="card-suit">{getSuitSymbol(card.suit)}</div>
      {card.isSpecial && <div className="special-indicator">⭐</div>}
      {isJoker && <div className="joker-type">{card.rank === 17 ? 'BIG' : 'SMALL'}</div>}
    </div>
  );
};