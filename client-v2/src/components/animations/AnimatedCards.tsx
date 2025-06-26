import React from 'react';
import { Card } from '../ui/Card';
import type { Card as CardType } from '../../types/game';

interface Position {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
}

interface AnimatedCardsProps {
  cards: CardType[];
  startPosition: Position;
  endPosition: Position;
  duration?: number;
  delay?: number;
  stagger?: number;
  arrangeAsArc?: boolean;
  groupRotation?: number;
  onAnimationComplete?: () => void;
  dimmed?: boolean;
}

export const AnimatedCards: React.FC<AnimatedCardsProps> = ({
  cards,
  startPosition,
  endPosition,
  duration = 0.25,
  delay = 0,
  stagger = 0.1,
  arrangeAsArc = true,
  groupRotation = 0,
  onAnimationComplete,
  dimmed = false,
}) => {
  // Calculate arc positions for cards if arrangeAsArc is true
  const getCardEndOffset = (index: number, total: number) => {
    if (!arrangeAsArc) return { x: 0, y: 0, rotate: 0 };
    if (total <= 1) return { x: 0, y: 0, rotate: 0 };
    
    // Use same approach as PlayerHand
    const containerWidth = window.innerWidth;
    const baseCardWidth = 64; // Base card width in pixels
    const cardOverlap = 0.4; // Cards overlap by 40%
    const minSpacing = baseCardWidth * (1 - cardOverlap);
    const maxSpread = containerWidth * 0.6; // Use 60% of screen width for center display
    
    // Calculate ideal spread based on number of cards
    const idealSpread = (total - 1) * minSpacing;
    const actualSpread = Math.min(idealSpread, maxSpread);
    
    // Position cards evenly across the spread
    const cardSpacing = actualSpread / Math.max(1, total - 1);
    const startX = -actualSpread / 2;
    const x = startX + (index * cardSpacing);
    
    // Use PlayerHand-style arc positioning
    const circleRadius = containerWidth * 0.8;
    const maxAnglePerCard = 10; // Maximum 10 degrees between cards
    const idealMaxAngle = 30; // Ideal total spread
    const actualMaxAngle = Math.min(idealMaxAngle, (total - 1) * maxAnglePerCard);
    const angleStep = total > 1 ? actualMaxAngle / (total - 1) : 0;
    const cardAngle = -actualMaxAngle / 2 + (index * angleStep);
    const cardAngleRad = (cardAngle * Math.PI) / 180;
    
    // Position on arc
    const y = -circleRadius * (1 - Math.cos(cardAngleRad)) * 0.05; // Very subtle arc
    const rotate = cardAngle;
    
    return { x, y, rotate };
  };
  
  // Convert position to transform values
  const getPositionTransform = (position: Position) => {
    let x = '0%';
    let y = '0%';
    
    if (position.left) x = position.left;
    if (position.right) x = `calc(100% - ${position.right})`;
    if (position.top) y = position.top;
    if (position.bottom) y = `calc(100vh - ${position.bottom} - 6rem)`; // Account for card height
    
    return { x, y };
  };
  
  const startTransform = getPositionTransform(startPosition);
  const endTransform = getPositionTransform(endPosition);
  
  // Calculate animation duration including all staggers
  React.useEffect(() => {
    if (onAnimationComplete && cards.length > 0) {
      const totalDuration = delay + duration + (cards.length - 1) * stagger;
      const timer = setTimeout(() => {
        onAnimationComplete();
      }, totalDuration * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [cards.length, delay, duration, stagger, onAnimationComplete]);
  
  return (
    <>
      <div className={`fixed inset-0 pointer-events-none z-40 ${dimmed ? 'cards-dimmed' : ''}`}>
        {cards.map((card, index) => {
            const endOffset = getCardEndOffset(index, cards.length);
            const animationDelay = delay + (index * stagger);
            
            return (
              <div
                key={`animated-${card.suit}-${card.rank}-${index}`}
                className="absolute"
                style={{
                  width: '4rem',
                  height: '6rem',
                  animation: `cardSlideIn ${duration}s ease-in-out ${animationDelay}s forwards`,
                  opacity: 0,
                  '--start-x': startTransform.x,
                  '--start-y': startTransform.y,
                  '--end-x': endTransform.x,
                  '--end-y': endTransform.y,
                  '--offset-x': `${endOffset.x}px`,
                  '--offset-y': `${endOffset.y}px`,
                  '--end-rotate': `${endOffset.rotate + groupRotation}deg`,
                } as React.CSSProperties}
              >
                <Card 
                  suit={card.suit} 
                  rank={card.rank}
                  className="w-full h-full"
                />
              </div>
            );
          })}
      </div>
      
      <style jsx>{`
        @keyframes cardSlideIn {
          from {
            left: calc(var(--start-x) - 2rem);
            top: var(--start-y);
            transform: translateX(0) translateY(0) rotate(0deg);
            opacity: 1;
          }
          to {
            left: calc(var(--end-x) - 2rem + var(--offset-x));
            top: calc(var(--end-y) - 3rem + var(--offset-y));
            transform: rotate(var(--end-rotate));
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};
