import React from 'react';
import { Card, Rank, Suit } from '../types/game';

interface PlayerHandProps {
  cards: Card[];
  selectedCards: Set<string>;
  onCardClick: (cardCode: string) => void;
  isMyTurn: boolean;
  onPlayCards: () => void;
  onPass: () => void;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  selectedCards,
  onCardClick,
  isMyTurn,
  onPlayCards,
  onPass,
}) => {
  // Create a map of cards by code for quick lookup
  const cardMap = new Map<string, Card>();
  cards.forEach(card => {
    cardMap.set(card.code, card);
  });

  // Define the order of ranks (3-2, then jokers)
  const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 'JK'];
  
  // Define the order of suits
  const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];

  const getRankDisplay = (rank: number | string): string => {
    if (rank === 'JK') return 'JK';
    switch (rank) {
      case 11: return 'J';
      case 12: return 'Q';
      case 13: return 'K';
      case 14: return 'A';
      case 15: return '2';
      default: return rank.toString();
    }
  };

  const getSuitSymbol = (suit: Suit): string => {
    switch (suit) {
      case Suit.SPADES: return '♠';
      case Suit.HEARTS: return '♥';
      case Suit.DIAMONDS: return '♦';
      case Suit.CLUBS: return '♣';
      case Suit.JOKER: return '';
      default: return '';
    }
  };

  const getSuitClass = (suit: Suit): string => {
    if (suit === Suit.HEARTS || suit === Suit.DIAMONDS) return 'red';
    return 'black';
  };

  const getCardCode = (rank: number, suit: Suit): string => {
    if (rank === 16) return 'jj'; // Small joker
    if (rank === 17) return 'JJ'; // Big joker
    
    const rankMap: { [key: number]: string } = {
      10: 'T',
      11: 'J',
      12: 'Q',
      13: 'K',
      14: 'A',
      15: '2'
    };
    
    const rankStr = rankMap[rank] || rank.toString();
    return rankStr + suit;
  };

  return (
    <div className="player-hand-container">
      <h3>My Hand ({cards.length} cards)</h3>
      
      <div className="player-hand-table">
        <table>
          <thead>
            <tr>
              <th></th>
              {ranks.map(rank => (
                <th key={rank} className="rank-header">
                  {getRankDisplay(rank)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suits.map(suit => (
              <tr key={suit}>
                <td className="suit-header">
                  <span className={getSuitClass(suit)}>
                    {getSuitSymbol(suit)}
                  </span>
                </td>
                {ranks.map(rank => {
                  // Handle joker column
                  if (rank === 'JK') {
                    let card = null;
                    let jokerType = '';
                    
                    // Small joker in hearts row
                    if (suit === Suit.HEARTS) {
                      card = cardMap.get('jj');
                      jokerType = 'jk';
                    }
                    // Big joker in diamonds row
                    else if (suit === Suit.DIAMONDS) {
                      card = cardMap.get('JJ');
                      jokerType = 'JK';
                    }
                    
                    return (
                      <td key={rank} className="card-cell">
                        {card ? (
                          <div
                            className={`table-card black ${
                              selectedCards.has(card.code) ? 'selected' : ''
                            } ${!isMyTurn ? 'disabled' : ''} special`}
                            onClick={() => isMyTurn && onCardClick(card.code)}
                            title={card.code}
                          >
                            {jokerType}
                          </div>
                        ) : (
                          <div className="empty-card">·</div>
                        )}
                      </td>
                    );
                  }
                  
                  // Handle regular cards
                  const code = getCardCode(rank as number, suit);
                  const card = cardMap.get(code);
                  
                  return (
                    <td key={rank} className="card-cell">
                      {card ? (
                        <div
                          className={`table-card ${getSuitClass(card.suit)} ${
                            selectedCards.has(card.code) ? 'selected' : ''
                          } ${!isMyTurn ? 'disabled' : ''} ${
                            card.isSpecial ? 'special' : ''
                          }`}
                          onClick={() => isMyTurn && onCardClick(card.code)}
                          title={card.code}
                        >
                          {getSuitSymbol(card.suit)}
                        </div>
                      ) : (
                        <div className="empty-card">·</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="hand-controls">
        <button
          onClick={onPlayCards}
          disabled={!isMyTurn || selectedCards.size === 0}
          className="play-button"
        >
          Play Selected Cards ({selectedCards.size})
        </button>
        <button
          onClick={onPass}
          disabled={!isMyTurn}
          className="pass-button"
        >
          Pass
        </button>
      </div>
    </div>
  );
};