import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { AnimatedCards } from '../animations/AnimatedCards';
import { useAnimatedCards } from '../../hooks/useAnimatedCards';
import { PlayerHand } from '../game/PlayerHand';

export const AnimationTest: React.FC = () => {
  const [selectedPosition, setSelectedPosition] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom');
  const [handCount, setHandCount] = useState(0);
  const [allHands, setAllHands] = useState<Array<{cards: any[], rotation: number, key: string, isFromHand?: boolean, isOld?: boolean}>>([]);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const { animatingCards, animationConfig, animateCards, clearAnimation } = useAnimatedCards();
  
  // Sample hand of cards
  const hand = [
    { suit: 'J' as const, rank: 15 },
    { suit: 'J' as const, rank: 16 },
    { suit: 'C' as const, rank: 13 },
    { suit: 'S' as const, rank: 1 },
    { suit: 'H' as const, rank: 2 },
    { suit: 'H' as const, rank: 3 },
    { suit: 'H' as const, rank: 4 },
    { suit: 'H' as const, rank: 5 },
    { suit: 'H' as const, rank: 6 },
    { suit: 'H' as const, rank: 7 },
    { suit: 'H' as const, rank: 8 },
    { suit: 'H' as const, rank: 9 },
    { suit: 'H' as const, rank: 10 },
    { suit: 'H' as const, rank: 11 },
    { suit: 'H' as const, rank: 12 },
    { suit: 'H' as const, rank: 13 },
  ];
  
  // Position configurations
  const startPositions = {
    bottom: { top: '100%', left: '50%' },
    top: { top: '0%', left: '50%' },
    left: { left: '0%', top: '50%' },
    right: { right: '0%', top: '50%' }
  };
  
  // Special position for cards played from hand - matches PlayerHand position
  const handPosition = { bottom: '1em', left: '50%' };
  
  // Different hand compositions for variety
  const handTypes = [
    { cards: hand.slice(0, 3), name: "3 cards" },   // 3 cards
    { cards: hand.slice(3, 8), name: "5 cards" },   // 5 cards  
    { cards: hand.slice(1, 13), name: "12 cards" },   // 12 cards  
    { cards: hand.slice(8, 10), name: "2 cards" },  // 2 cards
  ];
  
  // Auto-play animation loop - DISABLED FOR DEBUGGING
  useEffect(() => {
    let timeoutIds: NodeJS.Timeout[] = [];
    let cycleCount = 0;
  
    const playCycle = () => {
      // Clear previous hands
      setAllHands([]);
      setHandCount(0);
   
      // Play each hand in sequence
      handTypes.forEach((handType, index) => {
        const timeoutId = setTimeout(() => {
          const rotation = index * 20 - 20; // -20, 0, 20 degrees
       
          setAllHands(prev => [...prev, { 
            cards: handType.cards, 
            rotation,
            key: `${cycleCount}-${index}` // Add unique key per cycle
          }]);
       
          setHandCount(index + 1);
        }, index * 1500); // Stagger each hand by 1.5 seconds
     
        timeoutIds.push(timeoutId);
      });
   
      // Schedule next cycle
      const cycleTimeout = setTimeout(() => {
        cycleCount++;
        playCycle();
      }, 6000); // 3 hands * 1.5s + 1.5s pause
   
      timeoutIds.push(cycleTimeout);
    };
  
    // Start first cycle
    playCycle();
  
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [selectedPosition]); // Only restart when position changes
  
  return (
    <>
      {/* Main content layer */}
      <div className="fixed inset-0 felt-texture overflow-hidden">
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
          <h1 className="text-2xl font-bold text-gold">Animation Test Lab - Reusable Component</h1>
          <Link to="/" className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm">
            Back to Home
          </Link>
        </div>
        
        {/* Center Play Area */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-48 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center">
            <p className="text-gray-500 text-sm">Play Area</p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="hidden absolute bottom-32 left-1/2 transform -translate-x-1/2 z-30">
          <div className="bg-gray-800/90 px-8 py-3 rounded-lg space-y-1">
            <p className="text-gold font-bold">
              Animation Paused - Debugging Player Hand
            </p>
            <p className="text-sm text-gray-300">
              {hand.length} cards in hand
            </p>
          </div>
        </div>
        
        {/* Action Buttons - Above Cards */}
          <div className="absolute bottom-[1em] right-[2em] flex space-x-3">
          <button
              className={`flex-shrink z-20
              ${
              selectedCards.size > 0 ? 'bg-gold hover:bg-gold-dark text-gray-900' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            } px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg`}
          >
              Pass
          </button>
          <button
            onClick={() => {
              if (selectedCards.size > 0) {
                const selectedCardObjs = Array.from(selectedCards).map(key => {
                  const [suit, rank] = key.split('-');
                  return { suit: suit as 'H' | 'D' | 'C' | 'S', rank: parseInt(rank) };
                });
                
                // Mark all existing hands as old
                setAllHands(prev => prev.map(hand => ({ ...hand, isOld: true })));
                
                // Add manually played cards with a unique rotation
                const rotation = -30 + Math.random() * 60;
                setAllHands(prev => [...prev, {
                  cards: selectedCardObjs,
                  rotation,
                  key: `manual-${Date.now()}`,
                  isFromHand: true, // Mark that this came from player's hand
                  isOld: false // This is the new hand
                }]);
                
                setSelectedCards(new Set());
              }
            }}
            disabled={selectedCards.size === 0}
              className={`flex-grow z-20
              ${
              selectedCards.size > 0 ? 'bg-gold hover:bg-gold-dark text-gray-900' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            } px-6 py-2 text-sm font-bold rounded-lg transition-all shadow-lg`}
          >
            Play Selected ({selectedCards.size})
          </button>
        </div>
        
        {/* Player Hand - using the actual game component */}
        <PlayerHand 
          hand={hand}
          selectedCards={selectedCards}
          onCardSelect={(cardKey) => {
            setSelectedCards(prev => {
              const newSet = new Set(prev);
              if (newSet.has(cardKey)) {
                newSet.delete(cardKey);
              } else {
                newSet.add(cardKey);
              }
              return newSet;
            });
          }}
        />
        
        {/* Animation Info */}
        <div className="absolute top-20 left-4 bg-gray-800/90 p-4 rounded-lg">
          <h3 className="text-gold font-bold mb-2">Animation Demo</h3>
          <div className="space-y-2 text-sm">
            <p>• Auto plays 3 hands in sequence</p>
            <p>• Each hand has different rotation</p>
            <p>• Click cards to select manually</p>
            <p>• Uses actual game PlayerHand component</p>
          </div>
        </div>
        
        {/* Position selector */}
        <div className="absolute top-20 right-4 bg-gray-800/90 p-4 rounded-lg">
          <h3 className="text-gold font-bold mb-2">Starting Position</h3>
          <div className="space-y-2">
            {(['bottom', 'top', 'left', 'right'] as const).map(pos => (
              <button
                key={pos}
                onClick={() => setSelectedPosition(pos)}
                className={`block w-full px-3 py-1 rounded text-sm ${
                  selectedPosition === pos 
                    ? 'bg-gold text-gray-900 font-bold' 
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                From {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Example configurations */}
        <div className="-z-10 relative top-1/3 left-[1em] p-4 rounded-lg max-w-xs">
          <h3 className="text-gold font-bold mb-2">Example Usage</h3>
          <pre className="text-xs text-gray-300/40 overflow-x-auto">
{`animateCards(cards, {
  startPosition: { 
    bottom: '0%', 
    left: '50%' 
  },
  endPosition: { 
    left: '50%', 
    top: '50%' 
  },
  duration: 0.5,
  stagger: 0.1,
  arrangeAsArc: true
})`}
          </pre>
        </div>
      </div>
      
      {/* All animated hands */}
      {allHands.map((hand) => (
        <AnimatedCards
          key={hand.key}
          cards={hand.cards}
          startPosition={hand.isFromHand ? handPosition : startPositions[selectedPosition]}
          endPosition={{ left: '50%', top: '50%' }}
          duration={0.5}
          stagger={0.05}
          arrangeAsArc={true}
          groupRotation={hand.rotation}
          dimmed={hand.isOld}
        />
      ))}
    </>
  );
};
