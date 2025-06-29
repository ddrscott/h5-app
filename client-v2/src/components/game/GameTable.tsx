import React, { useState, useEffect } from 'react';
import type { Card as CardType, Player, Meld } from '../../types/game';
import { GamePhase } from '../../types/game';
import { Card } from '../ui/Card';
import { PlayerHand } from './PlayerHand';
import { OtherHand } from './OtherHand';
import { AnimatedCards } from '../animations/AnimatedCards';
import { CircleText } from '../ui/CircleText';
import { GameOver } from './GameOver';
import { DialogBox } from '../ui/DialogBox';

interface GameTableProps {
  players: Map<string, Player>;
  myPlayerId: string;
  myHand: CardType[];
  selectedCards: Set<string>;
  currentMeld?: Meld | null;
  currentTurnPlayerId: string | null;
  leadPlayerId: string | null;
  deckCount: number;
  discardTop?: CardType;
  consecutivePasses: number;
  trickMelds: Meld[];
  lastTrickMelds: Meld[];
  lastError?: string | null;
  lastNotification?: string | null;
  phase: GamePhase;
  winner?: {
    id: string;
    name: string;
    wins: number;
  };
  finalStandings?: {
    playerId: string;
    name: string;
    wins: number;
    losses: number;
  }[];
  onCardSelect: (cardKey: string) => void;
  onPlayCards: () => void;
  onPass: () => void;
  onLeaveGame: () => void;
  onPlayAgain: () => void;
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
  phase,
  winner,
  finalStandings,
  onCardSelect,
  onPlayCards,
  onPass,
  onLeaveGame,
  onPlayAgain,
}) => {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [animatedMelds, setAnimatedMelds] = useState<Map<string, { cards: CardType[], playerId: string, rotation: number, isNew: boolean }>>(new Map());
  const [sweepingMelds, setSweepingMelds] = useState<Array<{ cards: CardType[], rotation: number, key: string }>>([]);
  const [handRotationOffset, setHandRotationOffset] = useState(0);
  const [isDraggingHand, setIsDraggingHand] = useState(false);
  const animationRef = React.useRef<number | null>(null);
  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const isLeader = leadPlayerId === myPlayerId;
  const canPass = isLeader ? !!currentMeld : true; // Leader can only pass if there's a meld to beat
  
  // Debug logging for leader indicator
  React.useEffect(() => {
    if (isMyTurn) {
      console.log('[GameTable] Leader indicator state:', {
        isMyTurn,
        isLeader,
        currentMeld: !!currentMeld,
        leadPlayerId,
        myPlayerId,
        currentTurnPlayerId,
        shouldShowLeaderMsg: !currentMeld && isMyTurn && isLeader
      });
    }
  }, [isMyTurn, isLeader, currentMeld, leadPlayerId, myPlayerId, currentTurnPlayerId]);

  // Handle playing cards with animation
  const handlePlayCards = () => {
    if (selectedCards.size === 0) return;
    
    // Play cards immediately so game state updates
    onPlayCards();
  };

  // Hand rotation limits and helpers
  const maxRotationLeft = -20;
  const maxRotationRight = 20;
  const elasticOverflow = 8;

  const applyElasticResistance = (targetRotation: number) => {
    if (targetRotation < maxRotationLeft) {
      const overflow = maxRotationLeft - targetRotation;
      const resistance = Math.min(overflow * 0.3, elasticOverflow);
      return maxRotationLeft - resistance;
    } else if (targetRotation > maxRotationRight) {
      const overflow = targetRotation - maxRotationRight;
      const resistance = Math.min(overflow * 0.3, elasticOverflow);
      return maxRotationRight + resistance;
    }
    return targetRotation;
  };

  const animateToRotation = (targetRotation: number, duration: number = 300) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startRotation = handRotationOffset;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
      
      setHandRotationOffset(currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Global wheel handler for player hand rotation
  const handleWheel = React.useCallback((e: WheelEvent) => {
    e.preventDefault();
    const sensitivity = 0.3;
    const deltaRotation = e.deltaX * sensitivity;
    const targetRotation = handRotationOffset + deltaRotation;
    const newRotation = applyElasticResistance(targetRotation);
    
    setHandRotationOffset(newRotation);
    
    // Smooth bounce back from elastic zone after a brief delay
    setTimeout(() => {
      const currentRotation = handRotationOffset + deltaRotation;
      if (currentRotation < maxRotationLeft || currentRotation > maxRotationRight) {
        const bounceTarget = Math.max(maxRotationLeft, Math.min(maxRotationRight, currentRotation));
        animateToRotation(bounceTarget, 200);
      }
    }, 100);
  }, [handRotationOffset, animateToRotation, applyElasticResistance, maxRotationLeft, maxRotationRight]);

  // Detect when cards should sweep (when trickMelds becomes empty after having cards)
  const prevTrickMeldsLength = React.useRef(0);
  
  
  // Sync trickMelds with our animated display
  useEffect(() => {
    setAnimatedMelds(prevAnimatedMelds => {
      const newAnimatedMelds = new Map<string, { cards: CardType[], playerId: string, rotation: number, isNew: boolean }>();
      
      trickMelds.forEach((meld, index) => {
        const meldKey = `${meld.playerId}-${index}`;
        const existingMeld = prevAnimatedMelds.get(meldKey);
        
        if (existingMeld) {
          // Keep existing meld but mark as not new
          newAnimatedMelds.set(meldKey, { ...existingMeld, isNew: false });
        } else {
          // New meld - needs animation
          const rotation = Math.sin(index * 2.3) * 20 + Math.cos(index * 1.7) * 15;
          newAnimatedMelds.set(meldKey, {
            cards: meld.cards,
            playerId: meld.playerId,
            rotation,
            isNew: true // Will trigger animation
          });
        }
      });
      
      return newAnimatedMelds;
    });
  }, [trickMelds]);
  
  React.useEffect(() => {
    if (prevTrickMeldsLength.current > 0 && trickMelds.length === 0) {
      // Cards were cleared, trigger sweep animation
      // Move current animated melds to sweeping state
      const meldsToSweep = Array.from(animatedMelds.values()).map((meld, index) => ({
        cards: meld.cards,
        rotation: meld.rotation,
        key: `sweep-${Date.now()}-${index}`
      }));
      
      setSweepingMelds(meldsToSweep);
      setAnimatedMelds(new Map());
      
      // Clear sweeping melds after animation completes
      setTimeout(() => {
        setSweepingMelds([]);
      }, 800); // Longer than animation duration
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
        top: '-4.5em', 
        left: '50%', 
        transform: 'translateX(-50%)'
      };
    } else if (total === 2) {
      // Two opponents: one top, one right (for 3-player game)
      return index === 0 
        ? { 
            top: '50%', 
            left: '-1em', 
            transform: 'translateY(-50%) rotate(90deg)'
          }
        : { 
            top: '50%', 
            right: '-3em',
            transform: 'translateY(-50%) rotate(90deg)'
          };
    } else if (total === 3) {
      // Three opponents: left, top, right
      if (index === 0) {
        return { 
          top: '50%', 
          left: '-3em', 
          transform: 'translateY(-50%) rotate(-90deg)'
        };
      } else if (index === 1) {
        return { 
          top: '-4em', 
          left: '50%', 
          transform: 'translateX(-50%)'
        };
      } else {
        return { 
          top: '50%', 
          right: '-3em', 
          transform: 'translateY(-50%) rotate(90deg)'
        };
      }
    } else {
      // 4+ players: distribute along top
      const spacing = 100 / (total + 1);
      const position = spacing * (index + 1);
      return { 
        top: '-4.5em',
        left: `${position}%`, 
        transform: 'translateX(-50%)'
      };
    }
  };

  // Position player names toward the middle of the table
  const getPlayerNamePosition = (index: number, total: number) => {
    if (total === 1) {
      // Single opponent name below their cards
      return { 
        top: '2em',
        left: 'calc(50% - 6em)', 
        transform: 'translateY(50%)'
      };
    } else if (total === 2) {
      // Two opponents
      return index === 0 
        ? { 
            top: '50%', 
            left: '-1em', 
            transform: 'translateY(-50%) rotate(-90deg)'
          }
        : { 
            top: '50%', 
            right: '-1em',
            transform: 'translateY(-50%) rotate(90deg)'
          };
    } else if (total === 3) {
      // Three opponents
      if (index === 0) {
        return { 
          top: '50%', 
          left: '-1em', 
          transform: 'translateY(-50%) rotate(-90deg)'
        };
      } else if (index === 1) {
        return { 
          top: '3em', 
          left: '50%', 
          transform: 'translateX(-50%)'
        };
      } else {
        return { 
          top: '50%', 
          right: '-1em', 
          transform: 'translateY(-50%) rotate(90deg)'
        };
      }
    } else {
      // 4+ players: distribute along top
      const spacing = 100 / (total + 1);
      const position = spacing * (index + 1);
      return { 
        top: '2em',
        left: `${position}%`, 
        transform: 'translateX(-50%)'
      };
    }
  };

  const myPlayer = players.get(myPlayerId);

  // Compute winner and standings if needed
  const computedWinner = (() => {
    if (winner) return winner;
    if (phase !== GamePhase.GAME_END && phase !== GamePhase.ROUND_END) return null;
    
    let maxWins = 0;
    let topPlayer: Player | undefined;
    players.forEach(player => {
      if (player.wins > maxWins) {
        maxWins = player.wins;
        topPlayer = player;
      }
    });
    
    if (!topPlayer) return null;
    
    const tp = topPlayer; // Create a const binding
    return {
      id: tp.id,
      name: tp.name,
      wins: tp.wins
    };
  })();

  const computedStandings = finalStandings || (() => {
    if (phase !== GamePhase.GAME_END && phase !== GamePhase.ROUND_END) return null;
    return Array.from(players.values()).map(p => ({
      playerId: p.id,
      name: p.name,
      wins: p.wins,
      losses: p.losses
    })).sort((a, b) => b.wins - a.wins);
  })();
  
  // Production debugging for GameOver rendering
  useEffect(() => {
    if (!import.meta.env.DEV && (phase === GamePhase.GAME_END || phase === GamePhase.ROUND_END)) {
      console.warn('PRODUCTION DEBUG: GameTable END state', {
        phase,
        hasWinner: !!winner,
        hasComputedWinner: !!computedWinner,
        hasFinalStandings: !!finalStandings,
        hasComputedStandings: !!computedStandings,
        willShowGameOver: !!((phase === GamePhase.GAME_END || phase === GamePhase.ROUND_END) && computedWinner && computedStandings),
        timestamp: new Date().toISOString()
      });
    }
  }, [phase, winner, computedWinner, finalStandings, computedStandings]);

  // Get animation start position based on player
  const getAnimationStartPosition = (playerId: string) => {
    if (playerId === myPlayerId) {
      // Player's own cards - from bottom
      return { bottom: '1em', left: '50%' };
    }
    
    // Find the player's position among other players
    const otherPlayers = Array.from(players.entries())
      .filter(([id]) => id !== myPlayerId)
      .sort((a, b) => (a[1].position || 0) - (b[1].position || 0));
    
    const playerIndex = otherPlayers.findIndex(([id]) => id === playerId);
    if (playerIndex === -1) return { left: '50%', top: '50%' }; // Fallback to center
    
    const position = getPlayerPosition(playerIndex, otherPlayers.length);
    
    // Convert the position to animation start position
    if ('right' in position) {
      return { right: '2em', top: '50%' };
    } else if (position.top === '50%') {
      return { left: '2em', top: '50%' };
    } else {
      return { top: '2em', left: position.left || '50%' };
    }
  };

  // Keyboard handler for resetting hand view
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'c' && e.ctrlKey)) {
        animateToRotation(0, 400);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Wheel event handler with passive: false
  React.useEffect(() => {
    const container = document.querySelector('.felt-texture');
    if (!container) return;

    // Add wheel event with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel as EventListener, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel as EventListener);
    };
  }, [handleWheel]);

  return (
    <div className="fixed inset-0 felt-texture overflow-hidden">
        <CircleText className="absolute inset-0 pointer-events-none" />


      {/* Header - Game Title and Leave Button */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
          <h3 className="text-lg font-bold text-gold px-3">H<sup>5</sup></h3>
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="bg-gray-900/90 backdrop-blur-sm rounded-full p-2 shadow-xl hover:bg-gray-800 transition-colors"
          title="Leave Game"
        >
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <>
          {/* Dimmed background for modal */}
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowLeaveConfirm(false)} />
          <DialogBox className="max-w-sm">
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
          </DialogBox>
        </>
      )}

      {/* Game Table Area */}
      <div className="absolute inset-0">
        {/* Other Players Cards */}
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

        {/* Other Players Names - positioned toward center */}
        {otherPlayers.map((opponent, index) => {
          const namePosition = getPlayerNamePosition(index, otherPlayers.length);
          const isCurrentTurn = currentTurnPlayerId === opponent.id;
          const isLeaderPlayer = leadPlayerId === opponent.id;

          return (
            <div
              key={`name-${opponent.id}`}
              className="absolute"
              style={namePosition}
            >
              <p className={`
                text-center text-xs text-yellow-100/40
                font-serif tracking-wider
                border border-dotted border-yellow-200/20 rounded-lg px-4 py-2
                ${isCurrentTurn ? 'text-yellow-100/60 border-yellow-200/40' : ''}
              `}>
                {isLeaderPlayer && '👑 '}
                {opponent.player.name}
                <span className="font-bold ml-1">({opponent.player.wins}-{opponent.player.losses})</span>
                {isCurrentTurn && ' 🎯'}
              </p>
            </div>
          );
        })}

        {/* Discard Pile Area */}
        <div className="absolute bottom-[15vh] left-[5vw] landscape:left-[10vw] landscape:bottom-[35vh]">
          {/* Sweeping cards animation */}
          {sweepingMelds.map((meld, meldIndex) => {
            // Add some randomness to where cards land in the pile
            const landingVariation = {
              x: Math.random() * 30 - 15, // -15 to +15 pixels
              y: Math.random() * 20 - 10  // -10 to +10 pixels
            };
            
            return (
              <AnimatedCards
                key={meld.key}
                cards={meld.cards}
                startPosition={{ left: '50%', top: '50%' }}
                endPosition={{ 
                  left: `calc(10vw + ${landingVariation.x}px)`, 
                  bottom: `calc(35vh + ${landingVariation.y}px)` 
                }}
                duration={0.6}
                stagger={0.02}
                arrangeAsArc={false}
                groupRotation={meld.rotation + Math.random() * 40 - 20}
                dimmed={true}
                zIndex={45}
              />
            );
          })}
          
          {/* Static discarded cards - messy pile like real table */}
          {lastTrickMelds.length > 0 && (
            <div className="relative w-48 h-32">
              {lastTrickMelds.flatMap((meld, meldIndex) => 
                meld.cards.map((card, cardIndex) => {
                  // Create a unique but deterministic position for each card
                  const totalIndex = lastTrickMelds
                    .slice(0, meldIndex)
                    .reduce((sum, m) => sum + m.cards.length, 0) + cardIndex;
                  
                  // Use multiple sine waves for natural randomness
                  const seed = totalIndex * 2.7;
                  const x = Math.sin(seed * 1.3) * 60 + Math.cos(seed * 0.7) * 40;
                  const y = Math.cos(seed * 0.9) * 40 + Math.sin(seed * 1.1) * 30;
                  const rotation = Math.sin(seed * 0.5) * 45 + Math.cos(seed * 1.7) * 30;
                  
                  // Older cards get pushed down slightly
                  const ageOffset = Math.min(totalIndex * 0.5, 20);
                  
                  return (
                    <Card
                      key={`swept-${meldIndex}-${card.suit}-${card.rank}-${cardIndex}`}
                      {...card}
                      className="absolute transform cursor-default transition-all duration-300"
                      style={{ 
                        transform: `translate(${x}px, ${y + ageOffset}px) rotate(${rotation}deg) scale(0.3)`,
                        filter: 'brightness(0.5)',
                        zIndex: totalIndex // Newer cards on top
                      }}
                    />
                  );
                })
              )}
            </div>
          )}
          
          {/* Label below the piles */}
          <p className="text-center text-xs mt-16 text-yellow-100/40
              font-serif tracking-wider
              border border-dotted border-yellow-200/20 rounded-lg px-3 py-2">Discards</p>
        </div>

        {/* Center Play Area - Messy Stack */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">{/* Add relative container for proper centering */}
          
          {/* Curved Text SVG */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
            <svg width="300" height="300" viewBox="0 0 300 300" className="opacity-40">
              <defs>
                <path id="circlePath" d="M 150, 150 m -80, 0 a 80,80 0 0,1 160,0 a 80,80 0 0,1 -160,0" />
              </defs>
              <g>
                <use xlinkHref="#circlePath" fill="none" />
                <text fill="#8b7355" fontSize="16" fontFamily="Georgia, serif" fontWeight="600">
                  <textPath xlinkHref="#circlePath">Heart of 5 ★ Is Da Bomb ★ Heart of 5 ★ Is Da Bomb ★ </textPath>
                </text>
              </g>
            </svg>
          </div>
          {/* All center melds using AnimatedCards */}
          {Array.from(animatedMelds.entries()).map(([key, meld], index) => {
            const isCurrentMeld = index === animatedMelds.size - 1;
            
            // Sort cards by rank for the current meld only
            const cardsToDisplay = isCurrentMeld 
              ? [...meld.cards].sort((a, b) => a.rank - b.rank)
              : meld.cards;
            
            return (
              <AnimatedCards
                key={key}
                cards={cardsToDisplay}
                startPosition={meld.isNew ? getAnimationStartPosition(meld.playerId) : { left: '50%', top: '50%' }}
                endPosition={{ left: '50%', top: '50%' }}
                duration={meld.isNew ? 0.5 : 0}
                stagger={meld.isNew ? 0.05 : 0}
                arrangeAsArc={true}
                groupRotation={meld.rotation}
                dimmed={!isCurrentMeld}
                zIndex={40 + index}
              />
            );
          })}
          
          {/* Deck and Discard indicators */}
          {!currentMeld && !isLeader && (
            <div className="flex items-center space-x-12">
              {/* Deck - neat stacked appearance */}
              <div className="relative">
                {/* Shadow cards for depth */}
                <div className="absolute w-16 h-24 bg-gray-800/60 rounded-lg transform translate-x-2 translate-y-2" />
                <div className="absolute w-16 h-24 bg-gray-700/80 rounded-lg transform translate-x-1 translate-y-1" />
                
                {/* Top card */}
                <Card suit="" rank={0} isBack className="w-16 h-24 relative z-10 shadow-xl" />
                
                {/* Card count badge */}
                <span className="absolute -top-2 -right-2 bg-gray-900 text-gold font-bold px-2 py-1 rounded-full text-xs z-20 border border-gold/50 shadow-lg">
                  {deckCount}
                </span>
                
                {/* Label */}
                <p className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-yellow-100/40
                    font-serif tracking-wider">
                  Draw Pile
                </p>
              </div>
              
              {/* Center discard indicator - shows last played */}
              {discardTop && (
                <div className="relative">
                  {/* Small pile effect */}
                  <div className="absolute w-16 h-24 opacity-20 transform translate-x-1 translate-y-1">
                    <Card {...discardTop} className="w-full h-full transform rotate-8" />
                  </div>
                  <div className="absolute w-16 h-24 opacity-30 transform translate-x-0.5 translate-y-0.5">
                    <Card {...discardTop} className="w-full h-full transform -rotate-4" />
                  </div>
                  
                  {/* Top card */}
                  <Card {...discardTop} className="w-16 h-24 relative z-10 transform rotate-2 shadow-lg" />
                  
                  {/* Label */}
                  <p className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-yellow-100/40
                      font-serif tracking-wider">
                    Last Played
                  </p>
                </div>
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
        {isMyTurn && phase === GamePhase.PLAYING && (
          <div className="absolute bottom-[1em] left-1/2 transform -translate-x-1/2 flex space-x-3 z-30">
            <button
              onClick={onPass}
              disabled={!canPass}
              className={`flex-shrink ${
                canPass ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              } px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg`}
            >
              Pass
            </button>
            <button
              onClick={handlePlayCards}
              disabled={selectedCards.size === 0}
              className={`flex-grow min-w-[12rem] ${
                selectedCards.size > 0 ? 'bg-gold hover:bg-gold-dark text-gray-900' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              } px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg`}
            >
              Play Selected ({selectedCards.size})
            </button>
          </div>
        )}

        {/* Turn Indicator */}
        {!isMyTurn && currentTurnPlayerId && phase === GamePhase.PLAYING && (
          <div className="absolute bottom-[11em] left-1/2 transform -translate-x-1/2 z-30">
            <div className="bg-gray-900/90 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-sm">
                Waiting for <span className="text-gold font-bold">
                  {players.get(currentTurnPlayerId)?.name || 'Unknown'}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Leader message when center is empty */}
        {!currentMeld && isMyTurn && isLeader && (
          <div className="absolute bottom-[11em] left-1/2 transform -translate-x-1/2 z-30">
          <div className="bg-gold/20 backdrop-blur-sm border-2 border-gold px-6 py-4 rounded-lg">
            <p className="text-lg text-gold font-bold text-center">
              You are the leader
            </p>
            <p className="text-sm text-gold text-center mt-1">
              You may lead with any type
            </p>
          </div>
          </div>
        )}
      </div>

      {/* Current Player Nameplate - Bottom center above hand */}
      {myPlayer && (
        <div className="absolute bottom-[8em] left-1/2 transform -translate-x-1/2">
          <p className={`
            text-center text-xs text-yellow-100/40
            font-serif tracking-wider
            border border-dotted border-yellow-200/20 rounded-lg px-4 py-2
            ${isMyTurn ? 'text-yellow-100/60 border-yellow-200/40' : ''}
          `}>
            {isLeader && '👑 '}
            {myPlayer.name} (You)
            <span className="font-bold ml-1">({myPlayer.wins}-{myPlayer.losses})</span>
            {isMyTurn && ' 🎯'}
          </p>
        </div>
      )}

      {/* Player Hand - Bottom of screen */}
      <PlayerHand 
        hand={myHand}
        selectedCards={selectedCards}
        onCardSelect={onCardSelect}
        rotationOffset={handRotationOffset}
        setRotationOffset={setHandRotationOffset}
        isDragging={isDraggingHand}
        setIsDragging={setIsDraggingHand}
        animateToRotation={animateToRotation}
        applyElasticResistance={applyElasticResistance}
      />

      {/* Game Over Dialog */}
      {(() => {
        // Debug logging for production
        if ((phase === GamePhase.GAME_END || phase === GamePhase.ROUND_END) && !import.meta.env.DEV) {
          console.warn('PRODUCTION DEBUG: GameTable END state', {
            phase,
            hasComputedWinner: !!computedWinner,
            computedWinner,
            hasComputedStandings: !!computedStandings,
            computedStandings,
            winner: winner,
            finalStandings: finalStandings
          });
        }
        
        // Show GameOver on ROUND_END (which is when a game actually ends)
        if ((phase === GamePhase.GAME_END || phase === GamePhase.ROUND_END) && computedWinner && computedStandings) {
          return (
            <GameOver
              winner={computedWinner}
              finalStandings={computedStandings}
              onPlayAgain={onPlayAgain}
              onLeaveGame={onLeaveGame}
            />
          );
        }
        return null;
      })()}
    </div>
  );
};
