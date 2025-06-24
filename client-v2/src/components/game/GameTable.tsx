import React, { useState } from 'react';
import type { Card as CardType, Player, Meld } from '../../types/game';
import { Card } from '../ui/Card';
import { PlayerHand } from './PlayerHand';
import { OtherHand } from './OtherHand';

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
  consecutivePasses: number;
  trickMelds: Meld[];
  lastTrickMelds: Meld[];
  lastError?: string | null;
  lastNotification?: string | null;
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
  consecutivePasses,
  trickMelds,
  lastTrickMelds,
  lastError,
  lastNotification,
  onCardSelect,
  onPlayCards,
  onPass,
  onLeaveGame,
}) => {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const isLeader = leadPlayerId === myPlayerId;
  const canPass = isLeader ? !!currentMeld : true; // Leader can only pass if there's a meld to beat

  // Detect when cards should sweep (when trickMelds becomes empty after having cards)
  const prevTrickMeldsLength = React.useRef(0);
  
  React.useEffect(() => {
    console.log('trickMelds:', trickMelds);
    console.log('trickMelds length:', trickMelds.length);
    if (prevTrickMeldsLength.current > 0 && trickMelds.length === 0) {
      // Cards were cleared, trigger sweep animation
      setIsSweeping(true);
      setTimeout(() => {
        setIsSweeping(false);
      }, 500);
    }
    prevTrickMeldsLength.current = trickMelds.length;
  }, [trickMelds]);

  // Get other players for positioning
  const otherPlayers = Array.from(players.entries())
    .filter(([id]) => id !== myPlayerId)
    .map(([id, player]) => ({ id, player }));

  // Position players around the table in landscape
  const getPlayerPosition = (index: number, total: number) => {
    if (total === 1) {
      // Single opponent at top
      return { 
        top: '5%', 
        left: '50%', 
        transform: 'translateX(-50%)'
      };
    } else if (total === 2) {
      // Two opponents: one top, one right (for 3-player game)
      return index === 0 
        ? { 
            top: '5%', 
            left: '50%', 
            transform: 'translateX(-50%)'
          }
        : { 
            top: '50%', 
            right: '2%', 
            transform: 'translateY(-50%) rotate(90deg)'
          };
    } else if (total === 3) {
      // Three opponents: left, top, right
      if (index === 0) {
        return { 
          top: '50%', 
          left: '2%', 
          transform: 'translateY(-50%) rotate(-90deg)'
        };
      } else if (index === 1) {
        return { 
          top: '5%', 
          left: '50%', 
          transform: 'translateX(-50%)'
        };
      } else {
        return { 
          top: '50%', 
          right: '2%', 
          transform: 'translateY(-50%) rotate(90deg)'
        };
      }
    } else {
      // 4+ players: distribute along top
      const spacing = 100 / (total + 1);
      const position = spacing * (index + 1);
      return { 
        top: '5%', 
        left: `${position}%`, 
        transform: 'translateX(-50%)'
      };
    }
  };

  const myPlayer = players.get(myPlayerId);

  return (
    <div className="fixed inset-0 felt-texture overflow-hidden">
      {/* Score Panel with Game Title */}
      <div className="absolute top-1 right-2 p-3 z-20">
        <h3 className="text-sm font-bold text-gold mb-1">Heart of Five</h3>
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
            <OtherHand
              key={opponent.id}
              opponent={opponent}
              position={position}
              isCurrentTurn={isCurrentTurn}
              isLeader={isLeaderPlayer}
            />
          );
        })}

        {/* Swept Cards - Off to the side */}
            <div className="absolute bottom-[20vh] left-[10vw] landscape:left-[20vw] landscape:bottom-[40vh]">
            {lastTrickMelds.length > 0 && (
            <div className="relative">
              {lastTrickMelds.map((meld, meldIndex) => (
                <div
                  key={`swept-${meldIndex}`}
                  className="absolute inset-0"
                >
                  {meld.cards.map((card, cardIndex) => {
                    // Create more natural, less uniform positions
                    const cardTotal = lastTrickMelds.reduce((sum, m) => sum + m.cards.length, 0);
                    const globalIndex = lastTrickMelds.slice(0, meldIndex).reduce((sum, m) => sum + m.cards.length, 0) + cardIndex;
                    // console.log('globalIndex:', globalIndex, 'cardTotal:', cardTotal, meldIndex, cardIndex);
                    
                    // More chaotic positioning using different patterns
                    const seed1 = globalIndex * 1;
                    const seed2 = globalIndex * 1;
                    const seed3 = globalIndex * 1;
                    
                    // Mix different functions for less predictable patterns
                    const xSpread  = Math.sin(seed1) * 20 + Math.cos(seed2) * 20; // More varied X
                    const ySpread  = Math.sin(seed2) * 20 + Math.sin(seed3) * 20 - 25; // More varied Y
                    const rotation = Math.sin(seed1) * 20 + Math.cos(seed3) * 20; // Mix of rotations
                    
                    return (
                      <Card
                        key={`swept-${meldIndex}-${card.suit}-${card.rank}-${cardIndex}`}
                        {...card}
                        className="absolute transform scale-50 cursor-default"
                        style={{ 
                          transform: `rotate(${rotation}deg) scale(0.3)`,
                          top: `${ySpread}px`,
                          left: `${xSpread}px`,
                          filter: 'brightness(0.3)' // Same darkening as older melds
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            )}
            {/* Label painted on felt below cards */}
              <p className="text-center text-xs mt-2 text-yellow-100/40
                  font-serif tracking-wider
                  border border-yellow-200/20 rounded-lg p-6">Discards</p>
          </div>

        {/* Center Play Area - Messy Stack */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
          isSweeping ? 'translate-x-[-200%] opacity-0' : ''
        }`}>
          <div className="relative">{/* Add relative container for proper centering */}
          {/* All center melds stacked messily */}
          {trickMelds.map((meld, meldIndex) => {
            const isCurrentMeld = meldIndex === trickMelds.length - 1;
            
            // Sort cards by rank for the current meld only
            const cardsToDisplay = isCurrentMeld 
              ? [...meld.cards].sort((a, b) => a.rank - b.rank)
              : meld.cards;
            
            return (
              <div
                key={`center-${meldIndex}`}
                className="absolute"
                style={{
                  // More varied rotation using different patterns
                  transform: `rotate(${Math.sin(meldIndex * 2.3) * 20 + Math.cos(meldIndex * 1.7) * 15}deg)`,
                  zIndex: meldIndex * 100,
                  filter: isCurrentMeld ? 'none' : 'brightness(0.3) contrast(0.7)', // Darken and reduce contrast for older melds
                }}
              >
                {cardsToDisplay.map((card, cardIndex) => (
                  <Card
                    key={`center-${meldIndex}-${card.suit}-${card.rank}-${cardIndex}`}
                    {...card}
                    className="absolute transform transition-all cursor-default"
                    style={{ 
                      transform: `translate(-50%, -50%) translateX(${(cardIndex - cardsToDisplay.length / 2) * 30}px) rotate(${(cardIndex - cardsToDisplay.length / 2) * 5}deg) scale(0.9)`,
                      top: '50%',
                      left: '50%',
                      animation: isCurrentMeld ? 'tossCard 0.3s ease-out' : 'none'
                    }}
                  />
                ))}
              </div>
            );
          })}
          
          {/* Leader message when center is empty */}
          {!currentMeld && isMyTurn && isLeader && (
            <div className="bg-gold/20 backdrop-blur-sm border-2 border-gold px-6 py-4 rounded-lg">
              <p className="text-lg text-gold font-bold text-center">
                You are the leader
              </p>
              <p className="text-sm text-gold text-center mt-1">
                You may lead with any type
              </p>
            </div>
          )}
          
          {/* Deck and Discard indicators */}
          {!currentMeld && !isLeader && (
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Card suit="" rank={0} isBack className="w-16 h-24" />
                <span className="absolute left-1/2 transform -translate-x-1/2 text-xs bg-gray-800/90 px-2 py-1 rounded">
                  {deckCount}
                </span>
              </div>
              {discardTop && (
                <Card {...discardTop} className="w-16 h-24" />
              )}
            </div>
          )}
          </div>{/* Close relative container */}
        </div>

        {/* Important Notification - Center of screen */}
        {lastNotification && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-notification-pop pointer-events-none">
            <div className="bg-gold/20 backdrop-blur-sm rounded-lg px-8 py-6 shadow-2xl border-2 border-gold">
              <p className="text-2xl text-gold font-bold text-center whitespace-nowrap">
                {lastNotification}
              </p>
            </div>
          </div>
        )}

        {/* Error Toast - Above Action Buttons */}
        {lastError && (
          <div className="absolute bottom-36 left-1/2 transform -translate-x-1/2 z-40 animate-fade-in">
            <div className="bg-red-900/90 backdrop-blur-sm rounded-lg px-6 py-3 shadow-xl border border-red-700">
              <p className="text-sm text-red-100 font-medium">{lastError}</p>
            </div>
          </div>
        )}

        {/* Action Buttons - Above Cards */}
        {isMyTurn && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex space-x-3 z-30">
            <button
              onClick={onPlayCards}
              disabled={selectedCards.size === 0}
              className={`min-w-48 ${
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

      {/* Current Player Nameplate - Bottom center above hand */}
      {myPlayer && (
        <div className="absolute bottom-[3.2em] left-1/2 transform -translate-x-1/2">
          <div className={`
            bg-gray-800/90 rounded-lg px-3 py-2 transition-all duration-300
            ${isMyTurn ? 'ring-2 ring-gold shadow-glow' : ''}
          `}>
            <p className="text-xs font-medium text-center">
              {isLeader && '👑 '}
              {myPlayer.name} (You)
              <span className="font-bold ml-1">({myPlayer.wins}-{myPlayer.losses})</span>
              {isMyTurn && ' 🎯'}
            </p>
          </div>
        </div>
      )}

      {/* Player Hand - Bottom of screen */}
      <PlayerHand 
        hand={myHand}
        selectedCards={selectedCards}
        onCardSelect={onCardSelect}
      />
    </div>
  );
};
