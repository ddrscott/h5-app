import React, { useState } from 'react';
import type { Card as CardType, Player, Meld } from '../../types/game';
import { Card } from '../ui/Card';

interface GameTableProps {
  players: Map<string, Player>;
  myPlayerId: string;
  myHand: CardType[];
  selectedCards: Set<string>;
  currentMeld?: Meld | null;
  currentTurnPlayerId: string;
  leadPlayerId: string;
  deckCount: number;
  discardTop?: CardType;
  onCardSelect: (cardKey: string) => void;
  onPlayCards: () => void;
  onPass: () => void;
  onLeaveGame: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  players,
  myPlayerId,
  myHand,
  selectedCards,
  currentMeld,
  currentTurnPlayerId,
  leadPlayerId,
  deckCount,
  discardTop,
  onCardSelect,
  onPlayCards,
  onPass,
  onLeaveGame,
}) => {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const isLeader = leadPlayerId === myPlayerId;
  const canPass = !isLeader || !!currentMeld;

  // Get other players for positioning
  const otherPlayers = Array.from(players.entries())
    .filter(([id]) => id !== myPlayerId)
    .map(([id, player]) => ({ id, player }));

  // Position players around the table in landscape
  const getPlayerPosition = (index: number, total: number) => {
    // Distribute players along the top edge in landscape
    const spacing = 100 / (total + 1);
    const position = spacing * (index + 1);
    
    if (total === 1) {
      return { top: '15%', left: '50%', transform: 'translateX(-50%)' };
    } else if (total === 2) {
      return index === 0 
        ? { top: '15%', left: '30%', transform: 'translateX(-50%)' }
        : { top: '15%', right: '30%', transform: 'translateX(50%)' };
    } else {
      return { top: '15%', left: `${position}%`, transform: 'translateX(-50%)' };
    }
  };

  const myPlayer = players.get(myPlayerId);

  return (
    <div className="fixed inset-0 felt-texture overflow-hidden">
      {/* Score Panel with Game Title */}
      <div className="absolute top-2 right-2 bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 shadow-xl z-20">
        <h3 className="text-sm font-bold text-gold mb-1">Heart of Five</h3>
        <div className="space-y-1">
          {Array.from(players.entries()).map(([id, player]) => (
            <div key={id} className="flex justify-between text-xs">
              <span className={id === myPlayerId ? 'text-gold' : ''}>{player.name}</span>
              <span className="font-bold ml-3">{player.wins}W/{player.losses}L</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leave Game Icon */}
      <button
        onClick={() => setShowLeaveConfirm(true)}
        className="absolute top-2 left-2 bg-gray-900/90 backdrop-blur-sm rounded-full p-2 shadow-xl z-20 hover:bg-gray-800 transition-colors"
        title="Leave Game"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold mb-3">Leave Game?</h3>
            <p className="text-gray-300 mb-4">Are you sure you want to leave the game?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  onLeaveGame();
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Leave
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Table Area */}
      <div className="absolute inset-0">
        {/* Other Players */}
        {otherPlayers.map((opponent, index) => {
          const position = getPlayerPosition(index, otherPlayers.length);
          const isCurrentTurn = currentTurnPlayerId === opponent.id;
          const isLeaderPlayer = leadPlayerId === opponent.id;

          return (
            <div
              key={opponent.id}
              className="absolute flex flex-col items-center"
              style={position}
            >
              {/* Player info */}
              <div className={`
                bg-gray-800/90 rounded-lg px-3 py-2 mb-1 transition-all duration-300
                ${isCurrentTurn ? 'ring-2 ring-gold shadow-glow' : ''}
              `}>
                <p className="text-xs font-medium text-center">
                  {isLeaderPlayer && '👑 '}
                  {opponent.player.name}
                  {isCurrentTurn && ' 🎯'}
                </p>
              </div>
              
              {/* Card stack - only showing top portion */}
              <div className="flex -space-x-3">
                {Array.from({ length: Math.min(opponent.player.handCount, 13) }).map((_, i) => (
                  <div key={i} className="relative h-8 w-12">
                    <Card 
                      suit="" 
                      rank={0} 
                      isBack 
                      className="absolute inset-0 w-full h-full scale-75"
                      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 40%)' }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{opponent.player.handCount} cards</p>
            </div>
          );
        })}

        {/* Center Play Area */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          {/* Current Meld */}
          {currentMeld && currentMeld.cards.length > 0 && (
            <div className="flex justify-center -space-x-8">
              {currentMeld.cards.map((card, index) => (
                <Card
                  key={`${card.suit}-${card.rank}-${index}`}
                  {...card}
                  className="transform scale-90 hover:z-10 transition-all"
                  style={{ 
                    transform: `rotate(${(index - currentMeld.cards.length / 2) * 5}deg) scale(0.9)`,
                    animation: 'tossCard 0.3s ease-out'
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Deck and Discard indicators */}
          {!currentMeld && (
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Card suit="" rank={0} isBack className="w-16 h-24" />
                <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs bg-gray-800/90 px-2 py-1 rounded">
                  {deckCount}
                </span>
              </div>
              {discardTop && (
                <Card {...discardTop} className="w-16 h-24" />
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Above Cards */}
        {isMyTurn && (
          <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 flex space-x-3 z-30">
            <button
              onClick={onPlayCards}
              disabled={selectedCards.size === 0}
              className={`${
                selectedCards.size > 0 ? 'bg-gold hover:bg-gold-dark text-gray-900' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              } px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg`}
            >
              Play Cards ({selectedCards.size})
            </button>
            <button
              onClick={onPass}
              disabled={!canPass}
              className={`${
                canPass ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              } px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg`}
            >
              Pass
            </button>
          </div>
        )}

        {/* Turn Indicator */}
        {!isMyTurn && (
          <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-30">
            <div className="bg-gray-900/90 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-sm">
                Waiting for <span className="text-gold font-bold">
                  {players.get(currentTurnPlayerId)?.name || 'Unknown'}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Player Hand - Bottom of screen, CSS Grid layout */}
      <div className="absolute bottom-0 left-0 right-0 pb-4 px-4">
        <div 
          className="player-hand"
          style={{
            gridTemplateColumns: `repeat(${myHand.length}, calc((100% - 70px) / ${myHand.length - 1}))`
          }}
        >
          {myHand.map((card, index) => {
            const cardKey = card.code || `${card.suit}${card.rank}`;
            const isSelected = selectedCards.has(cardKey);

            return (
              <Card
                key={cardKey}
                {...card}
                onClick={() => onCardSelect(cardKey)}
                selected={isSelected}
                className={`player-card ${isSelected ? 'selected' : ''}`}
                style={{
                  zIndex: index,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
