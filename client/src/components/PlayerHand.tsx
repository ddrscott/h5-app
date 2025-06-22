import React from 'react';
import { Card, Suit, Meld } from '../types/game';
import { CardIcon } from './CardIcon';

interface PlayerHandProps {
  cards: Card[];
  selectedCards: Set<string>;
  onCardClick: (cardCode: string) => void;
  isMyTurn: boolean;
  onPlayCards: () => void;
  onPass: () => void;
  currentMeld: Meld | null;
  isLeader: boolean;
  lastError: string | null;
  consecutivePasses: number;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  selectedCards,
  onCardClick,
  isMyTurn,
  onPlayCards,
  onPass,
  currentMeld,
  isLeader,
  lastError,
  consecutivePasses,
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
    if (suit === Suit.HEARTS || suit === Suit.DIAMONDS) return 'text-red-suit';
    return 'text-black-suit';
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
    <div>
      <div className="overflow-x-auto mb-2">
        <table className="table table-compact mx-auto bg-base-300 rounded-lg">
          <tbody>
            {suits.map(suit => (
              <tr key={suit}>
                <td className="text-center text-2xl px-2">
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
                      <td key={rank} className="p-1 text-center">
                        {card ? (
                          <div
                            className={`playing-card-sm bg-white border border-base-content rounded cursor-pointer transition-all flex flex-col items-center justify-center font-bold ${
                              selectedCards.has(card.code) ? 'card-selected' : ''
                            } ${!isMyTurn ? 'opacity-60 cursor-not-allowed' : 'card-hover'} ${
                              card.isSpecial ? 'card-special' : ''
                            }`}
                            onClick={() => isMyTurn && onCardClick(card.code)}
                            title={card.code}
                          >
                            <span className="text-xs">{jokerType}</span>
                            <span className="text-xs">🃏</span>
                          </div>
                        ) : (
                          <div className="playing-card-sm flex items-center justify-center text-base-content/20">
                            ·
                          </div>
                        )}
                      </td>
                    );
                  }
                  
                  // Handle regular cards
                  const code = getCardCode(rank as number, suit);
                  const card = cardMap.get(code);
                  
                  return (
                    <td key={rank} className="p-1 text-center">
                      {card ? (
                        <div
                          className={`playing-card-sm bg-white border border-base-content rounded cursor-pointer transition-all flex flex-col items-center justify-center font-bold ${
                            selectedCards.has(card.code) ? 'card-selected' : ''
                          } ${!isMyTurn ? 'opacity-60 cursor-not-allowed' : 'card-hover'} ${
                            card.isSpecial ? 'card-special' : ''
                          }`}
                          onClick={() => isMyTurn && onCardClick(card.code)}
                          title={card.code}
                        >
                          <span className={`text-sm ${getSuitClass(card.suit)}`}>
                            {getRankDisplay(rank as number)}
                          </span>
                          <span className={`text-xs ${getSuitClass(card.suit)}`}>
                            {getSuitSymbol(card.suit)}
                          </span>
                        </div>
                      ) : (
                        <div className="playing-card-sm flex items-center justify-center text-base-content/20">
                          ·
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onPass}
          disabled={!isMyTurn}
          className="btn btn-error btn-sm"
        >
          Pass
        </button>
        <h3 className="text-sm font-semibold">My Hand ({cards.length})</h3>
        <button
          onClick={onPlayCards}
          disabled={!isMyTurn || selectedCards.size === 0}
          className="btn btn-success btn-sm"
        >
          Play ({selectedCards.size})
        </button>
        {isMyTurn && (
          <div className="text-xs">
            {lastError ? (
              <span className="text-error font-semibold animate-pulse">⚠️ {lastError}</span>
            ) : (
              <span className="text-base-content/70">
                { (isLeader && consecutivePasses === 0) ? (
                  <span className="text-success">👑 You're the leader - play any valid meld!</span>
                ) : currentMeld ? (
                  <span className="flex items-center gap-1">
                    Beat: <span className="font-semibold">{currentMeld.type}</span>
                    {currentMeld.cards.slice(0, 3).map((card, idx) => (
                      <CardIcon key={idx} card={card} size="xs" />
                    ))}
                    {currentMeld.cards.length > 3 && <span>...</span>}
                  </span>
                ) : (
                  <span>No cards played yet</span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
